/**
 * PayPal diretto (Orders API v2 via REST, nessuna dipendenza): il cliente viene mandato su PayPal con il suo conto,
 * al ritorno l'ordine viene catturato dal server. Il webhook fa da rete di sicurezza: non si fida del contenuto
 * ricevuto ma rilegge l'ordine da PayPal prima di agire.
 * Variabili: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV (sandbox | live).
 */
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkoutPending, finalizeCheckout } from './checkout';
import { setPaymentStatus } from './conferme';
import { setInvoicePaymentStatus } from './fatture';

export const paypalConfigured = () => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET);
const base = () => (env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

let cached: { token: string; exp: number } | null = null;
async function token(): Promise<string> {
	if (cached && cached.exp > Date.now() + 60_000) return cached.token;
	const r = await fetch(`${base()}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
	const j = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
	if (!r.ok || !j.access_token) throw new Error(j.error_description ?? `PayPal ${r.status}`);
	cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
	return cached.token;
}
async function call(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<Record<string, unknown>> {
	const r = await fetch(`${base()}${path}`, { method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
	const text = await r.text();
	const j = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
	if (!r.ok) {
		const det = (j.details as { issue?: string; description?: string }[] | undefined)?.[0];
		throw new Error(det?.description ?? det?.issue ?? String(j.message ?? `PayPal ${r.status}`));
	}
	return j;
}

/** custom_id: "checkout:<gruppo>" (ordine del sito), "order:<gruppo>:<seq>" (conferma), "invoice:<id>:<seq>" (fattura) */
export async function createPayPalOrder(o: { amount: number; description: string; reference: string; customId: string; returnUrl: string; cancelUrl: string }): Promise<{ id: string; approveUrl: string }> {
	const j = await call('/v2/checkout/orders', {
		intent: 'CAPTURE',
		purchase_units: [{ reference_id: o.reference, custom_id: o.customId, invoice_id: undefined, description: o.description.slice(0, 127), amount: { currency_code: 'EUR', value: o.amount.toFixed(2) } }],
		payment_source: { paypal: { experience_context: { brand_name: 'Stickerprint', locale: 'it-IT', landing_page: 'LOGIN', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: o.returnUrl, cancel_url: o.cancelUrl } } }
	});
	const links = (j.links ?? []) as { rel: string; href: string }[];
	const approve = links.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
	if (!approve) throw new Error('PayPal non ha restituito il link di pagamento.');
	return { id: String(j.id), approveUrl: approve };
}
interface OrderInfo { id: string; status: string; customId: string | null; captureId: string | null; captureStatus: string | null }
function info(j: Record<string, unknown>): OrderInfo {
	const pu = ((j.purchase_units ?? []) as Record<string, unknown>[])[0] ?? {};
	const cap = (((pu.payments as Record<string, unknown> | undefined)?.captures ?? []) as { id: string; status: string; custom_id?: string }[])[0];
	return { id: String(j.id), status: String(j.status ?? ''), customId: (cap?.custom_id ?? (pu.custom_id as string | undefined)) ?? null, captureId: cap?.id ?? null, captureStatus: cap?.status ?? null };
}
export const getPayPalOrder = async (id: string): Promise<OrderInfo> => info(await call(`/v2/checkout/orders/${encodeURIComponent(id)}`));
/** Cattura (incasso) dell'ordine approvato dal cliente; se e' gia' catturato restituisce lo stato attuale */
export async function capturePayPalOrder(id: string): Promise<OrderInfo> {
	try {
		return info(await call(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}));
	} catch (e) {
		const cur = await getPayPalOrder(id);
		if (cur.status === 'COMPLETED') return cur;
		throw e;
	}
}

/** Applica un incasso PayPal completato alla cosa giusta (ordine del sito, scadenza di conferma o di fattura) */
export async function applyPayPalCapture(db: SupabaseClient, o: OrderInfo): Promise<string | null> {
	if (o.status !== 'COMPLETED' || (o.captureStatus && o.captureStatus !== 'COMPLETED' && o.captureStatus !== 'PENDING')) return 'Pagamento non completato.';
	const ref = o.captureId ?? o.id;
	const [kind, a, b] = (o.customId ?? '').split(':');
	if (kind === 'checkout' && a) { await finalizeCheckout(db, a, { provider: 'paypal', ref }); return null; }
	if (kind === 'order' && a && b) return setPaymentStatus(db, a, Number(b), 'pagato', null, ref, 'paypal');
	if (kind === 'invoice' && a && b) return setInvoicePaymentStatus(db, a, Number(b), 'pagato', null, ref, 'paypal');
	return 'Riferimento PayPal non riconosciuto.';
}
/** Si puo' ancora incassare? Un checkout annullato o scaduto e una scadenza gia' pagata non si catturano */
export async function canCapture(db: SupabaseClient, customId: string | null): Promise<boolean> {
	const [kind, a, b] = (customId ?? '').split(':');
	if (kind === 'checkout' && a) return checkoutPending(db, a);
	if (kind === 'order' && a && b) { const { data } = await db.from('order_payments').select('status').eq('checkout_group', a).eq('seq', Number(b)).maybeSingle(); return data?.status === 'da_pagare'; }
	if (kind === 'invoice' && a && b) { const { data } = await db.from('invoice_payments').select('status').eq('invoice_id', a).eq('seq', Number(b)).maybeSingle(); return data?.status === 'da_pagare'; }
	return false;
}
/** Ritorno dal sito PayPal (?token=ID): cattura e applica. Restituisce l'esito per la pagina. */
export async function settlePayPalReturn(db: SupabaseClient, orderId: string, expectPrefix: string): Promise<{ ok: boolean; error?: string; customId: string | null }> {
	try {
		const cur = await getPayPalOrder(orderId);
		if (!cur.customId?.startsWith(expectPrefix)) return { ok: false, error: 'Pagamento non riconosciuto.', customId: cur.customId };
		if (cur.status !== 'COMPLETED' && !(await canCapture(db, cur.customId))) return { ok: false, error: 'Questo ordine è stato annullato o è scaduto: torna al carrello e rifai l’ordine.', customId: cur.customId };
		const done = cur.status === 'COMPLETED' ? cur : await capturePayPalOrder(orderId);
		const e = await applyPayPalCapture(db, done);
		return e ? { ok: false, error: e, customId: done.customId } : { ok: true, customId: done.customId };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Errore PayPal', customId: null };
	}
}
