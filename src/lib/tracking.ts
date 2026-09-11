/**
 * Tracciamento (GTM + dataLayer) del sito, riprodotto dal sito attuale stickerprint.it.
 * Contenitore GTM-PXKJS5J6 e struttura degli eventi: docs/tracking/tracciamento-vecchio-sito.md.
 *
 * SPENTO di default. Si accende SOLO se:
 *   1. la variabile pubblica PUBLIC_TRACKING vale "on" (su Vercel), e
 *   2. il sito gira su stickerprint.it (o www).
 * Cosi' le prove su meett.it / vercel.app non mandano niente ad Analytics, Ads, Meta, Clarity, Klaviyo.
 */
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export const GTM_ID = 'GTM-PXKJS5J6';
export const KLAVIYO_COMPANY_ID = 'X7Mrme';
const HOSTS = new Set(['stickerprint.it', 'www.stickerprint.it']);

/** vero solo in produzione con l'interruttore acceso */
export function trackingOn(hostname?: string): boolean {
	if (env.PUBLIC_TRACKING !== 'on') return false;
	const h = hostname ?? (browser ? location.hostname : '');
	return HOSTS.has(h);
}

/** snippet da mettere in <head> (identico al sito attuale) */
export const GTM_HEAD = `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');</script><script async src="https://static.klaviyo.com/onsite/js/${KLAVIYO_COMPANY_ID}/klaviyo.js"></script>`;
export const GTM_BODY = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

type DL = Record<string, unknown>;
declare global { interface Window { dataLayer?: DL[] } }

function push(ev: DL, ecommerce = false) {
	if (!browser || !trackingOn()) return;
	window.dataLayer = window.dataLayer || [];
	if (ecommerce) window.dataLayer.push({ ecommerce: null });
	window.dataLayer.push(ev);
}

export type UserProps = { logged_in: boolean; user_id: string | null };
const up = (userId?: string | null): UserProps => ({ logged_in: !!userId, user_id: userId ?? null });

/** un articolo nel formato del sito attuale (item_id = prodotto_forma, misura, materiale, lamina) */
export interface ItemIn { product: string; productName: string; forma: string; w: number; h: number; materiale?: string; finitura?: string | null; qty: number; gross: number; index?: number }
export function itemOf(i: ItemIn) {
	const qty = Math.max(1, Number(i.qty) || 1);
	const cat = i.product === 'campioni' ? 'Campioni' : i.product === 'kit_adesivi' ? 'Kit di adesivi' : i.productName;
	return {
		item_id: `${i.product}_${i.forma}`,
		item_name: `${i.productName} ${i.forma}`.trim(),
		item_brand: 'Sticker Print',
		item_category: cat,
		item_size: `${i.w} x ${i.h} mm`,
		item_variant: i.materiale ?? null,
		item_variant2: i.finitura && i.finitura !== 'nessuna' ? i.finitura : null,
		...(i.index !== undefined ? { index: i.index } : {}),
		price: Math.round((i.gross / qty) * 100) / 100,
		quantity: qty
	};
}
const total = (items: ItemIn[]) => Math.round(items.reduce((a, i) => a + (Number(i.gross) || 0), 0) * 100) / 100;

export const track = {
	pageView(userId?: string | null) {
		push({ event: 'custom_page_view', page_location: location.href, page_title: document.title, user_properties: up(userId) });
	},
	login(userId: string) { push({ event: 'login', user_properties: up(userId) }); },
	signUp(userId: string | null, confirmed: boolean) { push({ event: 'sign_up', user_properties: { logged_in: confirmed, user_id: userId } }); },
	viewItemList(items: ItemIn[], listName: string) {
		push({ event: 'view_item_list', ecommerce: { item_list_name: listName, items: items.map((i, k) => itemOf({ ...i, index: k })) } }, true);
	},
	viewItem(i: ItemIn) { push({ event: 'view_item', ecommerce: { currency: 'EUR', value: total([i]), items: [itemOf(i)] } }, true); },
	addToCart(i: ItemIn) { push({ event: 'add_to_cart', ecommerce: { currency: 'EUR', value: total([i]), items: [itemOf(i)] } }, true); },
	removeFromCart(i: ItemIn) { push({ event: 'remove_from_cart', ecommerce: { currency: 'EUR', value: total([i]), items: [itemOf(i)] } }, true); },
	viewCart(items: ItemIn[]) { push({ event: 'view_cart', ecommerce: { currency: 'EUR', value: total(items), items: items.map((i, k) => itemOf({ ...i, index: k })) } }, true); },
	beginCheckout(items: ItemIn[]) { push({ event: 'begin_checkout', ecommerce: { currency: 'EUR', value: total(items), items: items.map((i, k) => itemOf({ ...i, index: k })) } }, true); },
	addContactInfo(items: ItemIn[], coupon?: string | null) { push({ event: 'add_contact_info', ecommerce: { currency: 'EUR', value: total(items), coupon: coupon || null, items: items.map(itemOf) } }, true); },
	addPaymentInfo(items: ItemIn[], paymentType: string, coupon?: string | null) { push({ event: 'add_payment_info', ecommerce: { currency: 'EUR', value: total(items), coupon: coupon || null, payment_type: paymentType, items: items.map(itemOf) } }, true); },
	purchase(o: { orderNumber: string; items: ItemIn[]; value: number; tax: number; paymentType: string; express: boolean; coupon?: string | null; discount: number; returning: boolean; userId?: string | null; orderCount?: number; lifetimeValue?: number; user: { email: string; phone: string; first_name: string; last_name: string; street: string; city: string; province: string; zip: string } }) {
		const lc = (s: string) => (s || '').toLowerCase().trim() || null;
		push({
			event: 'purchase',
			ecommerce: { transaction_id: o.orderNumber, value: o.value, tax: o.tax, currency: 'EUR', payment_type: o.paymentType, shipping_tier: o.express ? 'Express' : 'Spedizione Gratuita', coupon: o.coupon || null, discount: o.discount, customer_type: o.returning ? 'returning' : 'new', items: o.items.map((i, k) => itemOf({ ...i, index: k })) },
			user_data: { email: lc(o.user.email), phone_number: o.user.phone || null, address: { first_name: lc(o.user.first_name), last_name: lc(o.user.last_name), street: lc(o.user.street), city: lc(o.user.city), region: lc(o.user.province), postal_code: o.user.zip || null, country: 'IT' } },
			user_properties: { ...up(o.userId), order_total_count: o.orderCount ?? 1, life_time_value: o.lifetimeValue ?? o.value }
		}, true);
	},
	fileUpload(ok: boolean, f: { name: string; size: number }, value: number, error?: { code: string; message: string }) {
		const ext = (f.name.split('.').pop() ?? '').toLowerCase();
		push({ event: ok ? 'file_uploads_ok' : 'file_uploads_ko', file_data: { file_name: f.name, file_extension: ext, file_size: f.size, file_id: ok ? `upl_${Date.now()}` : 'upl_error' }, value, ...(error ? { error_details: { error_code: error.code, error_message: error.message } } : {}) }, true);
	},
	generateLead(formName: string) { push({ event: 'generate_lead', form_name: formName }); }
};

/** ordine del carrello → articoli per gli eventi (kit e campioni compresi) */
export function cartItems(items: { product: string; productName: string; forma: string; w: number; h: number; materiale?: string; finitura?: string | null; qty: number; gross: number }[]): ItemIn[] {
	return items.map((i) => ({ product: i.product, productName: i.productName, forma: i.forma, w: i.w, h: i.h, materiale: i.materiale, finitura: i.finitura ?? null, qty: i.qty, gross: i.gross }));
}
