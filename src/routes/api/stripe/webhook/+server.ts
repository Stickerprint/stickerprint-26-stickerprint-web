import { json } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { setPaymentStatus } from '$lib/server/conferme';
import { verifyWebhook } from '$lib/server/stripe';
import type { RequestHandler } from './$types';

/** Stripe → checkout.session.completed: la scadenza diventa pagata e, se era l'ultimo anticipo, l'ordine entra in produzione */
export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.text();
	if (!(await verifyWebhook(payload, request.headers.get('stripe-signature')))) return json({ error: 'firma non valida' }, { status: 400 });
	const ev = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
	if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return json({ ignored: ev.type });
	const s = ev.data.object;
	if (s.payment_status !== 'paid') return json({ ignored: 'non pagato' });
	const md = (s.metadata ?? {}) as Record<string, string>;
	const db = adminClient();
	if (!db || !md.group || !md.seq) return json({ error: 'dati mancanti' }, { status: 400 });
	const e = await setPaymentStatus(db, md.group, Number(md.seq), 'pagato', null, typeof s.payment_intent === 'string' ? s.payment_intent : String(s.id), 'stripe');
	return e ? json({ error: e }, { status: 500 }) : json({ ok: true });
};
