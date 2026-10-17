import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/admin';
import { elaboraPosta } from '$lib/server/posta/elabora';
import type { RequestHandler } from './$types';

/** Cron (9 e 15 ora italiana, vercel.json) o chiamata interna: elabora le mail nuove. */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ ok: false }, { status: 401 });
	const db = adminClient();
	if (!db) return json({ ok: false, error: 'chiave di servizio mancante' }, { status: 500 });
	const r = await elaboraPosta(db, { max: Number(url.searchParams.get('max')) || 25 });
	return json({ ok: true, ...r });
};
export const config = { maxDuration: 300 };
