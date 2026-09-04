import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	const { data } = await supabase.from('invoices').select('id, number, issued_at, amount_gross, subtotal_net, discount_net, express_net, credit_used, vat_amount, email, billing, payment_method, pdf_path, sent_at, checkout_group, user_id, ddt_number, xml_generated_at, order_numbers, payment_terms').gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`).order('issued_at', { ascending: false });
	const invoices = [];
	for (const inv of data ?? []) {
		let pdf: string | null = null;
		if (inv.pdf_path) {
			const { data: s } = await supabase.storage.from('invoices').createSignedUrl(inv.pdf_path, 3600);
			pdf = s?.signedUrl ?? null;
		}
		invoices.push({ ...inv, pdf });
	}
	const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
	return { invoices, year, years };
};
