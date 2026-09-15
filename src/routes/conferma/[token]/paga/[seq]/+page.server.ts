import { error, fail, redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { getByToken, setPaymentStatus } from '$lib/server/conferme';
import { createCheckoutSession, simulationOn, stripeConfigured } from '$lib/server/stripe';
import type { Actions, PageServerLoad } from './$types';

/** "Paga ora" su una scadenza: con Stripe si va alla cassa; senza, un pagamento simulato per provare il percorso */
export const load: PageServerLoad = async ({ params, url }) => {
	const db = adminClient();
	if (!db) error(503, 'Servizio non disponibile');
	const c = await getByToken(db, params.token);
	if (!c) error(404, 'Conferma non trovata');
	const p = c.payments.find((x) => x.seq === Number(params.seq));
	if (!p) error(404, 'Scadenza non trovata');
	if (p.status === 'pagato') redirect(303, `/conferma/${params.token}?pagato=1`);
	if (!p.upfront && /ricevuta|riba|rid\b|sdd/i.test(p.method)) error(400, 'Questa scadenza viene addebitata con ricevuta bancaria.');
	const base = `${url.origin}/conferma/${params.token}`;
	if (stripeConfigured()) {
		const s = await createCheckoutSession({ amountCents: Math.round(Number(p.amount) * 100), description: `Ordine ${c.group.number} · ${c.payments.length > 1 ? `scadenza ${p.seq} di ${c.payments.length}` : 'pagamento anticipato'}`, email: c.group.email || null, orderNumber: c.group.number, group: c.group.key, seq: p.seq, successUrl: `${base}?pagato=1&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}?annullato=1` });
		redirect(303, s.url);
	}
	if (!simulationOn()) error(404, 'Il pagamento online non è ancora attivo: usa le istruzioni per il bonifico nella conferma.');
	return { order: { number: c.group.number, customer: c.group.customer, email: c.group.email }, payment: { seq: p.seq, amount: Number(p.amount), method: p.method, of: c.payments.length } };
};

export const actions: Actions = {
	/** solo simulazione: segna la scadenza come pagata e torna alla conferma */
	default: async ({ params }) => {
		const db = adminClient();
		if (!db || !simulationOn()) return fail(400, { error: 'Simulazione non attiva.' });
		const c = await getByToken(db, params.token);
		if (!c) return fail(404, { error: 'Conferma non trovata.' });
		const e = await setPaymentStatus(db, c.group.key, Number(params.seq), 'pagato', null, `SIM-${Date.now().toString(36).toUpperCase()}`, 'simulazione');
		if (e) return fail(400, { error: e });
		redirect(303, `/conferma/${params.token}?pagato=1`);
	}
};
