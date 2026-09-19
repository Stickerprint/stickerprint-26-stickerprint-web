/**
 * Stickerprint Studio — cartella di Data Link Server (Cutting Master 5).
 * Data Link Server controlla una cartella ("hot folder") e tiene pronti i file di taglio .xpf:
 * quando il Graphtec legge il codice a barre della striscia, chiede il lavoro con quel codice.
 * Lo studio scrive il file .xpf in quella cartella con l'accesso ai file di Chrome
 * (File System Access): la cartella si sceglie una volta e il permesso si ricorda.
 */
import { xpfJobId } from './graphtec';

export type DataLinkDir = FileSystemDirectoryHandle;

type PermDir = FileSystemDirectoryHandle & {
	queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
	requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
};

const DB = 'sp-studio', STORE = 'kv', KEY = 'datalink-dir';

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

/** chiede la cartella di Data Link Server (una volta) e la ricorda */
export async function pickDataLink(): Promise<DataLinkDir> {
	const w = window as unknown as { showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle> };
	if (!w.showDirectoryPicker) throw new Error('Questo browser non può scrivere nelle cartelle: usa Chrome, oppure scarica il file di taglio e mettilo nella cartella di Data Link Server.');
	const dir = await w.showDirectoryPicker({ id: 'datalink', mode: 'readwrite' });
	await put(dir);
	return dir;
}

/** la cartella scelta l'ultima volta (se c'e') */
export async function savedDataLink(): Promise<DataLinkDir | null> {
	return (await get<DataLinkDir>()) ?? null;
}

/** permesso di scrittura: va chiesto SUBITO al clic (Chrome lo chiede solo con un gesto recente) */
export async function grantDataLink(dir: DataLinkDir): Promise<boolean> {
	const d = dir as PermDir;
	try {
		if (d.queryPermission && (await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
		if (d.requestPermission && (await d.requestPermission({ mode: 'readwrite' })) === 'granted') return true;
	} catch { /* cartella non raggiungibile */ }
	return false;
}

async function ensure(dir: DataLinkDir) {
	const d = dir as PermDir;
	if (d.queryPermission && (await d.queryPermission({ mode: 'readwrite' })) === 'granted') return;
	if (d.requestPermission && (await d.requestPermission({ mode: 'readwrite' })) === 'granted') return;
	throw new Error('Chrome non ha il permesso di scrivere nella cartella di Data Link Server: sceglila di nuovo.');
}

/** codici dei lavori gia' presenti (per non riusarli) */
export async function takenJobIds(dir: DataLinkDir): Promise<Set<string>> {
	await ensure(dir);
	const out = new Set<string>();
	for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
		if (!name.toLowerCase().endsWith('.xpf') || h.kind !== 'file') continue;
		const f = await (h as FileSystemFileHandle).getFile();
		const id = xpfJobId(new Uint8Array(await f.slice(0, 80).arrayBuffer()));
		if (id) out.add(id);
	}
	return out;
}

export async function writeXpf(dir: DataLinkDir, name: string, bytes: Uint8Array) {
	await ensure(dir);
	const fh = await dir.getFileHandle(name, { create: true });
	const w = await fh.createWritable();
	await w.write(bytes as unknown as BufferSource);
	await w.close();
}
