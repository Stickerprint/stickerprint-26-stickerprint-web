import { json } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { applyPayPalCapture, capturePayPalOrder, getPayPalOrder, paypalConfigured } from '$lib/server/paypal';
import type { RequestHandler } from './$types';

/**
 * Webhook PayPal (rete di sicurezza se il cliente non torna sul sito): il contenuto ricevuto non viene creduto,
 * l'ordine viene riletto da PayPal e, se approvato, catturato e applicato.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!paypalConfigured()) return json({ ignored: 'non configurato' });
	const ev = (await request.json().catch(() => null)) as { event_type?: string; resource?: Record<string, unknown> } | null;
	if (!ev?.resource) return json({ ignored: 'vuoto' });
	const type = ev.event_type ?? '';
	let orderId: string | null = null;
	if (type === 'CHECKOUT.ORDER.APPROVED' || type === 'CHECKOUT.ORDER.COMPLETED') orderId = String(ev.resource.id ?? '');
	else if (type === 'PAYMENT.CAPTURE.COMPLETED') orderId = String(((ev.resource.supplementary_data as Record<string, Record<string, string>> | undefined)?.related_ids?.order_id) ?? '');
	if (!orderId || !/^[A-Z0-9]{5,40}$/.test(orderId)) return json({ ignored: type });
	const db = adminClient();
	if (!db) return json({ error: 'db' }, { status: 503 });
	try {
		let o = await getPayPalOrder(orderId);
		if (o.status === 'APPROVED') o = await capturePayPalOrder(orderId);
		if (o.status !== 'COMPLETED') return json({ ignored: o.status });
		const e = await applyPayPalCapture(db, o);
		return e ? json({ error: e }, { status: 500 }) : json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'errore' }, { status: 500 });
	}
};
