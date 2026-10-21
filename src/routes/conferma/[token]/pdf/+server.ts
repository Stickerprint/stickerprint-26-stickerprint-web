import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken, trackPdf } from '$lib/server/conferme';
import { orderPdfForGroup } from '$lib/server/orders';
import { t } from '$lib/traduzioni';
import { langOf } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** PDF della conferma d'ordine dalla pagina del cliente (il download viene registrato) */
export const GET: RequestHandler = async ({ params, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	const c = await getByToken(db, params.token);
	if (!c) error(404, t(locale, 'account.errori.confermaNonTrovata'));
	const doc = await orderPdfForGroup(db, c.group.key, langOf(locale));
	if (!doc) error(404, t(locale, 'account.errori.ordineNonTrovato'));
	await trackPdf(db, c.group.key);
	return new Response(doc.pdf as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${t(locale, 'account.doc.fileConferma', { n: c.group.number })}"`, 'cache-control': 'no-store' } });
};
