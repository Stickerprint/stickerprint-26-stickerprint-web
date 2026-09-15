import { adminClient } from '$lib/server/admin';
import type { RequestHandler } from './$types';

/** Pixel di apertura delle email di richiesta recensione: conta le aperture della richiesta [id] */
const GIF = Uint8Array.from([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59]);
export const GET: RequestHandler = async ({ params }) => {
	const db = adminClient();
	if (db && /^[0-9a-f-]{36}$/.test(params.id)) {
		const { data } = await db.from('review_requests').select('opened_count, first_opened_at').eq('id', params.id).maybeSingle();
		if (data) { const now = new Date().toISOString(); await db.from('review_requests').update({ opened_count: Number(data.opened_count) + 1, first_opened_at: data.first_opened_at ?? now, last_opened_at: now }).eq('id', params.id); }
	}
	return new Response(GIF as unknown as BodyInit, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, no-cache, must-revalidate, private', pragma: 'no-cache', expires: '0' } });
};
