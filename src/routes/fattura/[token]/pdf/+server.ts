import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, trackInvoicePdf } from '$lib/server/fatture';
import { buildInvoicePdf } from '$lib/server/invoice';
import type { RequestHandler } from './$types';

/** PDF della fattura dalla pagina del cliente: il file salvato, altrimenti rigenerato (il download viene registrato) */
export const GET: RequestHandler = async ({ params }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const c = await getInvoiceByToken(db, params.token);
	if (!c) error(404, 'Fattura non trovata');
	const inv = c.inv;
	// sempre rigenerato dai dati (il file salvato puo' essere di una versione precedente del layout); il salvato viene aggiornato
	const bytes = await buildInvoicePdf({ number: inv.number, issued_at: inv.issued_at, email: inv.email ?? '', billing: inv.billing ?? {}, lines: inv.lines ?? [], subtotal_net: Number(inv.subtotal_net), discount_net: Number(inv.discount_net), express_net: Number(inv.express_net), credit_used: 0, vat_amount: Number(inv.vat_amount), total_gross: Number(inv.amount_gross), to_pay: Number(inv.amount_gross), payment_method: inv.payment_method, orders: inv.order_numbers ?? [], payment_terms: inv.payment_terms ?? [], notes: inv.notes });
	if (inv.pdf_path) await db.storage.from('invoices').upload(inv.pdf_path, bytes, { contentType: 'application/pdf', upsert: true }).catch(() => {});
	await trackInvoicePdf(db, inv.id);
	return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="Fattura-${inv.number}.pdf"`, 'cache-control': 'no-store' } });
};
