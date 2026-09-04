/**
 * Carrello nel browser: la configurazione sta in localStorage, il file del cliente
 * in IndexedDB (vedi draftStore.saveCartFile). Al checkout i file vengono caricati su Storage.
 */
export interface CartItem {
	id: string;
	product: string; // slug (es. adesivi_personalizzati)
	productName: string;
	engineProduct?: 'sticker' | 'resinati';
	forma: string;
	materiale: string;
	finitura?: string;
	w: number;
	h: number;
	qty: number;
	net: number; // imponibile
	gross: number; // IVA inclusa
	fileName?: string | null;
	filePath?: string | null; // file già su Storage (riordino di un ordine precedente)
	previewUrl?: string | null; // anteprima generata dal sistema già pubblicata (riordino)
	reorderOf?: string | null;
	note?: string;
	addedAt: number;
}

const KEY = 'sp-cart';

function emit(items: CartItem[]) {
	window.dispatchEvent(new CustomEvent('sp-cart', { detail: items.length }));
}
export function readCart(): CartItem[] {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		return [];
	}
}
export function addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): CartItem {
	const items = readCart();
	const it: CartItem = { ...item, id: crypto.randomUUID(), addedAt: Date.now() };
	items.push(it);
	localStorage.setItem(KEY, JSON.stringify(items));
	emit(items);
	return it;
}
export function updateCartItem(id: string, patch: Partial<CartItem>): CartItem[] {
	const items = readCart().map((i) => (i.id === id ? { ...i, ...patch } : i));
	localStorage.setItem(KEY, JSON.stringify(items));
	emit(items);
	return items;
}
export function removeFromCart(id: string): CartItem[] {
	const items = readCart().filter((i) => i.id !== id);
	localStorage.setItem(KEY, JSON.stringify(items));
	emit(items);
	return items;
}
export function clearCart() {
	localStorage.removeItem(KEY);
	emit([]);
}
export const cartCount = () => readCart().length;
