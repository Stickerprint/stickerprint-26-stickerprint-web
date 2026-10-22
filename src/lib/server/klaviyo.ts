/**
 * Klaviyo lato server (API eventi): "Placed Order" al momento dell'ordine, con le proprieta'
 * usate dal sito attuale. Non fa nulla finche' KLAVIYO_PRIVATE_KEY non e' impostata su Vercel.
 */
import { env } from '$env/dynamic/private';

export async function klaviyoPlacedOrder(o: { email: string; firstName?: string; lastName?: string; lingua?: string; sito?: string; paese?: string; orderNumber: string; total: number; items: { productId: string; productName: string; price: number; quantity: number }[]; discountCode?: string | null; discountAmount?: number }) {
	const key = env.KLAVIYO_PRIVATE_KEY;
	if (!key || !o.email) return;
	const body = {
		data: { type: 'event', attributes: {
			metric: { data: { type: 'metric', attributes: { name: 'Placed Order' } } },
			profile: { data: { type: 'profile', attributes: { email: o.email, first_name: o.firstName || undefined, last_name: o.lastName || undefined, location: o.paese ? { country: o.paese } : undefined, properties: o.lingua ? { lingua: o.lingua, sito: o.sito ?? undefined, paese: o.paese ?? undefined } : undefined } } },
			value: o.total, unique_id: `order-${o.orderNumber}`, time: new Date().toISOString(),
			properties: { OrderId: o.orderNumber, $value: o.total, Items: o.items.map((i) => ({ ProductID: i.productId, ProductName: i.productName, ItemPrice: i.price, Quantity: i.quantity })), ItemNames: o.items.map((i) => i.productName), DiscountCode: o.discountCode || undefined, DiscountValue: o.discountAmount || 0 }
		} }
	};
	try {
		const r = await fetch('https://a.klaviyo.com/api/events/', { method: 'POST', headers: { Authorization: `Klaviyo-API-Key ${key}`, 'Content-Type': 'application/json', accept: 'application/json', revision: '2024-10-15' }, body: JSON.stringify(body) });
		if (!r.ok) console.error('[klaviyo] Placed Order', r.status, await r.text());
	} catch (e) { console.error('[klaviyo]', e); }
}

/**
 * Iscrizione alla lista Klaviyo "Contatti Popup" (RBFVRm, trigger del flusso di benvenuto) con la lingua del sito:
 * usata dal popup in lingua del sito e dal modulo newsletter del footer. Consenso email esplicito (il cliente ha
 * inserito l'email in un modulo nostro). Senza chiave privata non fa nulla.
 */
export async function klaviyoIscrivi(o: { email: string; lingua: string; sito: string; paese?: string | null; fonte: string; listId?: string }): Promise<boolean> {
	const key = env.KLAVIYO_PRIVATE_KEY;
	if (!key || !o.email) return false;
	const body = {
		data: { type: 'profile-subscription-bulk-create-job', attributes: {
			custom_source: o.fonte,
			profiles: { data: [{ type: 'profile', attributes: {
				email: o.email,
				properties: { lingua: o.lingua, sito: o.sito, ...(o.paese ? { paese: o.paese } : {}) },
				subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } }
			} }] }
		}, relationships: { list: { data: { type: 'list', id: o.listId ?? env.KLAVIYO_LIST_POPUP ?? 'RBFVRm' } } } }
	};
	try {
		const r = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', { method: 'POST', headers: { Authorization: `Klaviyo-API-Key ${key}`, 'Content-Type': 'application/json', accept: 'application/json', revision: '2024-10-15' }, body: JSON.stringify(body) });
		if (!r.ok) { console.error('[klaviyo] iscrizione', r.status, await r.text()); return false; }
		return true;
	} catch (e) { console.error('[klaviyo] iscrizione', e); return false; }
}
