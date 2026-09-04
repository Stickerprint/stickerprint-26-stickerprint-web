import { error, fail, redirect } from '@sveltejs/kit';
import { buildInvoicePdf, type InvoiceLine } from '$lib/server/invoice';
import type { PaymentMethod } from '$lib/dashboard/payments';
import type { Actions, PageServerLoad } from './$types';

const r2 = (v: number) => Math.round(v * 100) / 100;
const VAT = 0.22;
interface Edit { issued_at: string; email: string; billing: Record<string, string>; lines: InvoiceLine[]; terms: { method: string; due: string; amount: number; xml_code: string }[]; notes: string }

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: inv } = await supabase.from('invoices').select('*').eq('id', params.id).maybeSingle();
	if (!inv) error(404, 'Fattura non trovata');
	const ddtIds: string[] = inv.ddt_ids?.length ? inv.ddt_ids : inv.ddt_id ? [inv.ddt_id] : [];
	const [{ data: ddts }, { data: methods }] = await Promise.all([
		ddtIds.length ? supabase.from('ddts').select('id, number, issued_at, order_number, checkout_group').in('id', ddtIds) : Promise.resolve({ data: [] }),
		supabase.from('payment_methods').select('*').eq('active', true).order('sort')
	]);
	let pdf: string | null = null;
	if (inv.pdf_path) { const { data: s } = await supabase.storage.from('invoices').createSignedUrl(inv.pdf_path, 3600); pdf = s?.signedUrl ?? null; }
	return { inv, ddts: ddts ?? [], methods: (methods ?? []) as PaymentMethod[], pdf, locked: !!inv.xml_generated_at };
};

export const actions: Actions = {
	/** Salva le modifiche e rigenera il PDF (solo finché non è stato generato l'XML) */
	save: async ({ request, params, locals: { supabase } }) => {
		const { data: inv } = await supabase.from('invoices').select('*').eq('id', params.id).maybeSingle();
		if (!inv) return fail(404, { error: 'Fattura non trovata.' });
		if (inv.xml_generated_at) return fail(400, { error: 'XML già generato: la fattura non si può più modificare.' });
		let e: Edit;
		try { e = JSON.parse(String((await request.formData()).get('payload') ?? '')); } catch { return fail(400, { error: 'Dati non leggibili.' }); }
		const lines = (e.lines ?? []).filter((l) => l.description && Number(l.qty) > 0).map((l) => ({ description: String(l.description).trim(), qty: Number(l.qty), unit_net: Math.round(Number(l.unit_net) * 10000) / 10000, total_net: r2(Number(l.qty) * Number(l.unit_net)), ddt: l.ddt ?? null, ddt_date: l.ddt_date ?? null }));
		if (!lines.length) return fail(400, { error: 'La fattura deve avere almeno una riga.' });
		const subtotal = r2(lines.reduce((s, l) => s + l.total_net, 0));
		const vat = r2(subtotal * VAT);
		const gross = r2(subtotal + vat);
		let terms = (e.terms ?? []).filter((t) => t.due).map((t) => ({ method: t.method || inv.payment_method || 'Bonifico', due: t.due, amount: r2(Number(t.amount) || 0), xml_code: t.xml_code || 'MP05' }));
		if (terms.length) { const sum = r2(terms.reduce((s, t) => s + t.amount, 0)); if (Math.abs(sum - gross) > 0.01) terms[terms.length - 1].amount = r2(terms[terms.length - 1].amount + gross - sum); } else terms = inv.payment_terms ?? [];
		const payment = terms.length ? [...new Set(terms.map((t) => t.method))].join(' + ') : inv.payment_method;
		const ddtNumbers: string[] = inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : [];
		const patch = { issued_at: e.issued_at || inv.issued_at, email: (e.email ?? '').trim() || inv.email, billing: e.billing ?? inv.billing, lines, subtotal_net: subtotal, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: vat, amount_gross: gross, payment_terms: terms, payment_method: payment, notes: (e.notes ?? '').trim() || null, updated_at: new Date().toISOString() };
		try {
			const bytes = await buildInvoicePdf({ number: inv.number, issued_at: patch.issued_at, email: patch.email ?? '', billing: patch.billing ?? {}, lines, subtotal_net: subtotal, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: vat, total_gross: gross, to_pay: gross, payment_method: payment, orders: inv.order_numbers ?? [], payment_terms: terms, ddt_numbers: ddtNumbers, notes: patch.notes });
			const path = inv.pdf_path || `staff/${inv.number}.pdf`;
			const { error: ue } = await supabase.storage.from('invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
			if (!ue) Object.assign(patch, { pdf_path: path });
		} catch (err) { console.error('[fattura] pdf', err); }
		const { error: er } = await supabase.from('invoices').update(patch).eq('id', params.id);
		if (er) return fail(400, { error: er.message });
		return { ok: true, saved: true, message: 'Fattura salvata e PDF rigenerato.' };
	},
	delete: async ({ params, locals: { supabase } }) => {
		const { data: inv } = await supabase.from('invoices').select('xml_generated_at, pdf_path').eq('id', params.id).maybeSingle();
		if (!inv) return fail(404, { error: 'Fattura non trovata.' });
		if (inv.xml_generated_at) return fail(400, { error: 'XML già generato: la fattura non si può eliminare.' });
		await supabase.from('ddts').update({ invoice_id: null }).eq('invoice_id', params.id);
		if (inv.pdf_path) await supabase.storage.from('invoices').remove([inv.pdf_path]);
		const { error: er } = await supabase.from('invoices').delete().eq('id', params.id);
		if (er) return fail(400, { error: er.message });
		redirect(303, '/dashboard/fatturazione/fatture');
	}
};
