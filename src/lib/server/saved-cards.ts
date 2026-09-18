/**
 * Carte salvate del cliente registrato. I dati della carta stanno su Stripe; nel database c'e' solo
 * l'identificativo del cliente Stripe (tabella stripe_customers, accessibile solo con la chiave di servizio).
 * Senza chiave di servizio o senza Stripe la funzione e' spenta e tutto continua come prima.
 */
import { adminClient } from '$lib/server/admin';
import { createCustomer, detachCard, listCardsRaw, stripeConfigured, type SavedCard } from '$lib/server/stripe';

export const savedCardsOn = () => stripeConfigured() && !!adminClient();

export async function customerIdFor(userId: string): Promise<string | null> {
	const a = adminClient();
	if (!a || !stripeConfigured()) return null;
	const { data } = await a.from('stripe_customers').select('customer_id').eq('user_id', userId).maybeSingle();
	return data?.customer_id ?? null;
}
/** cliente Stripe dell'account: creato al primo pagamento con carta */
export async function ensureCustomer(u: { id: string; email: string | null; name?: string | null }): Promise<string | null> {
	const a = adminClient();
	if (!a || !stripeConfigured()) return null;
	const found = await customerIdFor(u.id);
	if (found) return found;
	const id = await createCustomer({ email: u.email, name: u.name, userId: u.id });
	const { error } = await a.from('stripe_customers').insert({ user_id: u.id, customer_id: id });
	/* due richieste insieme: vince la prima, si rilegge */
	if (error) return (await customerIdFor(u.id)) ?? null;
	return id;
}
/** carte da mostrare: la stessa carta salvata due volte compare una volta sola */
export async function savedCardsFor(userId: string): Promise<SavedCard[]> {
	try {
		const c = await customerIdFor(userId);
		if (!c) return [];
		const seen = new Set<string>();
		return (await listCardsRaw(c)).filter((m) => (seen.has(m.fp) ? false : (seen.add(m.fp), true))).map(({ fp: _fp, ...m }) => m);
	} catch (e) { console.error('[carte salvate]', e); return []; }
}
/** la carta e' davvero di questo cliente? (l'id arriva dal browser) */
export async function ownsCard(userId: string, paymentMethodId: string): Promise<string | null> {
	const c = await customerIdFor(userId);
	if (!c) return null;
	return (await listCardsRaw(c)).some((m) => m.id === paymentMethodId) ? c : null;
}
/** rimuove la carta (e le sue eventuali copie) dal cliente Stripe */
export async function removeCard(userId: string, paymentMethodId: string): Promise<boolean> {
	const c = await customerIdFor(userId);
	if (!c) return false;
	const all = await listCardsRaw(c);
	const hit = all.find((m) => m.id === paymentMethodId);
	if (!hit) return false;
	for (const m of all.filter((x) => x.fp === hit.fp)) await detachCard(m.id);
	return true;
}
