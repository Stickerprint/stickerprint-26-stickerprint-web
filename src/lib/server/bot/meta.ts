/** Instagram e WhatsApp (Meta Graph API): firma dei webhook, invio messaggi, download degli allegati. */
import { env } from '$env/dynamic/private';
import type { Blocco } from './cervello';

const GRAPH = 'https://graph.facebook.com/v23.0';
const IG = 'https://graph.instagram.com/v23.0';

/** X-Hub-Signature-256: HMAC-SHA256 del corpo grezzo con l'App Secret dell'app Meta */
export async function firmaValida(raw: string, header: string | null): Promise<boolean> {
	const secret = env.META_APP_SECRET;
	if (!secret || !header?.startsWith('sha256=')) return false;
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
	const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
	const got = header.slice(7).toLowerCase();
	if (got.length !== hex.length) return false;
	let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
	return diff === 0;
}

/** GET di verifica del webhook (hub.challenge) */
export function verificaWebhook(url: URL): Response {
	const ok = url.searchParams.get('hub.mode') === 'subscribe' && !!env.META_VERIFY_TOKEN && url.searchParams.get('hub.verify_token') === env.META_VERIFY_TOKEN;
	return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('token di verifica non valido', { status: 403 });
}

/* i canali tagliano i messaggi lunghi: si spezza sui paragrafi */
export function spezza(testo: string, max: number): string[] {
	const out: string[] = []; let cur = '';
	for (const p of testo.split(/\n\n+/)) {
		if ((cur + '\n\n' + p).trim().length > max && cur) { out.push(cur.trim()); cur = p; } else cur = cur ? cur + '\n\n' + p : p;
	}
	if (cur.trim()) out.push(cur.trim());
	return out.flatMap((s) => (s.length <= max ? [s] : s.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g')) ?? [s]));
}

async function graph(url: string, token: string, body: unknown) {
	const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
	if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 300)}`);
	return r.json();
}

/* ---------- Instagram ---------- */
export const instagramPronto = () => !!env.IG_ACCESS_TOKEN;
export async function inviaInstagram(igUserId: string, testo: string) {
	for (const parte of spezza(testo, 950)) await graph(`${IG}/me/messages`, env.IG_ACCESS_TOKEN!, { recipient: { id: igUserId }, message: { text: parte } });
}
export async function instagramTyping(igUserId: string, on: boolean) {
	try { await graph(`${IG}/me/messages`, env.IG_ACCESS_TOKEN!, { recipient: { id: igUserId }, sender_action: on ? 'typing_on' : 'typing_off' }); } catch { /* facoltativo */ }
}
/** nome del profilo di chi scrive (username), se il token lo consente */
export async function nomeInstagram(igUserId: string): Promise<string | null> {
	try {
		const r = await fetch(`${IG}/${igUserId}?fields=name,username&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN!)}`);
		if (!r.ok) return null;
		const j = (await r.json()) as { name?: string; username?: string };
		return j.name || j.username || null;
	} catch { return null; }
}

/* ---------- WhatsApp ---------- */
export const whatsappPronto = () => !!env.WA_ACCESS_TOKEN && !!env.WA_PHONE_NUMBER_ID;
export async function inviaWhatsapp(to: string, testo: string) {
	for (const parte of spezza(testo, 4000)) await graph(`${GRAPH}/${env.WA_PHONE_NUMBER_ID}/messages`, env.WA_ACCESS_TOKEN!, { messaging_product: 'whatsapp', to, type: 'text', text: { body: parte, preview_url: true } });
}
export async function whatsappLetto(messageId: string) {
	try { await graph(`${GRAPH}/${env.WA_PHONE_NUMBER_ID}/messages`, env.WA_ACCESS_TOKEN!, { messaging_product: 'whatsapp', status: 'read', message_id: messageId }); } catch { /* facoltativo */ }
}
/** immagine mandata su WhatsApp: si scarica con il token e si passa al modello in base64 */
export async function immagineWhatsapp(mediaId: string): Promise<Blocco | null> {
	try {
		const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` } }).then((r) => r.json()) as { url?: string; mime_type?: string };
		if (!meta.url) return null;
		const r = await fetch(meta.url, { headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` } });
		if (!r.ok) return null;
		const mime = meta.mime_type ?? 'image/jpeg';
		if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
		const bytes = new Uint8Array(await r.arrayBuffer());
		if (bytes.length > 4_500_000) return null;
		let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		return { type: 'image', source: { type: 'base64', media_type: mime, data: btoa(bin) } };
	} catch { return null; }
}
