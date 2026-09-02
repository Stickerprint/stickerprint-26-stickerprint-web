/**
 * Carrello minimo nel browser (localStorage). Il carrello vero, con checkout,
 * arriverà con lo step successivo: questo serve a non perdere la configurazione.
 */
export interface CartItem {
	id: string;
	product: string;
	forma: string;
	materiale: string;
	w: number;
	h: number;
	qty: number;
	gross: number;
	fileName?: string | null;
	note?: string;
	addedAt: number;
}

const KEY = 'sp-cart';

export function readCart(): CartItem[] {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		return [];
	}
}

export function addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): CartItem[] {
	const items = readCart();
	items.push({ ...item, id: crypto.randomUUID(), addedAt: Date.now() });
	localStorage.setItem(KEY, JSON.stringify(items));
	window.dispatchEvent(new CustomEvent('sp-cart', { detail: items.length }));
	return items;
}
