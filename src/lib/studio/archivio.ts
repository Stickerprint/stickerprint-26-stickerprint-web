/**
 * Stickerprint Studio — archivio dei lavori.
 *
 * Una cartella in rete con dentro una cartella per ogni ordine:
 *   Archivio/SP00355/originale_logo.png      il file del cliente
 *   Archivio/SP00355/SP00355.pdf             l'impaginato che va in stampa
 *   Archivio/SP00355/SP00355.xpf             il file di taglio del Graphtec
 * Cosi' a un riordino si riapre tutto senza rifare niente.
 * La cartella si sceglie una volta sola (accesso ai file di Chrome) e si ricorda.
 */
export type ArchivioDir = FileSystemDirectoryHandle;

type PermDir = FileSystemDirectoryHandle & {
	queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
	requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
};

const DB = 'sp-studio', STORE = 'kv', KEY = 'archivio-dir';

function idb(): Promise<IDBDatabase> {
	return new Promise((ok, ko) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => ok(r.result);
		r.onerror = () => ko(r.error);
	});
}
async function put(v: unknown) {
	const d = await idb();
	await new Promise<void>((ok, ko) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, KEY); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); });
}
async function get<T>(): Promise<T | undefined> {
	const d = await idb();
	return new Promise((ok, ko) => { const r = d.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => ok(r.result as T); r.onerror = () => ko(r.error); });
}

export async function pickArchivio(): Promise<ArchivioDir> {
	const w = window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> };
	if (!w.showDirectoryPicker) throw new Error('Questo browser non può scrivere nelle cartelle: usa Chrome.');
	const dir = await w.showDirectoryPicker({ id: 'archivio-lavori', mode: 'readwrite' });
	await put(dir);
	return dir;
}
export async function savedArchivio(): Promise<ArchivioDir | null> {
	return (await get<ArchivioDir>()) ?? null;
}
export async function grantArchivio(dir: ArchivioDir): Promise<boolean> {
	const d = dir as PermDir;
	try {
		if (d.queryPermission && (await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
		if (d.requestPermission && (await d.requestPermission({ mode: 'readwrite' })) === 'granted') return true;
	} catch { /* cartella non raggiungibile */ }
	return false;
}

/** nomi puliti: niente caratteri che le cartelle di rete non digeriscono */
export const nomePulito = (s: string) => (s || 'lavoro').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);

/** scrive un file dentro la cartella dell'ordine (la crea se non c'e') */
export async function salvaNellArchivio(dir: ArchivioDir, ordine: string, nomeFile: string, dati: Uint8Array | Blob): Promise<string> {
	if (!(await grantArchivio(dir))) throw new Error('Chrome non ha il permesso di scrivere nella cartella dell’archivio: sceglila di nuovo.');
	const cartella = await dir.getDirectoryHandle(nomePulito(ordine), { create: true });
	const fh = await cartella.getFileHandle(nomePulito(nomeFile), { create: true });
	const w = await fh.createWritable();
	await w.write(dati as unknown as BufferSource);
	await w.close();
	return `${nomePulito(ordine)}/${nomePulito(nomeFile)}`;
}
