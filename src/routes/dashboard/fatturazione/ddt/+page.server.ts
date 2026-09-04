import { fail } from '@sveltejs/kit';
import { buildInvoicePdf } from '$lib/server/invoice';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	const { data } = await supabase.from('ddts').select('*').gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`).order('issued_at', { ascending: false });
	const { data: inv } = await supabase.from('invoices').select('id, number, ddt_id').not('ddt_id', 'is', null);
	const byDdt = new Map((inv ?? []).map((i) => [i.ddt_id, i.number]));
	return { ddts: (data ?? []).map((d) => ({ ...d, invoice_number: byDdt.get(d.id) ?? null })), year, years: Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i) };
};

const r2 = (v: number) => Math.round(v * 100) / 100;
export const actions: Actions = {
	/** Fattura da DDT selezionati: una fattura per ogni DDT, importi congelati nel DDT */
	invoice: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const ids = String(f.get('ids') ?? '').split(',').filter(Boolean);
		if (!ids.length) return fail(400, { error: 'Seleziona almeno un DDT.' });
		const { data: ddts } = await supabase.from('ddts').select('*').in('id', ids);
		const made: string[] = [];
		for (const d of ddts ?? []) {
			if (d.invoice_id) continue;
			const dd = d.data as { customer: Record<string, string>; lines: { description: string; qty: number; unit_net: number; total_net: number }[]; subtotal_net: number; vat_amount: number; total_gross: number; order_numbers: string[]; payment_method: string | null; payment_terms?: { due: string; amount: number; method: string; xml_code: string }[] | null };
			const { data: num } = await supabase.rpc('next_invoice_number');
			const number = num as string;
			const issued = new Date().toISOString().slice(0, 10);
			const inv = { number, issued_at: issued, email: d.email ?? '', billing: dd.customer, lines: dd.lines, subtotal_net: dd.subtotal_net, discount_net: 0, discount_code: null, express_net: 0, credit_used: 0, vat_amount: dd.vat_amount, total_gross: dd.total_gross, to_pay: dd.total_gross, payment_method: dd.payment_method ?? 'Bonifico', orders: dd.order_numbers ?? [d.order_number], payment_terms: dd.payment_terms ?? null };
			let pdfPath: string | null = null;
			try {
				const bytes = await buildInvoicePdf(inv);
				const path = `staff/${number}.pdf`;
				const { error } = await supabase.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
				if (!error) pdfPath = path;
			} catch (e) { console.error('[ddt→fattura] pdf', e); }
			const { data: order } = await supabase.from('orders').select('user_id').eq('checkout_group', d.checkout_group).limit(1).maybeSingle();
			const { data: row, error } = await supabase.from('invoices').insert({ user_id: order?.user_id ?? null, number, issued_at: issued, amount_gross: r2(dd.total_gross), pdf_path: pdfPath, email: d.email, billing: dd.customer, lines: dd.lines, subtotal_net: dd.subtotal_net, vat_amount: dd.vat_amount, payment_method: dd.payment_method, payment_terms: dd.payment_terms ?? null, checkout_group: d.checkout_group, ddt_id: d.id, ddt_number: d.number, order_numbers: dd.order_numbers ?? [d.order_number] }).select('id').single();
			if (error) return fail(400, { error: `Fattura non creata: ${error.message}` });
			await supabase.from('ddts').update({ invoice_id: row.id }).eq('id', d.id);
			made.push(number);
		}
		return { ok: true, made };
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
