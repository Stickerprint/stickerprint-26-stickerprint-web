/**
 * IndexedDB del sito: bozza di configurazione (home → pagina prodotto) e file del carrello.
 * IndexedDB perché i file possono superare i limiti di localStorage.
 */
export interface Draft {
	product: string; // slug del prodotto (es. adesivi_personalizzati)
	forma: string;
	materiale: string;
	file: File;
	preview?: string | null; // data URL PNG dell'anteprima
	widthMm?: number;
	qty?: number;            // dalle offerte: quantità dell'offerta
	lockSize?: boolean;      // dalle offerte: la misura non va ricalcolata dal file
	promo?: { id: string; price: number; qty: number; w: number; h: number }; // prezzo bloccato dell'offerta
	heightMm?: number;
	savedAt: number;
}

const DB = 'stickerprint';
const STORE = 'drafts';
const FILES = 'cartFiles';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 2);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function put(store: string, key: string, value: unknown): Promise<void> {
	return openDb().then(
		(db) =>
			new Promise<void>((resolve, reject) => {
				const tx = db.transaction(store, 'readwrite');
				tx.objectStore(store).put(value, key);
				tx.oncomplete = () => { db.close(); resolve(); };
				tx.onerror = () => { db.close(); reject(tx.error); };
			})
	);
}
function get<T>(store: string, key: string): Promise<T | null> {
	return openDb()
		.then(
			(db) =>
				new Promise<T | null>((resolve, reject) => {
					const req = db.transaction(store, 'readonly').objectStore(store).get(key);
					req.onsuccess = () => { db.close(); resolve((req.result as T) ?? null); };
					req.onerror = () => { db.close(); reject(req.error); };
				})
		)
		.catch(() => null);
}
function del(store: string, key: string): Promise<void> {
	return openDb().then(
		(db) =>
			new Promise<void>((resolve) => {
				const tx = db.transaction(store, 'readwrite');
				tx.objectStore(store).delete(key);
				tx.oncomplete = () => { db.close(); resolve(); };
				tx.onerror = () => { db.close(); resolve(); };
			})
	);
}

export const saveDraft = (draft: Draft) => put(STORE, KEY, draft);
export const loadDraft = () => get<Draft>(STORE, KEY);
export const clearDraft = () => del(STORE, KEY);

/** File del cliente per una riga del carrello (chiave = id della riga) */
export const saveCartFile = (id: string, file: File) => put(FILES, id, file);
export const getCartFile = (id: string) => get<File>(FILES, id);
export const deleteCartFile = (id: string) => Promise.all([del(FILES, id), del(FILES, id + ':preview')]).then(() => {});
/** Anteprima generata dal sistema (PNG con tracciato di taglio) per una riga del carrello */
export const saveCartPreview = (id: string, blob: Blob) => put(FILES, id + ':preview', blob);
export const getCartPreview = (id: string) => get<Blob>(FILES, id + ':preview');
