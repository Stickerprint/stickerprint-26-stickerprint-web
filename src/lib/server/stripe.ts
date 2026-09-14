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
export async function createCheckoutSession(o: { amountCents: number; description: string; email: string | null; orderNumber: string; group: string; seq: number; successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }> {
	const s = await call('/checkout/sessions', {
		mode: 'payment',
		'line_items[0][quantity]': 1,
		'line_items[0][price_data][currency]': 'eur',
		'line_items[0][price_data][unit_amount]': o.amountCents,
		'line_items[0][price_data][product_data][name]': o.description,
		customer_email: o.email ?? undefined,
		client_reference_id: `${o.group}:${o.seq}`,
		'metadata[group]': o.group, 'metadata[seq]': o.seq, 'metadata[order]': o.orderNumber,
		'payment_intent_data[description]': `Ordine ${o.orderNumber} · scadenza ${o.seq}`,
		success_url: o.successUrl, cancel_url: o.cancelUrl, locale: 'it'
	});
	return { id: String(s.id), url: String(s.url) };
}
export async function retrieveSession(id: string): Promise<{ paid: boolean; group: string | null; seq: number | null; ref: string | null }> {
	const s = await call(`/checkout/sessions/${encodeURIComponent(id)}`);
	const md = (s.metadata ?? {}) as Record<string, string>;
	return { paid: s.payment_status === 'paid', group: md.group ?? null, seq: md.seq ? Number(md.seq) : null, ref: typeof s.payment_intent === 'string' ? s.payment_intent : null };
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
