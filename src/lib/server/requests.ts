import type { SupabaseClient } from '@supabase/supabase-js';
import { createTicket } from './helpdesk';
import { sendEmail } from './email';
import { OWNER_EMAIL, ownerNotifyEmail } from './email-templates';
import { pushStaff } from './push';

/** Salva una richiesta dai form del sito (aziende, supporto, resi) con eventuale allegato. */
export async function saveRequest(
	supabase: SupabaseClient,
	kind: 'aziende' | 'support' | 'reso',
	f: FormData,
	fields: { name?: string; company?: string; email: string; phone?: string; order_number?: string; message: string },
	origin = 'https://stickerprint.it'
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
	// supporto e resi vivono nell'helpdesk (ticket con conversazione); le richieste aziendali nel percorso preventivi
	if (kind !== 'aziende') {
		const r = await createTicket(supabase, kind === 'reso' ? 'reso' : 'domanda', { ...fields, file_path }, origin);
		return r.ok ? { ok: true } : { ok: false, error: r.error };
	}
	const { error } = await supabase.from('contact_requests').insert({ kind, ...fields, file_path });
	if (error) return { ok: false, error: 'Richiesta non salvata, riprova tra poco.' };
	await Promise.all([
		sendEmail({ to: OWNER_EMAIL, ...ownerNotifyEmail({ title: `Nuova richiesta aziendale da ${fields.company || fields.name || fields.email}`, lines: [`${fields.name ?? ''} · ${fields.email}${fields.phone ? ' · ' + fields.phone : ''}`, fields.message.slice(0, 300)], href: `${origin}/dashboard/aziende/richieste` }) }),
		pushStaff({ title: `Richiesta aziendale: ${fields.company || fields.name || fields.email}`, body: fields.message.slice(0, 120), url: '/dashboard/aziende/richieste', tag: 'aziende' })
	]);
	return { ok: true };
}
