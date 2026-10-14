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
	/** regolazioni del motore approvate dal cliente (bordo, zoom, sfondo, tracciato): lo studio le rimette uguali */
	engineState?: Record<string, unknown> | null;
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
	segnalaAggiunta(it);
	return it;
}
/** codice anonimo del browser: serve solo a contare i visitatori diversi che aggiungono al carrello */
function visitatore(): string {
	try { let v = localStorage.getItem('sp-vid'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('sp-vid', v); } return v; } catch { return 'sconosciuto'; }
}
/** segnala l'aggiunta alla dashboard (tabella carrello_eventi, letta dalla Panoramica marketing): in sottofondo, mai bloccante */
function segnalaAggiunta(it: CartItem) {
	try {
		const body = JSON.stringify({
			visitatore: visitatore(), prodotto: it.product, nome: it.productName, forma: it.forma, materiale: it.materiale, finitura: it.finitura ?? null,
			larghezza_mm: it.w || null, altezza_mm: it.h || null, qta: it.qty, netto: it.net, lordo: it.gross, promo: it.promoId ?? null, pagina: location.pathname,
			sorgente: it.reorderOf ? 'riordino' : it.product === 'campioni' ? 'campioni' : it.promoId ? 'offerta' : 'configuratore'
		});
		fetch('/api/carrello', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
	} catch { /* niente: il carrello funziona lo stesso */ }
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
