import { error } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken, trackPdf } from '$lib/server/conferme';
import { orderPdfForGroup } from '$lib/server/orders';
import type { RequestHandler } from './$types';

/** PDF della conferma d'ordine dalla pagina del cliente (il download viene registrato) */
export const GET: RequestHandler = async ({ params }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const c = await getByToken(db, params.token);
	if (!c) error(404, 'Conferma non trovata');
	const doc = await orderPdfForGroup(db, c.group.key);
	if (!doc) error(404, 'Ordine non trovato');
	await trackPdf(db, c.group.key);
	return new Response(doc.pdf as unknown as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="Conferma-ordine-${c.group.number}.pdf"`, 'cache-control': 'no-store' } });
};
