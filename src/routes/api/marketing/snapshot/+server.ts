import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/admin';
import { salvaGiorno } from '$lib/server/ads/storico';
import { generaTuttiIReport } from '$lib/server/ads/consigli';
import { leggiObiettivi } from '$lib/server/ads/impostazioni';
import { isoData, piuGiorni } from '$lib/marketing/formato';
import type { RequestHandler } from './$types';

/**
 * Cron delle 05:00 UTC: salva in ads_giorni la giornata di ieri di ogni canale collegato (storico in casa).
 * Il lunedì rigenera anche i report dei consigli (panoramica + un canale alla volta), così Mattia li trova pronti.
 * ?giorno=YYYY-MM-DD per rifare un giorno preciso; ?report=1 per forzare i report.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	const db = adminClient();
	if (!db) return json({ skipped: 'SUPABASE_SERVICE_ROLE_KEY mancante' });
	const giorno = url.searchParams.get('giorno') || isoData(piuGiorni(new Date(), -1));
	const storico = await salvaGiorno(db, giorno);
	const lunedi = new Date().getDay() === 1;
	const report = lunedi || url.searchParams.get('report') === '1' ? await generaTuttiIReport(db, await leggiObiettivi(db)) : null;
	return json({ giorno, storico, report });
};
