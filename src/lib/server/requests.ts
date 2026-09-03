import type { SupabaseClient } from '@supabase/supabase-js';

/** Salva una richiesta dai form del sito (aziende, supporto, resi) con eventuale allegato. */
export async function saveRequest(
	supabase: SupabaseClient,
	kind: 'aziende' | 'support' | 'reso',
	f: FormData,
	fields: { name?: string; company?: string; email: string; phone?: string; order_number?: string; message: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!fields.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) return { ok: false, error: 'Inserisci un indirizzo email valido.' };
	if (!fields.message || fields.message.trim().length < 5) return { ok: false, error: 'Scrivi qualche riga in più nella richiesta.' };
	let file_path: string | null = null;
	const file = f.get('file');
	if (file instanceof File && file.size > 0) {
		if (file.size > 25 * 1024 * 1024) return { ok: false, error: 'Il file supera i 25 MB.' };
		const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
		file_path = `${kind}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
		const { error } = await supabase.storage.from('requests').upload(file_path, file, { contentType: file.type || undefined });
		if (error) return { ok: false, error: `Allegato non caricato: ${error.message}` };
	}
	const { error } = await supabase.from('contact_requests').insert({ kind, ...fields, file_path });
	if (error) return { ok: false, error: 'Richiesta non salvata, riprova tra poco.' };
	return { ok: true };
}
