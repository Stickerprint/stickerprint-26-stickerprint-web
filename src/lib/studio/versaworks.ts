/**
 * Stickerprint Studio — invio della striscia alle Roland (VersaWorks 7).
 *
 * VersaWorks tiene per ogni stampante una cartella di ingresso per coda:
 *   Utenti/Condivisa/Roland DG VersaWorks7/Printers/<STAMPANTE>/Input-A
 * Un PDF lasciato li' dentro diventa un lavoro nella coda A di quella stampante, con le impostazioni
 * della coda (materiale, qualita', profilo). Il lavoro resta in coda: stampa quando lo dice l'operatore.
 * Provato il 24/09/2026 sulla SG3-300#2 con due strisce vere.
 *
 * Qui si sceglie UNA volta la cartella "Printers" e lo studio scrive nella stampante giusta.
 */
export type VwDir = FileSystemDirectoryHandle;

type PermDir = FileSystemDirectoryHandle & {
	queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
	requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
};

const DB = 'sp-studio', STORE = 'kv', KEY = 'versaworks-dir', KEY_MAP = 'versaworks-map';
/** la coda che usiamo (Mattia, 24/09/2026): sempre la A */
export const CODA = 'Input-A';

function idb(): Promise<IDBDatabase> {
	return new Promise((ok, ko) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => ok(r.result);
		r.onerror = () => ko(r.error);
	});
}
async function put(key: string, v: unknown) {
	const d = await idb();
	await new Promise<void>((ok, ko) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, key); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); });
}
async function get<T>(key: string): Promise<T | undefined> {
	const d = await idb();
	return new Promise((ok, ko) => { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => ok(r.result as T); r.onerror = () => ko(r.error); });
}

/** chiede la cartella "Printers" di VersaWorks (una volta) e la ricorda */
export async function pickVersaworks(): Promise<VwDir> {
	const w = window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> };
	if (!w.showDirectoryPicker) throw new Error('Questo browser non può scrivere nelle cartelle: usa Chrome, oppure scarica il PDF e portalo tu in VersaWorks.');
	const dir = await w.showDirectoryPicker({ id: 'versaworks', mode: 'readwrite' });
	await put(KEY, dir);
	return dir;
}
export async function savedVersaworks(): Promise<VwDir | null> {
	return (await get<VwDir>(KEY)) ?? null;
}
/** permesso di scrittura: va chiesto al clic, finche' vale il gesto dell'operatore */
export async function grantVersaworks(dir: VwDir): Promise<boolean> {
	const d = dir as PermDir;
	try {
		if (d.queryPermission && (await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
		if (d.requestPermission && (await d.requestPermission({ mode: 'readwrite' })) === 'granted') return true;
	} catch { /* cartella non raggiungibile */ }
	return false;
}

/** le stampanti che VersaWorks ha dentro quella cartella (LG-300, SG3-300, SG3-300#2…) */
export async function stampanti(dir: VwDir): Promise<string[]> {
	const out: string[] = [];
	for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
		if (h.kind !== 'directory' || name.startsWith('.') || name === 'JobGroup') continue;
		out.push(name);
	}
	return out.sort();
}

/** quale stampante per quale lavoro: lo studio propone, l'operatore puo' cambiare */
export type Ruolo = 'uv' | 'resinati' | 'laminati';
export const RUOLO_LABEL: Record<Ruolo, string> = { uv: 'UV (senza laminazione e rilievo)', resinati: 'Resinati', laminati: 'Con laminazione' };
export async function mappaSalvata(): Promise<Partial<Record<Ruolo, string>>> {
	return (await get<Partial<Record<Ruolo, string>>>(KEY_MAP)) ?? {};
}
export async function salvaMappa(m: Partial<Record<Ruolo, string>>) { await put(KEY_MAP, m); }

/** scrive la striscia nella coda A della stampante scelta */
export async function inviaAStampante(dir: VwDir, stampante: string, nome: string, bytes: Uint8Array): Promise<void> {
	if (!(await grantVersaworks(dir))) throw new Error('Chrome non ha il permesso di scrivere nella cartella di VersaWorks: sceglila di nuovo.');
	const pd = await dir.getDirectoryHandle(stampante).catch(() => { throw new Error(`In VersaWorks non trovo la stampante ${stampante}.`); });
	const qd = await pd.getDirectoryHandle(CODA).catch(() => { throw new Error(`La stampante ${stampante} non ha la coda A.`); });
	const fh = await qd.getFileHandle(nome.endsWith('.pdf') ? nome : `${nome}.pdf`, { create: true });
	const w = await fh.createWritable();
	await w.write(bytes as unknown as BufferSource);
	await w.close();
}
