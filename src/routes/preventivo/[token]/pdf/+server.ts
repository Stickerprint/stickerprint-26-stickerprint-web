import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getQuoteByToken, quotePdf, trackQuotePdf } from '$lib/server/richieste';
import type { RequestHandler } from './$types';

/** PDF del preventivo dalla pagina del cliente (il download viene registrato) */
export const GET: RequestHandler = async ({ params }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const q = await getQuoteByToken(db, params.token);
	if (!q) error(404, 'Preventivo non trovato');
	const pdf = await quotePdf(q);
	await trackQuotePdf(db, q.id);
	return new Response(pdf as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="Preventivo-${q.number}.pdf"`, 'cache-control': 'no-store' } });
};
