import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

/**
 * Caricamento file d'ordine per gli OSPITI: il bucket order-files non accetta scritture anonime
 * (row-level security), quindi il file passa da qui e viene salvato con la chiave di servizio.
 * Solo dentro la cartella guest/, solo tipi di file di stampa, massimo 60 MB.
 */
const MAX = 60 * 1024 * 1024;
export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) return json({ error: 'Caricamento ospite non disponibile.' }, { status: 503 });
	const fd = await request.formData();
	const file = fd.get('file'); const path = String(fd.get('path') ?? '');
	if (!(file instanceof File)) return json({ error: 'File mancante.' }, { status: 400 });
	if (file.size > MAX) return json({ error: 'File troppo grande (massimo 60 MB).' }, { status: 413 });
	const folder = user ? user.id : 'guest';
	if (!/^[a-z0-9-]+\/[a-z0-9-]+(?::[a-z0-9]+)?(\/[a-z0-9-]+)?\.[a-z0-9]{2,5}$/i.test(path) || !path.startsWith(`${folder}/`)) return json({ error: 'Percorso non valido.' }, { status: 400 });
	const db = createClient(PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
	const { error } = await db.storage.from('order-files').upload(path, file, { contentType: file.type || undefined, upsert: true });
	if (error) return json({ error: error.message }, { status: 400 });
	return json({ ok: true, path });
};
