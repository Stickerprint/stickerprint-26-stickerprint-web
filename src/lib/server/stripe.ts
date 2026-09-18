/**
 * Stripe Checkout via REST (nessuna dipendenza): sessione di pagamento per una scadenza, verifica del webhook.
 * Con PAYMENT_SIMULATION=on e senza chiave, il sito mostra un pagamento simulato per provare il percorso.
 */
import { env } from '$env/dynamic/private';

export const stripeConfigured = () => !!env.STRIPE_SECRET_KEY;
export const simulationOn = () => !stripeConfigured() && env.PAYMENT_SIMULATION === 'on';
export const onlinePaymentsOn = () => stripeConfigured() || simulationOn();

const API = 'https://api.stripe.com/v1';
function form(obj: Record<string, string | number | undefined>): string {
	return Object.entries(obj).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}
async function call(path: string, body?: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
	const r = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body ? form(body) : undefined });
	const j = (await r.json()) as Record<string, unknown>;
	if (!r.ok) throw new Error((j.error as { message?: string })?.message ?? `Stripe ${r.status}`);
	return j;
}

/** Sessione Checkout per una scadenza: importo in centesimi, ritorno alla pagina della conferma */
export async function createCheckoutSession(o: { amountCents: number; description: string; email: string | null; orderNumber: string; group: string; seq: number; successUrl: string; cancelUrl: string; invoice?: string | null; checkout?: boolean; methods?: string[] }): Promise<{ id: string; url: string }> {
	const only = Object.fromEntries((o.methods ?? []).map((m, i) => [`payment_method_types[${i}]`, m]));
	const s = await call('/checkout/sessions', {
		...only,
		mode: 'payment',
		'line_items[0][quantity]': 1,
		'line_items[0][price_data][currency]': 'eur',
		'line_items[0][price_data][unit_amount]': o.amountCents,
		'line_items[0][price_data][product_data][name]': o.description,
		customer_email: o.email ?? undefined,
		client_reference_id: `${o.group}:${o.seq}`,
		'metadata[group]': o.group, 'metadata[seq]': o.seq, 'metadata[order]': o.orderNumber, 'metadata[invoice]': o.invoice ?? undefined, 'metadata[checkout]': o.checkout ? '1' : undefined,
		'payment_intent_data[description]': o.checkout ? `Ordine ${o.orderNumber} (sito)` : `Ordine ${o.orderNumber} · scadenza ${o.seq}`,
		'payment_intent_data[metadata][order]': o.orderNumber,
		success_url: o.successUrl, cancel_url: o.cancelUrl, locale: 'it'
	});
	return { id: String(s.id), url: String(s.url) };
}
export async function retrieveSession(id: string): Promise<{ paid: boolean; group: string | null; seq: number | null; ref: string | null; invoice: string | null; checkout: boolean; order: string | null }> {
	const s = await call(`/checkout/sessions/${encodeURIComponent(id)}`);
	const md = (s.metadata ?? {}) as Record<string, string>;
	return { paid: s.payment_status === 'paid', group: md.group ?? null, seq: md.seq ? Number(md.seq) : null, ref: typeof s.payment_intent === 'string' ? s.payment_intent : null, invoice: md.invoice ?? null, checkout: md.checkout === '1', order: md.order ?? null };
}
/** Firma del webhook (Stripe-Signature: t=…,v1=…), HMAC SHA-256 con WebCrypto */
export async function verifyWebhook(payload: string, header: string | null): Promise<boolean> {
	const secret = env.STRIPE_WEBHOOK_SECRET;
	if (!secret || !header) return false;
	const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
	const t = parts.t, v1 = parts.v1;
	if (!t || !v1) return false;
	if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
	const expected = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
	if (expected.length !== v1.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
	return diff === 0;
}
/** Chiude una sessione Checkout ancora aperta (ordine annullato o scaduto): il cliente non puo' piu' pagarla */
export async function expireCheckoutSession(id: string): Promise<void> {
	try { await call(`/checkout/sessions/${encodeURIComponent(id)}/expire`, {}); } catch { /* gia' chiusa o scaduta */ }
}

/** PaymentIntent per la carta inserita sul sito (Card Element) o per i wallet (Express Checkout): niente cassa esterna */
export async function createPaymentIntent(o: { amountCents: number; description: string; email: string | null; orderNumber: string; group: string; seq: number; customer?: string | null; saveCard?: boolean; paymentMethod?: string | null }): Promise<{ id: string; clientSecret: string }> {
	const s = await call('/payment_intents', {
		/* carta salvata: il pagamento e' legato al cliente Stripe; con saveCard la carta nuova resta agganciata al cliente
		   dopo il pagamento riuscito (uso futuro con il cliente presente: 3D Secure quando la banca lo chiede) */
		customer: o.customer ?? undefined,
		setup_future_usage: o.customer && o.saveCard && !o.paymentMethod ? 'on_session' : undefined,
		payment_method: o.customer && o.paymentMethod ? o.paymentMethod : undefined,
		amount: o.amountCents, currency: 'eur', description: o.description, receipt_email: undefined,
		'automatic_payment_methods[enabled]': 'true', 'automatic_payment_methods[allow_redirects]': 'never',
		'metadata[group]': o.group, 'metadata[seq]': o.seq, 'metadata[order]': o.orderNumber, 'metadata[checkout]': '1', 'metadata[email]': o.email ?? undefined
	});
	return { id: String(s.id), clientSecret: String(s.client_secret) };
}
export async function retrievePaymentIntent(id: string): Promise<{ paid: boolean; status: string; group: string | null; checkout: boolean; order: string | null }> {
	const s = await call(`/payment_intents/${encodeURIComponent(id)}`);
	const md = (s.metadata ?? {}) as Record<string, string>;
	return { paid: s.status === 'succeeded', status: String(s.status ?? ''), group: md.group ?? null, checkout: md.checkout === '1', order: md.order ?? null };
}
export async function cancelPaymentIntent(id: string): Promise<void> {
	try { await call(`/payment_intents/${encodeURIComponent(id)}/cancel`, {}); } catch { /* gia' pagato o annullato */ }
}

/* ---------- carte salvate: cliente Stripe dell'account, elenco e rimozione ---------- */
export type SavedCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number };
export async function createCustomer(o: { email: string | null; name?: string | null; userId: string }): Promise<string> {
	const c = await call('/customers', { email: o.email ?? undefined, name: o.name ?? undefined, 'metadata[user_id]': o.userId });
	return String(c.id);
}
/** tutte le carte del cliente, comprese le doppie (stessa carta salvata due volte): fp e' l'impronta della carta */
export async function listCardsRaw(customerId: string): Promise<(SavedCard & { fp: string })[]> {
	const r = await call(`/payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=30`);
	const rows = (r.data ?? []) as { id: string; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number; fingerprint?: string } }[];
	return rows.map((m) => ({ id: m.id, fp: m.card?.fingerprint ?? m.id, brand: m.card?.brand ?? 'card', last4: m.card?.last4 ?? '', expMonth: m.card?.exp_month ?? 0, expYear: m.card?.exp_year ?? 0 }));
}
export async function detachCard(paymentMethodId: string): Promise<void> {
	await call(`/payment_methods/${encodeURIComponent(paymentMethodId)}/detach`, {});
}
