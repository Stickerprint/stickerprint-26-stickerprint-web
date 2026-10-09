import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/admin';
import { generaRating, mesePrima, oggiItalia } from '$lib/server/margini-rating';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';

/* il report del rating lo scrive l'assistente: puo' servire fino a un minuto (60 s e' il massimo anche del piano Vercel piu' piccolo) */
export const config: Config = { maxDuration: 60 };

/**
 * Cron giornaliero (05:15 UTC) del rating dell'Analisi margini. Fa qualcosa solo quando serve:
 *  - il mese scorso non ha ancora il rating definitivo → lo calcola ora (di solito il 1° del mese);
 *  - e' lunedi', oppure il mese in corso non ha ancora un rating (dal 3 del mese) → rating provvisorio.
 * ?forza=1 rifa' subito il provvisorio del mese in corso.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	const db = adminClient();
	if (!db) return json({ skipped: 'SUPABASE_SERVICE_ROLE_KEY mancante' });
	const oggi = oggiItalia();
	const scorso = mesePrima(oggi.mese);
	const esito: Record<string, string> = {};

	const { count: definitivi } = await db.from('margini_rating').select('id', { count: 'exact', head: true }).eq('mese', scorso).eq('definitivo', true);
	if (!definitivi) {
		const r = await generaRating(db, scorso, true);
		esito[`${scorso} definitivo`] = r.ok ? `${r.riga.lettera} (${r.riga.autore})` : r.errore;
	}

	const lunedi = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' })).getDay() === 1;
	const { count: delMese } = await db.from('margini_rating').select('id', { count: 'exact', head: true }).eq('mese', oggi.mese);
	if (url.searchParams.get('forza') === '1' || lunedi || (!delMese && oggi.giorno >= 3)) {
		const r = await generaRating(db, oggi.mese, false);
		esito[`${oggi.mese} provvisorio`] = r.ok ? `${r.riga.lettera} (${r.riga.autore})` : r.errore;
	}
	return json({ oggi: oggi.iso, esito });
};
