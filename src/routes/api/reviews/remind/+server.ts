import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { reviewRequestEmail } from '$lib/server/email-templates';
import type { RequestHandler } from './$types';

/**
 * Ogni giorno (cron Vercel alle 9): agli ordini consegnati da almeno 24 ore e non ancora contattati
 * si manda la richiesta di recensione. Registrati → area personale; ospiti → pagina /recensione/<id ordine>.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const ok = (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) || (env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY);
	if (!ok) return json({ error: 'unauthorized' }, { status: 401 });
	if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ skipped: true });
	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
	const limit = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
	const { data, error } = await db.from('orders').select('id, number, checkout_group, user_id, email, shipping, product_name, qty, delivered_at, preview_url, proof_url, mockup_url').eq('status', 'consegnato').is('review_asked_at', null).not('email', 'is', null).lte('delivered_at', limit).limit(100);
	if (error) return json({ error: error.message }, { status: 500 });
	const groups = new Map<string, typeof data>();
	for (const o of data ?? []) { const k = o.checkout_group ?? o.id; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(o); }
	const sent: string[] = [];
	for (const [k, rows] of groups) {
		const f = rows[0];
		const href = f.user_id ? `${url.origin}/account/recensioni` : `${url.origin}/recensione/${f.id}`;
		const mail = reviewRequestEmail({ name: f.shipping?.first_name ?? null, number: f.number, items: rows.map((r) => ({ name: r.product_name, qty: r.qty, preview: r.proof_url ?? r.preview_url ?? r.mockup_url ?? null, cta: { label: 'Scrivi recensione', href: f.user_id ? `${url.origin}/account/recensioni` : `${url.origin}/recensione/${r.id}` } })), href });
		const r = await sendEmail({ to: f.email, subject: mail.subject, html: mail.html, tag: mail.tag, metadata: { order: f.number } });
		if (r.ok) { sent.push(f.number); await db.from('orders').update({ review_asked_at: new Date().toISOString() }).eq(f.checkout_group ? 'checkout_group' : 'id', k); }
	}
	return json({ candidates: groups.size, sent });
};
