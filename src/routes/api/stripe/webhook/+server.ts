import { json } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { setPaymentStatus } from '$lib/server/conferme';
import { setInvoicePaymentStatus } from '$lib/server/fatture';
import { verifyWebhook } from '$lib/server/stripe';
import { finalizeCheckout } from '$lib/server/checkout';
import type { RequestHandler } from './$types';

/** Stripe → checkout.session.completed: ordine del sito chiuso (fattura, email, produzione) oppure scadenza di conferma/fattura segnata pagata */
export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.text();
	if (!(await verifyWebhook(payload, request.headers.get('stripe-signature')))) return json({ error: 'firma non valida' }, { status: 400 });
	const ev = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
	const s = ev.data.object;
	/* carta inserita sul sito o wallet: PaymentIntent con i dati dell'ordine nei metadata */
	if (ev.type === 'payment_intent.succeeded') {
		const md = (s.metadata ?? {}) as Record<string, string>;
		const db = adminClient();
		if (!db || md.checkout !== '1' || !md.group) return json({ ignored: 'non checkout' });
		await finalizeCheckout(db, md.group, { provider: 'stripe', ref: String(s.id) });
		return json({ ok: true });
	}
	if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return json({ ignored: ev.type });
	if (s.payment_status !== 'paid') return json({ ignored: 'non pagato' });
	const md = (s.metadata ?? {}) as Record<string, string>;
	const db = adminClient();
	if (!db) return json({ error: 'database non configurato' }, { status: 500 });
	// sessioni create da altri sistemi sullo stesso account Stripe (es. il vecchio sito): non sono nostre, 200 e via
	if (!md.seq || (!md.group && !md.invoice)) return json({ ignored: 'non del nuovo sito' });
	const ref = typeof s.payment_intent === 'string' ? s.payment_intent : String(s.id);
	if (md.checkout === '1' && md.group) { await finalizeCheckout(db, md.group, { provider: 'stripe', ref }); return json({ ok: true }); }
	const e = md.invoice ? await setInvoicePaymentStatus(db, md.invoice, Number(md.seq), 'pagato', null, ref, 'stripe') : await setPaymentStatus(db, md.group, Number(md.seq), 'pagato', null, ref, 'stripe');
	return e ? json({ error: e }, { status: 500 }) : json({ ok: true });
};
