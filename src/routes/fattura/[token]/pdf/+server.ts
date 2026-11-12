import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getInvoiceByToken, pdfFattura, trackInvoicePdf } from '$lib/server/fatture';
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
	/* aliquota e natura registrate (0% per l'estero) e lingua del cliente: tutto da pdfFattura */
	const { bytes, nome } = await pdfFattura(db, inv);
	if (inv.pdf_path) await db.storage.from('invoices').upload(inv.pdf_path, bytes, { contentType: 'application/pdf', upsert: true }).catch(() => {});
	await trackInvoicePdf(db, inv.id);
	return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${nome}"`, 'cache-control': 'no-store' } });
};
