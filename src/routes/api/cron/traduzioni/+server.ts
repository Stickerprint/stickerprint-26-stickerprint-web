import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { traduciContenuti, traduttoreAttivo } from '$lib/server/traduttore-contenuti';
import { invalidateFaq } from '$lib/server/faq';
import { invalidatePromos } from '$lib/server/promos';
import type { RequestHandler } from './$types';

/** ogni giorno (vercel.json): traduce FAQ, articoli e offerte nuovi o cambiati nelle cinque lingue del sito */
export const GET: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	if (!env.SUPABASE_SERVICE_ROLE_KEY || !traduttoreAttivo()) return json({ skipped: true });
	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
	const r = await traduciContenuti(db, 50_000);
	if (r.fatte) { invalidateFaq(); invalidatePromos(); }
	return json(r);
};
