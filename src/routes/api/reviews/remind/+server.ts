import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { reviewRequestEmail } from '$lib/server/email-templates';
import { remindDueQuotes } from '$lib/server/richieste';
import { createReviewRequest } from '$lib/server/recensioni';
import type { RequestHandler } from './$types';

/**
 * DUE GIRI AL GIORNO (Mattia, 25/09/2026): i corrieri consegnano nelle fasce 9-12 e 13-16, quindi il
 * controllo gira alle 10 e alle 14 UTC — le 12 e le 16 italiane con l'ora legale — e manda subito la
 * richiesta a chi ha ricevuto il pacco in quella fascia.
 * Si scrive agli ordini consegnati da almeno mezz'ora (il tempo che il corriere registri la consegna)
 * e non ancora contattati. Registrati → area personale; ospiti → pagina /recensione/<id ordine>.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ skipped: true });
	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
	/* mezz'ora: la consegna delle 11:40 entra nel giro delle 12 */
	const limit = new Date(Date.now() - 30 * 60 * 1000).toISOString();
	/* DUE PROTEZIONI (dopo l'errore del 19-20/09/2026, quando il cron appena attivato ha scritto a 176 ordini importati dal vecchio sito):
	   1. mai gli ordini importati dal vecchio sito (legacy_id valorizzato): quei clienti hanno gia' avuto la loro richiesta a suo tempo;
	   2. mai consegne piu' vecchie di 14 giorni: se il cron resta fermo per un periodo, alla ripresa non recupera l'arretrato. */
	const oldest = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
	/* elenco esplicito (?orders=SPIT00340,SPIT00326): richiesta voluta da Mattia per quegli ordini precisi, anche se importati
	   o gia' contattati; unica condizione: devono essere consegnati */
	const explicit = (url.searchParams.get('orders') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
	const { data, error } = explicit.length
		? await db.from('orders').select('id, number, checkout_group, user_id, email, shipping, product_name, qty, delivered_at, preview_url, proof_url, mockup_url').eq('status', 'consegnato').in('number', explicit).not('email', 'is', null)
		: await db.from('orders').select('id, number, checkout_group, user_id, email, shipping, product_name, qty, delivered_at, preview_url, proof_url, mockup_url').eq('status', 'consegnato').is('review_asked_at', null).is('legacy_id', null).not('email', 'is', null).lte('delivered_at', limit).gte('delivered_at', oldest).limit(100);
	if (error) return json({ error: error.message }, { status: 500 });
	const groups = new Map<string, typeof data>();
	for (const o of data ?? []) { const k = o.checkout_group ?? o.id; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(o); }
	const sent: string[] = [];
	for (const [k, rows] of groups) {
		const f = rows[0];
		/* la richiesta viene registrata prima dell'invio: il pixel di apertura e i link portano il suo id */
		const reqId = await createReviewRequest(db, { orderId: f.id, checkoutGroup: f.checkout_group ?? null, number: f.number, email: f.email, name: f.shipping?.first_name ?? null });
		const q = reqId ? `?r=${reqId}` : '';
		const href = f.user_id ? `${url.origin}/account/recensioni${q}` : `${url.origin}/recensione/${f.checkout_group ?? f.id}${q}`;
		const mail = reviewRequestEmail({ name: f.shipping?.first_name ?? null, number: f.number, items: rows.map((r) => ({ name: r.product_name, qty: r.qty, preview: r.proof_url ?? r.preview_url ?? r.mockup_url ?? null })), href });
		const html = reqId ? mail.html.replace('</body>', `<img src="${url.origin}/api/track/open/${reqId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;"></body>`) : mail.html;
		const r = await sendEmail({ to: f.email, subject: mail.subject, html, tag: mail.tag, metadata: { order: f.number } });
		if (r.ok) { sent.push(f.number); await db.from('orders').update({ review_asked_at: new Date().toISOString() }).eq(f.checkout_group ? 'checkout_group' : 'id', k); if (reqId && r.messageId) await db.from('review_requests').update({ message_id: r.messageId }).eq('id', reqId); }
		else if (reqId) await db.from('review_requests').delete().eq('id', reqId);
	}
	// stesso cron (piano Hobby: massimo due): solleciti automatici dei preventivi senza risposta
	const quotes = explicit.length ? [] : await remindDueQuotes(db, url.origin, true).catch(() => [] as string[]);
	return json({ candidates: groups.size, sent, notFound: explicit.filter((n) => !(data ?? []).some((o) => o.number === n)), quotesReminded: quotes });
};
