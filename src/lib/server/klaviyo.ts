/**
 * Klaviyo lato server (API eventi): "Placed Order" al momento dell'ordine, con le proprieta'
 * usate dal sito attuale. Non fa nulla finche' KLAVIYO_PRIVATE_KEY non e' impostata su Vercel.
 */
import { env } from '$env/dynamic/private';

export async function klaviyoPlacedOrder(o: { email: string; firstName?: string; lastName?: string; orderNumber: string; total: number; items: { productId: string; productName: string; price: number; quantity: number }[]; discountCode?: string | null; discountAmount?: number }) {
	const key = env.KLAVIYO_PRIVATE_KEY;
	if (!key || !o.email) return;
	const body = {
		data: { type: 'event', attributes: {
			metric: { data: { type: 'metric', attributes: { name: 'Placed Order' } } },
			profile: { data: { type: 'profile', attributes: { email: o.email, first_name: o.firstName || undefined, last_name: o.lastName || undefined } } },
			value: o.total, unique_id: `order-${o.orderNumber}`, time: new Date().toISOString(),
			properties: { OrderId: o.orderNumber, $value: o.total, Items: o.items.map((i) => ({ ProductID: i.productId, ProductName: i.productName, ItemPrice: i.price, Quantity: i.quantity })), ItemNames: o.items.map((i) => i.productName), DiscountCode: o.discountCode || undefined, DiscountValue: o.discountAmount || 0 }
		} }
	};
	try {
		const r = await fetch('https://a.klaviyo.com/api/events/', { method: 'POST', headers: { Authorization: `Klaviyo-API-Key ${key}`, 'Content-Type': 'application/json', accept: 'application/json', revision: '2024-10-15' }, body: JSON.stringify(body) });
		if (!r.ok) console.error('[klaviyo] Placed Order', r.status, await r.text());
	} catch (e) { console.error('[klaviyo]', e); }
}
