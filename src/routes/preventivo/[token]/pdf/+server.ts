import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getQuoteByToken, quotePdf, trackQuotePdf } from '$lib/server/richieste';
import { t } from '$lib/traduzioni';
import { langOf } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** PDF del preventivo dalla pagina del cliente (il download viene registrato) */
export const GET: RequestHandler = async ({ params, locals: { locale } }) => {
	const db = adminClient();
	if (!db) error(503, t(locale, 'account.errori.servizio'));
	const q = await getQuoteByToken(db, params.token);
	if (!q) error(404, t(locale, 'account.errori.preventivoNonTrovato'));
	const pdf = await quotePdf(q, langOf(locale));
	await trackQuotePdf(db, q.id);
	return new Response(pdf as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${t(locale, 'account.doc.filePreventivo', { n: q.number })}"`, 'cache-control': 'no-store' } });
};
