import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Collegamento una tantum (17/10/2026): dice a Postmark dove mandare la posta in arrivo e restituisce
 * l'indirizzo inbound da impostare nell'inoltro di Gmail. Protetto da POSTA_SETUP_KEY; da togliere a collegamento fatto.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (!env.POSTA_SETUP_KEY || url.searchParams.get('k') !== env.POSTA_SETUP_KEY) return json({ ok: false }, { status: 401 });
	const token = env.POSTMARK_SERVER_TOKEN;
	if (!token || !env.POSTA_INBOUND_KEY) return json({ ok: false, error: 'POSTMARK_SERVER_TOKEN o POSTA_INBOUND_KEY mancante' });
	const hook = `${url.origin}/api/posta/inbound?k=${env.POSTA_INBOUND_KEY}`;
	const h = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': token };
	const prima = await fetch('https://api.postmarkapp.com/server', { headers: h }).then((r) => r.json());
	const dopo = url.searchParams.get('imposta') === '1' ? await fetch('https://api.postmarkapp.com/server', { method: 'PUT', headers: h, body: JSON.stringify({ InboundHookUrl: hook }) }).then((r) => r.json()) : null;
	const s = dopo ?? prima;
	return json({ ok: true, server: s.Name, inboundAddress: s.InboundAddress, inboundHookUrl: s.InboundHookUrl, inboundDomain: s.InboundDomain, errore: s.Message ?? null });
};
