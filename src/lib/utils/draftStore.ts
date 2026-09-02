/**
 * Bozza di configurazione salvata nel browser (IndexedDB) tra la home e la
 * pagina prodotto: file del cliente, sagoma, materiale, istantanea dell'anteprima.
 * IndexedDB perché i file possono superare i limiti di localStorage.
 */
export interface Draft {
	product: 'adesivi_personalizzati' | 'adesivi_resinati' | 'etichette';
	forma: string;
	materiale: string;
	file: File;
	preview?: string | null; // data URL PNG dell'anteprima
	widthMm?: number;
	heightMm?: number;
	savedAt: number;
}

const DB = 'stickerprint';
const STORE = 'drafts';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveDraft(draft: Draft): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(draft, KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function loadDraft(): Promise<Draft | null> {
	try {
		const db = await openDb();
		const draft = await new Promise<Draft | null>((resolve, reject) => {
			const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
			req.onsuccess = () => resolve((req.result as Draft) ?? null);
			req.onerror = () => reject(req.error);
		});
		db.close();
		return draft;
	} catch {
		return null;
	}
}

export async function clearDraft(): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(KEY);
		tx.oncomplete = () => resolve();
	});
	db.close();
}
