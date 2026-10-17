/**
 * Lettura della casella mattia@stickerprint.it via IMAP (password per le app di Google: GMAIL_IMAP_USER / GMAIL_IMAP_PASS).
 * Si leggono solo le mail nuove dall'ultima volta (UID oltre l'ultimo letto, posta_sync); la prima volta si parte
 * dalle mail di oggi. Ogni mail diventa una riga di posta_in con gli allegati, come se arrivasse dal webhook.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import { env } from '$env/dynamic/private';
import { giornoRoma, inizioGiornoRoma } from '$lib/dashboard/tempo';
import { salvaInbound, type PostmarkInbound } from './inbound';
import { gmailApiConfigurata, leggiCasellaApi, statoGmail } from './gmail-api';

export const gmailConfigurato = () => Boolean(env.GMAIL_IMAP_USER && env.GMAIL_IMAP_PASS);
export const gmailMancanti = () => ['GMAIL_IMAP_USER', 'GMAIL_IMAP_PASS'].filter((k) => !env[k]);

const indirizzi = (a: AddressObject | AddressObject[] | undefined) => (Array.isArray(a) ? a : a ? [a] : []).flatMap((x) => x.value).map((v) => ({ Email: v.address ?? '', Name: v.name ?? '' })).filter((v) => v.Email);

/** prima l'API di Gmail (accesso con "Consenti"), poi IMAP (password per le app) se configurato */
export async function leggiCasella(db: SupabaseClient, opts: { max?: number } = {}): Promise<{ nuove: number; doppie: number; saltate: number; errore: string | null }> {
	if (gmailApiConfigurata() && (await statoGmail(db)).collegata) return leggiCasellaApi(db, opts);
	return leggiCasellaImap(db, opts);
}

export async function leggiCasellaImap(db: SupabaseClient, opts: { max?: number } = {}): Promise<{ nuove: number; doppie: number; saltate: number; errore: string | null }> {
	const out = { nuove: 0, doppie: 0, saltate: 0, errore: null as string | null };
	if (!gmailConfigurato()) { out.errore = gmailApiConfigurata() ? 'Gmail non collegata: premere "Collega Gmail" nella pagina Posta' : `casella non collegata: mancano ${gmailMancanti().join(', ')} su Vercel`; return out; }
	const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: env.GMAIL_IMAP_USER!, pass: env.GMAIL_IMAP_PASS! }, logger: false, emitLogs: false });
	try {
		await client.connect();
		const lock = await client.getMailboxLock('INBOX');
		try {
			const uidValidity = Number(client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.uidValidity : 0);
			const { data: st } = await db.from('posta_sync').select('*').eq('id', 1).maybeSingle();
			let lastUid = st && Number(st.uid_validity) === uidValidity ? Number(st.last_uid) : 0;
			// prima lettura (o casella ricreata): solo le mail di oggi, niente arretrato
			const trovate = lastUid ? await client.search({ uid: `${lastUid + 1}:*` }, { uid: true }) : await client.search({ since: inizioGiornoRoma(giornoRoma()) }, { uid: true });
			const uids = (Array.isArray(trovate) ? trovate : []).filter((u) => u > lastUid).sort((a, b) => a - b).slice(0, opts.max ?? 40);
			for (const uid of uids) {
				const msg = await client.fetchOne(String(uid), { source: true, uid: true, envelope: true }, { uid: true });
				if (!msg || !msg.source) { lastUid = uid; continue; }
				const p = await simpleParser(msg.source);
				const da = indirizzi(p.from)[0];
				if (!da || /@stickerprint\.it$/i.test(da.Email)) { out.saltate++; lastUid = uid; continue; } // le nostre risposte in copia
				const mail: PostmarkInbound = {
					MessageID: `imap-${uidValidity}-${uid}`, Date: (p.date ?? new Date()).toISOString(), Subject: p.subject ?? '',
					TextBody: p.text ?? '', HtmlBody: typeof p.html === 'string' ? p.html : (p.textAsHtml ?? ''),
					FromFull: da, ToFull: indirizzi(p.to), CcFull: indirizzi(p.cc),
					Headers: [...(p.messageId ? [{ Name: 'Message-ID', Value: p.messageId }] : []), ...(p.headers.has('list-unsubscribe') ? [{ Name: 'List-Unsubscribe', Value: '1' }] : [])],
					Attachments: p.attachments.map((a) => ({ Name: a.filename ?? 'allegato', Content: '', Bytes: new Uint8Array(a.content), ContentType: a.contentType, ContentLength: a.size, ContentID: a.contentDisposition === 'inline' && a.cid ? a.cid : undefined }))
				};
				const r = await salvaInbound(db, mail);
				if (r.doppia) out.doppie++; else out.nuove++;
				lastUid = uid;
			}
			await db.from('posta_sync').upsert({ id: 1, uid_validity: uidValidity, last_uid: lastUid, letta_il: new Date().toISOString(), errore: null });
		} finally { lock.release(); }
		await client.logout();
	} catch (e) {
		out.errore = (e as Error).message.slice(0, 300);
		await db.from('posta_sync').upsert({ id: 1, letta_il: new Date().toISOString(), errore: out.errore });
		try { await client.logout(); } catch { /* gia' chiuso */ }
	}
	return out;
}
