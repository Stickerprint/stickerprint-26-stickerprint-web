import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

/**
 * File d'ordine degli OSPITI: il bucket order-files non accetta scritture anonime (row-level security).
 * Il browser chiede qui un permesso firmato per il percorso (solo `path`, niente file) e poi carica il file
 * direttamente su Supabase Storage con `uploadToSignedUrl`: il file non passa dalle funzioni Vercel,
 * che rifiutano i corpi oltre 4,5 MB (il motivo per cui un PDF di stampa pesante bloccava il pagamento).
 * Per compatibilita' resta anche il caricamento diretto (`file` nel modulo), utile solo per file piccoli.
 * Solo dentro la cartella guest/ (o dell'utente), massimo 60 MB.
 */
const MAX = 60 * 1024 * 1024;
const PATH_OK = /^[a-z0-9-]+\/[a-z0-9-]+(?::[a-z0-9]+)?(\/[a-z0-9-]+)?\.[a-z0-9]{2,5}$/i;
export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) return json({ error: 'Caricamento ospite non disponibile.' }, { status: 503 });
	const fd = await request.formData();
	const file = fd.get('file'); const path = String(fd.get('path') ?? '');
	const folder = user ? user.id : 'guest';
	if (!PATH_OK.test(path) || !path.startsWith(`${folder}/`)) return json({ error: 'Percorso non valido.' }, { status: 400 });
	const db = createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
	if (!(file instanceof File)) {
		/* permesso firmato (vale 2 ore, sovrascrive se il cliente ricarica lo stesso file) */
		const size = Number(fd.get('size') ?? 0);
		if (size > MAX) return json({ error: 'File troppo grande (massimo 60 MB).' }, { status: 413 });
		const { data, error } = await db.storage.from('order-files').createSignedUploadUrl(path, { upsert: true });
		if (error || !data) return json({ error: error?.message ?? 'Permesso di caricamento non creato.' }, { status: 400 });
		return json({ ok: true, path: data.path, token: data.token });
	}
	if (file.size > MAX) return json({ error: 'File troppo grande (massimo 60 MB).' }, { status: 413 });
	const { error } = await db.storage.from('order-files').upload(path, file, { contentType: file.type || undefined, upsert: true });
	if (error) return json({ error: error.message }, { status: 400 });
	return json({ ok: true, path });
};
