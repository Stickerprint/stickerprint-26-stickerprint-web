import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	// dal più recente al più vecchio
	const { data } = await supabase.from('invoices').select('id, number, issued_at, amount_gross, subtotal_net, discount_net, express_net, credit_used, vat_amount, email, billing, payment_method, pdf_path, sent_at, checkout_group, user_id, ddt_number, ddt_numbers, xml_generated_at, order_numbers, payment_terms').gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`).order('issued_at', { ascending: false }).order('number', { ascending: false });
	/* link firmati dei PDF in UNA chiamata (prima una per fattura: con 136 fatture la pagina impiegava secondi) */
	const paths = (data ?? []).map((i) => i.pdf_path as string | null).filter((p): p is string => !!p);
	const signed = new Map<string, string>();
	if (paths.length) { const { data: s } = await supabase.storage.from('invoices').createSignedUrls(paths, 3600); for (const x of s ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl); }
	const invoices = (data ?? []).map((inv) => ({ ...inv, pdf: inv.pdf_path ? (signed.get(inv.pdf_path) ?? null) : null }));
	const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
	return { invoices, year, years };
};
