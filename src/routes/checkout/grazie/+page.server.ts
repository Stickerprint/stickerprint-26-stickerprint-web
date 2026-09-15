import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import { adminClient } from '$lib/server/admin';
import { retrieveSession, stripeConfigured } from '$lib/server/stripe';
import { finalizeCheckout, readCheckout, type CheckoutPayload } from '$lib/server/checkout';
import type { PageServerLoad } from './$types';

/**
 * Pagina dopo l'ordine. Con ritorno da Stripe (session_id) verifica l'incasso e, se il webhook non l'ha gia' fatto,
 * chiude l'ordine: fattura, email, produzione. Restituisce i dati per il tracciamento dell'acquisto.
 */
export const load: PageServerLoad = async ({ url, locals: { user } }) => {
	const express = url.searchParams.get('e') === '1';
	const base = { shipDate: formatItDate(estimatedShipDate(express ? 3 : 5)), loggedIn: !!user, paid: null as null | { numbers: string[]; group: string; payload: CheckoutPayload }, pending: false };
	const sid = url.searchParams.get('session_id');
	if (!sid || !stripeConfigured()) return base;
	const db = adminClient();
	if (!db) return base;
	try {
		const s = await retrieveSession(sid);
		if (!s.checkout || !s.group) return base;
		if (!s.paid) return { ...base, pending: true };
		const r = await finalizeCheckout(db, s.group, { provider: 'stripe', ref: s.ref });
		const payload = r.payload ?? (await readCheckout(db, s.group))?.payload ?? null;
		if (!payload) return base;
		return { ...base, paid: { numbers: payload.numbers, group: s.group, payload } };
	} catch (e) {
		console.error('[grazie] stripe', e);
		return base;
	}
};
