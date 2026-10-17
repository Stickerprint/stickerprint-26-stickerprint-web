/**
 * Lettura della casella con l'API di Gmail (accesso dato da Mattia con un clic "Consenti", nessuna password).
 * Variabili su Vercel: GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET (client OAuth "Dashboard Stickerprint" su Google Cloud).
 * Il refresh token sta in posta_gmail (solo chiave di servizio). Si leggono le mail della INBOX piu' nuove
 * dell'ultima letta (posta_sync.last_uid = internalDate in ms); la prima volta si parte da oggi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { giornoRoma, inizioGiornoRoma } from '$lib/dashboard/tempo';
import { salvaInbound, type PostmarkInbound } from './inbound';

export const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const gmailApiConfigurata = () => Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET);
export const gmailApiMancanti = () => ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET'].filter((k) => !env[k]);
export const redirectUri = (origin: string) => `${origin}/api/posta/gmail/callback`;

export function urlConsenso(origin: string, state: string): string {
	const p = new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, login_hint: env.GMAIL_IMAP_USER || 'mattia@stickerprint.it' });
	return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function token(body: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }> {
	const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID!, client_secret: env.GMAIL_CLIENT_SECRET!, ...body }) });
	return r.json();
}

/** scambio del codice dopo il "Consenti": salva il refresh token e l'indirizzo della casella */
export async function completaCollegamento(db: SupabaseClient, origin: string, code: string): Promise<{ ok: true; email: string } | { ok: false; errore: string }> {
	const t = await token({ code, redirect_uri: redirectUri(origin), grant_type: 'authorization_code' });
	if (!t.access_token) return { ok: false, errore: t.error_description ?? t.error ?? 'nessun token' };
	if (!t.refresh_token) return { ok: false, errore: 'Google non ha dato il refresh token: togliere l’accesso da myaccount.google.com/permissions e rifare il collegamento' };
	const prof = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
	const email = String(prof.emailAddress ?? '');
	const { error } = await db.from('posta_gmail').upsert({ id: 1, email, refresh_token: t.refresh_token, scope: t.scope ?? SCOPE, collegato_il: new Date().toISOString(), errore: null });
	if (error) return { ok: false, errore: error.message };
	return { ok: true, email };
}

export async function statoGmail(db: SupabaseClient): Promise<{ collegata: boolean; email: string | null; collegatoIl: string | null; errore: string | null }> {
	const { data } = await db.from('posta_gmail').select('email, collegato_il, errore, refresh_token').eq('id', 1).maybeSingle();
	return { collegata: Boolean(data?.refresh_token), email: data?.email ?? null, collegatoIl: data?.collegato_il ?? null, errore: data?.errore ?? null };
}

let cache: { token: string; exp: number } | null = null;
async function accessToken(db: SupabaseClient): Promise<string> {
	if (cache && cache.exp > Date.now()) return cache.token;
	const { data } = await db.from('posta_gmail').select('refresh_token').eq('id', 1).maybeSingle();
	if (!data?.refresh_token) throw new Error('Gmail non collegata: premere "Collega Gmail" nella pagina Posta');
	const t = await token({ refresh_token: data.refresh_token, grant_type: 'refresh_token' });
	if (!t.access_token) throw new Error(`Google: ${t.error_description ?? t.error ?? 'token non rinnovato'}`);
	cache = { token: t.access_token, exp: Date.now() + ((t.expires_in ?? 3600) - 60) * 1000 };
	return cache.token;
}

type Part = { mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[] };
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const testo = (s: string) => new TextDecoder('utf-8').decode(b64(s));
const hdr = (p: Part | undefined, n: string) => p?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? '';
const indirizzo = (v: string) => { const m = v.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/); return m ? { Email: m[2].trim(), Name: m[1].trim() } : { Email: v.trim(), Name: '' }; };
const elenco = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean).map(indirizzo);

