/**
 * Klaviyo lato browser (script onsite X7Mrme, caricato da $lib/tracking): stessi eventi e stesse
 * proprieta' del sito attuale, cosi' flussi e segmenti gia' costruiti continuano a funzionare.
 * Spento finche' il tracciamento e' spento (vedi trackingOn).
 */
import { browser } from '$app/environment';
import { trackingOn } from './tracking';

declare global { interface Window { klaviyo?: { push: (args: unknown[]) => void } & unknown[] } }
function kl(args: unknown[]) {
	if (!browser || !trackingOn()) return;
	window.klaviyo = window.klaviyo || ([] as unknown as NonNullable<Window['klaviyo']>);
	window.klaviyo.push(args);
}
export const klaviyo = {
	identify(email: string, extra: Record<string, unknown> = {}) { if (email) kl(['identify', { email, ...extra }]); },
	addedToCart(i: { productId: string; productName: string; quantity: number; dimension: string; material: string; price: number; imageUrl?: string }) {
		kl(['track', 'Added to Cart', { $value: i.price, AddedItemProductName: i.productName, AddedItemProductID: i.productId, AddedItemQuantity: i.quantity, AddedItemDimension: i.dimension, AddedItemMaterial: i.material, AddedItemPrice: i.price, AddedItemImageURL: i.imageUrl ?? '', ItemNames: [i.productName], CheckoutURL: `${location.origin}/checkout` }]);
	},
	startedCheckout(items: { productId: string; productName: string; quantity: number; price: number }[]) {
		const value = Math.round(items.reduce((a, i) => a + i.price, 0) * 100) / 100;
		kl(['track', 'Started Checkout', { $value: value, Items: items.map((i) => ({ ItemPrice: i.price, ProductID: i.productId, ProductName: i.productName, Quantity: i.quantity })), ItemNames: items.map((i) => i.productName), CheckoutURL: `${location.origin}/checkout` }]);
	}
};
