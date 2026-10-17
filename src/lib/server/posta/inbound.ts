/**
 * Una mail in arrivo diventa una riga di posta_in con gli allegati nel bucket posta-in.
 * Arriva dalla lettura IMAP (gmail.ts) o, in alternativa, dal webhook Postmark Inbound (stesso formato JSON di Postmark).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AllegatoPosta } from './tipi';

interface PmAddr { Email: string; Name: string }
export interface PostmarkInbound {
	MessageID: string; Date: string; Subject: string; TextBody?: string; HtmlBody?: string; StrippedTextReply?: string;
	FromFull: PmAddr; ToFull?: PmAddr[]; CcFull?: PmAddr[]; OriginalRecipient?: string;
	Headers?: { Name: string; Value: string }[];
	/** Content in base64 (Postmark) oppure Bytes gia' decodificati (lettura IMAP) */
	Attachments?: { Name: string; Content: string; Bytes?: Uint8Array; ContentType: string; ContentLength: number; ContentID?: string }[];
}

/** base64 → byte senza Buffer (i tipi di Node non sono nel progetto) */
const daBase64 = (b64: string) => Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
const safe = (s: string) => s.normalize('NFKD').replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'allegato';
const testoDa = (p: PostmarkInbound) => (p.TextBody ?? '').trim() || (p.HtmlBody ?? '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** la mail con cui Gmail chiede di confermare l'inoltro: va letta e confermata da Mattia (il codice si mostra nella pagina Posta) */
export function confermaInoltroGmail(p: PostmarkInbound): { codice: string | null; link: string | null } | null {
	const da = (p.FromFull?.Email ?? '').toLowerCase();
	if (!/forwarding-noreply@google\.com|@google\.com$/.test(da) || !/inoltr|forward/i.test(p.Subject ?? '')) return null;
	const t = testoDa(p);
	return { codice: (t.match(/\b(\d{9})\b/) ?? [])[1] ?? null, link: (t.match(/https:\/\/mail-settings\.google\.com\/mail\/[^\s<>"]+/) ?? [])[0] ?? null };
}

export async function salvaInbound(db: SupabaseClient, p: PostmarkInbound): Promise<{ id: string | null; doppia: boolean }> {
	const mail_id = p.Headers?.find((h) => h.Name.toLowerCase() === 'message-id')?.Value ?? null;
	const { data: gia } = await db.from('posta_in').select('id').eq('message_id', p.MessageID).maybeSingle();
	if (gia) return { id: gia.id, doppia: true };
	if (mail_id) { const { data: gia2 } = await db.from('posta_in').select('id').eq('mail_id', mail_id).maybeSingle(); if (gia2) return { id: gia2.id, doppia: true }; }
	const allegati: AllegatoPosta[] = [];
	const base = p.MessageID.replace(/[^a-z0-9-]/gi, '');
	let n = 0;
	for (const a of p.Attachments ?? []) {
		if ((!a.Content && !a.Bytes) || a.ContentID) continue; // le immagini in linea delle firme non servono
		n++;
		const path = `${base}/${n}-${safe(a.Name)}`;
		const bytes = a.Bytes ?? daBase64(a.Content);
		const { error } = await db.storage.from('posta-in').upload(path, bytes, { contentType: a.ContentType || 'application/octet-stream', upsert: true });
		if (!error) allegati.push({ nome: a.Name, tipo: a.ContentType, byte: bytes.length, path });
	}
	const conferma = confermaInoltroGmail(p);
	const listaNoreply = (p.Headers ?? []).some((h) => /^list-unsubscribe$/i.test(h.Name)) || /no-?reply|newsletter|notification/i.test(p.FromFull?.Email ?? '');
	const row = {
		message_id: p.MessageID, mail_id, data_mail: p.Date ? new Date(p.Date).toISOString() : null,
		mittente_email: (p.FromFull?.Email ?? '').toLowerCase(), mittente_nome: p.FromFull?.Name || null,
		destinatari: [...(p.ToFull ?? []), ...(p.CcFull ?? [])].map((x) => x.Email.toLowerCase()),
		oggetto: p.Subject ?? null, testo: (p.TextBody ?? '').trim() || testoDa(p), html: p.HtmlBody ?? null, allegati,
		stato: conferma ? 'altro' : listaNoreply ? 'ignorata' : 'nuova',
		note: conferma ? 'Conferma dell’inoltro Gmail' : listaNoreply ? 'Mail automatica o newsletter: non elaborata' : null,
		esito: conferma ? { blocchi: [], conferma } : null
	};
	const { data, error } = await db.from('posta_in').insert(row).select('id').single();
	if (error) throw new Error(error.message);
	return { id: data.id, doppia: false };
}
