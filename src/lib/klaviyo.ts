/**
 * Klaviyo lato browser (script onsite X7Mrme, caricato da $lib/tracking): stessi eventi e stesse
 * proprieta' del sito attuale, cosi' flussi e segmenti gia' costruiti continuano a funzionare.
 * Spento finche' il tracciamento e' spento (vedi trackingOn).
 */
import { browser } from '$app/environment';
import { trackingOn } from './tracking';
import { toCurrency } from './i18n';

declare global { interface Window { klaviyo?: { push: (args: unknown[]) => void } & unknown[] } }
function kl(args: unknown[]) {
	if (!browser || !trackingOn()) return;
	window.klaviyo = window.klaviyo || ([] as unknown as NonNullable<Window['klaviyo']>);
	window.klaviyo.push(args);
}
/** lingua della pagina (it/es/fr/de/nl/en) e prefisso del sito: proprieta' di profilo `lingua`/`sito` su Klaviyo, per segmenti e flussi in lingua */
function linguaPagina(): Record<string, string> {
	if (!browser) return {};
	const lang = (document.documentElement.lang || 'it').slice(0, 2);
	const m = location.pathname.match(/^\/(es|fr|de|nl|us)(?=\/|$)/);
	return { lingua: lang, sito: m ? m[1] : 'it' };
}
/** importi nella valuta del cliente: sul sito /us i dollari del listino (le email di Klaviyo mostrano "$"), altrove euro */
function inValuta(eur: number): number { return linguaPagina().sito === 'us' ? toCurrency(eur, 'USD') : eur; }
export const klaviyo = {
	identify(email: string, extra: Record<string, unknown> = {}) { if (email) kl(['identify', { email, ...linguaPagina(), ...extra }]); },
	addedToCart(i: { productId: string; productName: string; quantity: number; dimension: string; material: string; price: number; imageUrl?: string }) {
		kl(['track', 'Added to Cart', { $value: inValuta(i.price), Currency: linguaPagina().sito === 'us' ? 'USD' : 'EUR', AddedItemProductName: i.productName, AddedItemProductID: i.productId, AddedItemQuantity: i.quantity, AddedItemDimension: i.dimension, AddedItemMaterial: i.material, AddedItemPrice: i.price, AddedItemImageURL: i.imageUrl ?? '', ItemNames: [i.productName], CheckoutURL: `${location.origin}/checkout` }]);
	},
	startedCheckout(items: { productId: string; productName: string; quantity: number; price: number }[]) {
		const value = Math.round(items.reduce((a, i) => a + inValuta(i.price), 0) * 100) / 100;
		kl(['track', 'Started Checkout', { $value: value, Currency: linguaPagina().sito === 'us' ? 'USD' : 'EUR', Items: items.map((i) => ({ ItemPrice: inValuta(i.price), ProductID: i.productId, ProductName: i.productName, Quantity: i.quantity })), ItemNames: items.map((i) => i.productName), CheckoutURL: `${location.origin}/checkout` }]);
	}
};
