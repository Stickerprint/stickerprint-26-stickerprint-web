import { json } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { adminClient } from '$lib/server/admin';
import { firmaValida, verificaWebhook, inviaInstagram, instagramTyping, nomeInstagram, instagramPronto } from '$lib/server/bot/meta';
import { elabora, nuovo } from '$lib/server/bot/conversazioni';
import type { Blocco } from '$lib/server/bot/cervello';
import type { RequestHandler } from './$types';

/** Webhook Instagram (Meta): verifica (GET) e messaggi in direct (POST). */
export const GET: RequestHandler = async ({ url }) => verificaWebhook(url);

type Evento = { sender?: { id: string }; recipient?: { id: string }; message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean; attachments?: { type: string; payload?: { url?: string } }[] } };

export const POST: RequestHandler = async ({ request, url }) => {
	const raw = await request.text();
	if (!(await firmaValida(raw, request.headers.get('x-hub-signature-256')))) return json({ error: 'firma non valida' }, { status: 401 });
	const body = JSON.parse(raw) as { object?: string; entry?: { messaging?: Evento[] }[] };
	if (body.object !== 'instagram') return json({ ignored: body.object });
	const db = adminClient();
	if (!db || !instagramPronto()) return json({ ignored: 'bot non configurato' });
	const eventi = (body.entry ?? []).flatMap((e) => e.messaging ?? []).filter((e) => e.sender?.id && e.message && !e.message.is_echo && !e.message.is_deleted && (e.message.text || e.message.attachments?.length));
	const lavoro = (async () => {
		for (const e of eventi) {
			const mid = e.message!.mid ?? `${e.sender!.id}-${Date.now()}`;
			if (!(await nuovo(db, `ig:${mid}`))) continue;
			const from = e.sender!.id;
			try {
				await instagramTyping(from, true);
				const immagini: Blocco[] = (e.message!.attachments ?? []).filter((a) => a.type === 'image' && a.payload?.url).slice(0, 3).map((a) => ({ type: 'image', source: { type: 'url', url: a.payload!.url! } }));
				const altri = (e.message!.attachments ?? []).filter((a) => a.type !== 'image').map((a) => a.type);
				const testo = (e.message!.text ?? '') + (altri.length ? ` [allegato ${altri.join(', ')} non visibile: se è un file da stampare, va caricato sul sito]` : '');
				const nome = await nomeInstagram(from);
				const r = await elabora(db, { canale: 'instagram', externalId: from, nome, testo, immagini, origin: url.origin });
				if (r.risposta) await inviaInstagram(from, r.risposta);
			} catch (err) {
				console.error('[bot instagram]', err);
				try { await inviaInstagram(from, 'Ops, ho avuto un intoppo tecnico 🙈 Riprova tra un minuto, oppure scrivici a info@stickerprint.it'); } catch { /* niente */ }
			} finally { await instagramTyping(from, false); }
		}
	})();
	// Meta vuole il 200 subito: la risposta al cliente si prepara dopo
	waitUntil(lavoro);
	return json({ ok: true, eventi: eventi.length });
};
