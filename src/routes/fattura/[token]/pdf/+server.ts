import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, trackInvoicePdf } from '$lib/server/fatture';
import { buildInvoicePdf } from '$lib/server/invoice';
import { t } from '$lib/traduzioni';
import type { RequestHandler } from './$types';

/** PDF della fattura dalla pagina del cliente: il file salvato, altrimenti rigenerato (il download viene registrato) */
export const GET: RequestHandler = async ({ params, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	const c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.fatturaNonTrovata'));
	const inv = c.inv;
	// sempre rigenerato dai dati (il file salvato puo' essere di una versione precedente del layout); il salvato viene aggiornato
	const bytes = await buildInvoicePdf({ number: inv.number, issued_at: inv.issued_at, email: inv.email ?? '', billing: inv.billing ?? {}, lines: inv.lines ?? [], subtotal_net: Number(inv.subtotal_net), discount_net: Number(inv.discount_net), express_net: Number(inv.express_net), credit_used: 0, vat_amount: Number(inv.vat_amount), total_gross: Number(inv.amount_gross), to_pay: Number(inv.amount_gross), payment_method: inv.payment_method, orders: inv.order_numbers ?? [], payment_terms: inv.payment_terms ?? [], notes: inv.notes });
	if (inv.pdf_path) await db.storage.from('invoices').upload(inv.pdf_path, bytes, { contentType: 'application/pdf', upsert: true }).catch(() => {});
	await trackInvoicePdf(db, inv.id);
	return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${t(locale, 'account.doc.fileFattura', { n: inv.number })}"`, 'cache-control': 'no-store' } });
};
