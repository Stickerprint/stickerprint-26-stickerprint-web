import { fail } from '@sveltejs/kit';
import { buildInvoicePdf, type InvoiceLine } from '$lib/server/invoice';
import { computeTerms, type PaymentMethod } from '$lib/dashboard/payments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	// dal più recente al più vecchio
	const { data } = await supabase.from('ddts').select('*').gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`).order('issued_at', { ascending: false }).order('number', { ascending: false });
	const { data: inv } = await supabase.from('invoices').select('id, number').not('ddt_ids', 'is', null);
	const byId = new Map((inv ?? []).map((i) => [i.id, i.number]));
	return { ddts: (data ?? []).map((d) => ({ ...d, invoice_number: d.invoice_id ? (byId.get(d.invoice_id) ?? null) : null })), year, years: Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i) };
};

const r2 = (v: number) => Math.round(v * 100) / 100;
type DdtData = { customer: Record<string, string>; lines: InvoiceLine[]; subtotal_net: number; vat_amount: number; total_gross: number; order_numbers: string[]; payment_method: string | null; payment_terms?: { due: string; amount: number; method: string; xml_code: string }[] | null };
const vatKey = (customer: Record<string, string>, name: string | null) => (customer?.vat ? 'vat:' + customer.vat.replace(/^IT/i, '').trim() : 'name:' + (customer?.company || name || '').toLowerCase().trim());

export const actions: Actions = {
	/** Un'unica fattura dai DDT selezionati (stessa partita IVA): le righe di ogni DDT restano riconoscibili */
	invoice: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const ids = String(f.get('ids') ?? '').split(',').filter(Boolean);
		if (!ids.length) return fail(400, { error: 'Seleziona almeno un DDT.' });
		const { data: rows } = await supabase.from('ddts').select('*').in('id', ids);
		const ddts = (rows ?? []).filter((d) => !d.invoice_id).sort((a, b) => String(a.number).localeCompare(String(b.number)));
		if (!ddts.length) return fail(400, { error: 'I DDT selezionati sono già fatturati.' });
		const keys = new Set(ddts.map((d) => vatKey((d.data as DdtData).customer, d.customer_name)));
		if (keys.size > 1) return fail(400, { error: 'Si possono unire solo DDT della stessa partita IVA (o dello stesso cliente).' });
		const first = ddts[0]; const fd = first.data as DdtData;
		const lines: InvoiceLine[] = ddts.flatMap((d) => ((d.data as DdtData).lines ?? []).map((l) => ({ ...l, ddt: d.number as string, ddt_date: d.issued_at as string })));
		const subtotal = r2(lines.reduce((s, l) => s + Number(l.total_net), 0));
		const vat = r2(subtotal * 0.22); const gross = r2(subtotal + vat);
		const { data: num } = await supabase.rpc('next_invoice_number');
		const number = num as string;
		const issued = new Date().toISOString().slice(0, 10);
		// scadenze: quelle del DDT se è uno solo, altrimenti ricalcolate sul totale con il metodo del primo DDT
		let terms = ddts.length === 1 && fd.payment_terms?.length ? fd.payment_terms : null;
		if (!terms) {
			const { data: pm } = await supabase.from('payment_methods').select('*').eq('name', fd.payment_method ?? '').maybeSingle();
			terms = pm && !(pm as PaymentMethod).custom ? computeTerms(pm as PaymentMethod, gross, issued) : [{ due: issued, amount: gross, method: fd.payment_method ?? 'Bonifico', xml_code: 'MP05' }];
		}
		const orderNumbers = [...new Set(ddts.flatMap((d) => (d.data as DdtData).order_numbers ?? [d.order_number]))];
		const ddtNumbers = ddts.map((d) => d.number as string);
		const inv = { number, issued_at: issued, email: first.email ?? '', billing: fd.customer, lines, subtotal_net: subtotal, discount_net: 0, discount_code: null, express_net: 0, credit_used: 0, vat_amount: vat, total_gross: gross, to_pay: gross, payment_method: fd.payment_method ?? 'Bonifico', orders: orderNumbers, payment_terms: terms, ddt_numbers: ddtNumbers };
		let pdfPath: string | null = null;
		try {
			const bytes = await buildInvoicePdf(inv);
			const path = `staff/${number}.pdf`;
			const { error } = await supabase.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
			if (!error) pdfPath = path;
		} catch (e) { console.error('[ddt→fattura] pdf', e); }
		const { data: order } = await supabase.from('orders').select('user_id').eq('checkout_group', first.checkout_group).limit(1).maybeSingle();
		const { data: row, error } = await supabase.from('invoices').insert({ user_id: order?.user_id ?? null, number, issued_at: issued, amount_gross: gross, pdf_path: pdfPath, email: first.email, billing: fd.customer, lines, subtotal_net: subtotal, vat_amount: vat, payment_method: inv.payment_method, payment_terms: terms, checkout_group: first.checkout_group, ddt_id: first.id, ddt_number: first.number, ddt_ids: ddts.map((d) => d.id), ddt_numbers: ddtNumbers, order_numbers: orderNumbers }).select('id').single();
		if (error) return fail(400, { error: `Fattura non creata: ${error.message}` });
		await supabase.from('ddts').update({ invoice_id: row.id }).in('id', ddts.map((d) => d.id));
		return { ok: true, made: [number], invoiceId: row.id, ddtCount: ddts.length };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		const { data: d } = await supabase.from('ddts').select('invoice_id').eq('id', id).maybeSingle();
		if (d?.invoice_id) return fail(400, { error: 'Il DDT ha una fattura collegata: elimina prima la fattura.' });
		await supabase.from('orders').update({ ddt_id: null }).eq('ddt_id', id);
		const { error } = await supabase.from('ddts').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
