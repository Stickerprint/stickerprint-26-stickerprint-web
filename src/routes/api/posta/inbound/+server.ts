import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/admin';
import { salvaInbound, type PostmarkInbound } from '$lib/server/posta/inbound';
import type { RequestHandler } from './$types';

/** Postmark Inbound → posta_in. L'URL del webhook porta la chiave (?k=POSTA_INBOUND_KEY): senza, 401. */
export const POST: RequestHandler = async ({ request, url }) => {
	if (!env.POSTA_INBOUND_KEY || url.searchParams.get('k') !== env.POSTA_INBOUND_KEY) return json({ ok: false }, { status: 401 });
	const db = adminClient();
	if (!db) return json({ ok: false, error: 'chiave di servizio mancante' }, { status: 500 });
	const p = (await request.json().catch(() => null)) as PostmarkInbound | null;
	if (!p?.MessageID) return json({ ok: false, error: 'payload non valido' }, { status: 400 });
	try {
		const r = await salvaInbound(db, p);
		return json({ ok: true, ...r });
	} catch (e) {
		return json({ ok: false, error: (e as Error).message }, { status: 500 });
	}
};
