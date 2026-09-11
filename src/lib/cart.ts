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
	promoId?: string; // offerta applicata (il checkout la verifica e usa il suo prezzo)
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
/** totale prodotti nel carrello (IVA inclusa), senza il kit campioni: serve alla barra della spedizione gratuita */
export const cartGross = () => { try { return readCart().filter((i) => i.product !== 'campioni').reduce((a, i) => a + (Number(i.gross) || 0), 0); } catch { return 0; } };
/** richiama cb a ogni cambio del carrello: da questa scheda (sp-cart), da un'altra scheda (storage), al ritorno indietro (pageshow) o al rientro sulla pagina (focus) */
export function onCartChange(cb: () => void): () => void {
	const on = () => cb();
	window.addEventListener('sp-cart', on); window.addEventListener('storage', on); window.addEventListener('pageshow', on); window.addEventListener('focus', on);
	document.addEventListener('visibilitychange', on);
	return () => { window.removeEventListener('sp-cart', on); window.removeEventListener('storage', on); window.removeEventListener('pageshow', on); window.removeEventListener('focus', on); document.removeEventListener('visibilitychange', on); };
}
