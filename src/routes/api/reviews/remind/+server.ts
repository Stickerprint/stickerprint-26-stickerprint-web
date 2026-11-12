import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { remindDueQuotes } from '$lib/server/richieste';
import { inviaRichiestaRecensione } from '$lib/server/recensioni';
import type { RequestHandler } from './$types';

/**
 * DUE GIRI AL GIORNO (Mattia, 25/09/2026): i corrieri consegnano nelle fasce 9-12 e 13-16, quindi il
 * controllo gira alle 10 e alle 14 UTC — le 12 e le 16 italiane con l'ora legale — e manda subito la
 * richiesta a chi ha ricevuto il pacco in quella fascia.
 * Si scrive agli ordini consegnati da almeno mezz'ora (il tempo che il corriere registri la consegna)
 * e non ancora contattati. Registrati → area personale; ospiti → pagina /recensione/<id ordine>.
 */
export const GET: RequestHandler = async ({ request, url, locals }) => {
	const auth = request.headers.get('authorization') ?? '';
	/* elenco esplicito (?orders=SPIT00340,SPIT00326): ordini precisi voluti da Mattia, vedi sotto */
	const explicit = (url.searchParams.get('orders') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
	let ok = Boolean((env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY));
	/* lo staff loggato in dashboard puo' chiedere la recensione a ordini precisi (7/11/2026: la chiave interna vive solo su Vercel);
	   il giro completo resta riservato al cron. */
	if (!ok && explicit.length) {
		const { user } = await locals.safeGetSession();
		if (user) {
			const { data: profile } = await locals.supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
			ok = !!profile && ['admin', 'staff'].includes(profile.role as string);
		}
	}
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ skipped: true });
	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
	/* mezz'ora: la consegna delle 11:40 entra nel giro delle 12 */
	const limit = new Date(Date.now() - 30 * 60 * 1000).toISOString();
	/* TRE PROTEZIONI (dopo l'errore del 19-20/09/2026, quando il cron appena attivato ha scritto a 176 ordini importati dal vecchio sito,
	   e quello del 31/10/2026, quando ha scritto ai clienti aziendali degli ordini importati da Fatture in Cloud):
	   1. mai gli ordini importati dal vecchio sito (legacy_id valorizzato): quei clienti hanno gia' avuto la loro richiesta a suo tempo;
	   2. mai consegne piu' vecchie di 14 giorni: se il cron resta fermo per un periodo, alla ripresa non recupera l'arretrato;
	   3. SOLO ordini e-commerce: ai clienti aziendali (ordini manuali) la recensione non si chiede mai in automatico (Mattia, 31/10/2026). */
	const oldest = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
	/* elenco esplicito (?orders=SPIT00340,SPIT00326): richiesta voluta da Mattia per quegli ordini precisi, anche se importati
	   o gia' contattati. Basta che siano almeno spediti: per le spedizioni fatte fuori da Qapla' (es. FedEx per l'estero,
	   7/11/2026) la consegna non arriva da sola, e la richiesta stessa vale come conferma: l'ordine passa a Consegnato.
	   Le colonne portano anche `locale`: l'email esce nella lingua dell'ordine (prima usciva sempre in italiano). */
	const { data, error } = explicit.length
		? await db.from('orders').select('id, number, checkout_group, user_id, email, shipping, product_name, qty, delivered_at, preview_url, proof_url, mockup_url, locale, status').in('status', ['spedito', 'in_consegna', 'consegnato']).in('number', explicit).not('email', 'is', null)
		: await db.from('orders').select('id, number, checkout_group, user_id, email, shipping, product_name, qty, delivered_at, preview_url, proof_url, mockup_url, locale, status').eq('status', 'consegnato').eq('channel', 'ecommerce').is('review_asked_at', null).is('legacy_id', null).not('email', 'is', null).lte('delivered_at', limit).gte('delivered_at', oldest).limit(100);
	if (error) return json({ error: error.message }, { status: 500 });
	const groups = new Map<string, typeof data>();
	for (const o of data ?? []) { const k = o.checkout_group ?? o.id; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(o); }
	const sent: string[] = [];
	for (const [k, rows] of groups) {
		if (explicit.length && rows.some((o) => o.status !== 'consegnato')) await db.from('orders').update({ status: 'consegnato', prod_stage: null, delivered_at: new Date().toISOString() }).eq(rows[0].checkout_group ? 'checkout_group' : 'id', k).neq('status', 'consegnato');
		const r = await inviaRichiestaRecensione(db, rows as never, url.origin);
		if (r.ok) sent.push(rows[0].number);
	}
	// stesso cron (piano Hobby: massimo due): solleciti automatici dei preventivi senza risposta
	const quotes = explicit.length ? [] : await remindDueQuotes(db, url.origin, true).catch(() => [] as string[]);
	return json({ candidates: groups.size, sent, notFound: explicit.filter((n) => !(data ?? []).some((o) => o.number === n)), quotesReminded: quotes });
};