function raccogli(p: Part, out: { text: string[]; html: string[]; allegati: Part[] }) {
	const mt = (p.mimeType ?? '').toLowerCase();
	if (p.filename && p.body?.attachmentId) { out.allegati.push(p); return; }
	if (mt === 'text/plain' && p.body?.data) out.text.push(testo(p.body.data));
	else if (mt === 'text/html' && p.body?.data) out.html.push(testo(p.body.data));
	for (const c of p.parts ?? []) raccogli(c, out);
}

export async function leggiCasellaApi(db: SupabaseClient, opts: { max?: number } = {}): Promise<{ nuove: number; doppie: number; saltate: number; errore: string | null }> {
	const out = { nuove: 0, doppie: 0, saltate: 0, errore: null as string | null };
	try {
		const tk = await accessToken(db);
		const H = { Authorization: `Bearer ${tk}` };
		const { data: st } = await db.from('posta_sync').select('*').eq('id', 1).maybeSingle();
		// con l'API uid_validity vale 0 e last_uid e' l'internalDate (ms) dell'ultima mail letta; la prima volta si parte da oggi
		const daMs = st && Number(st.uid_validity) === 0 && Number(st.last_uid) > 0 ? Number(st.last_uid) : inizioGiornoRoma(giornoRoma()).getTime();
		const q = `in:inbox -from:me after:${Math.floor(daMs / 1000) - 60}`;
		const lista = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q, maxResults: String(opts.max ?? 40) })}`, { headers: H }).then((r) => r.json());
		if (lista.error) throw new Error(`Gmail: ${lista.error.message}`);
		const ids: string[] = (lista.messages ?? []).map((m: { id: string }) => m.id);
		let ultimo = daMs;
		// dal piu' vecchio al piu' nuovo
		const msgs = (await Promise.all(ids.map((id) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: H }).then((r) => r.json())))).filter((m) => m?.id).sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
		for (const m of msgs) {
			const when = Number(m.internalDate);
			if (when <= daMs && st && Number(st.last_uid) > 0) { out.saltate++; continue; }
			const p: Part = m.payload ?? {};
			const da = indirizzo(hdr(p, 'From'));
			if (!da.Email || /@stickerprint\.it$/i.test(da.Email)) { out.saltate++; ultimo = Math.max(ultimo, when); continue; }
			const parti = { text: [] as string[], html: [] as string[], allegati: [] as Part[] };
			raccogli(p, parti);
			const Attachments: NonNullable<PostmarkInbound['Attachments']> = [];
			for (const a of parti.allegati) {
				if (/inline/i.test(hdr(a, 'Content-Disposition')) && hdr(a, 'Content-ID')) continue; // immagini delle firme
				const d = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${a.body!.attachmentId}`, { headers: H }).then((r) => r.json());
				if (!d?.data) continue;
				const bytes = b64(d.data);
				Attachments.push({ Name: a.filename!, Content: '', Bytes: bytes, ContentType: a.mimeType ?? 'application/octet-stream', ContentLength: bytes.length });
			}
			const mail: PostmarkInbound = {
				MessageID: `gmail-${m.id}`, Date: new Date(when).toISOString(), Subject: hdr(p, 'Subject'),
				TextBody: parti.text.join('\n'), HtmlBody: parti.html.join('\n'), FromFull: da, ToFull: elenco(hdr(p, 'To')), CcFull: elenco(hdr(p, 'Cc')),
				Headers: [{ Name: 'Message-ID', Value: hdr(p, 'Message-ID') }, ...(hdr(p, 'List-Unsubscribe') ? [{ Name: 'List-Unsubscribe', Value: '1' }] : [])],
				Attachments
			};
			const r = await salvaInbound(db, mail);
			if (r.doppia) out.doppie++; else out.nuove++;
			ultimo = Math.max(ultimo, when);
		}
		await db.from('posta_sync').upsert({ id: 1, uid_validity: 0, last_uid: ultimo, letta_il: new Date().toISOString(), errore: null });
	} catch (e) {
		out.errore = (e as Error).message.slice(0, 300);
		await db.from('posta_sync').upsert({ id: 1, letta_il: new Date().toISOString(), errore: out.errore });
	}
	return out;
}
