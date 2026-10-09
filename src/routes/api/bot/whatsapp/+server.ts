import { json } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { adminClient } from '$lib/server/admin';
import { firmaValida, verificaWebhook, inviaWhatsapp, whatsappLetto, immagineWhatsapp, whatsappPronto } from '$lib/server/bot/meta';
import { elabora, nuovo } from '$lib/server/bot/conversazioni';
import type { Blocco } from '$lib/server/bot/cervello';
import type { RequestHandler } from './$types';

/** Webhook WhatsApp Business Platform (Cloud API): verifica (GET) e messaggi (POST). */
export const GET: RequestHandler = async ({ url }) => verificaWebhook(url);

type Msg = { from: string; id: string; type: string; text?: { body: string }; image?: { id: string; caption?: string }; document?: { id: string; filename?: string; caption?: string }; audio?: unknown; sticker?: unknown };
type Valore = { messaging_product?: string; contacts?: { profile?: { name?: string }; wa_id: string }[]; messages?: Msg[] };

export const POST: RequestHandler = async ({ request, url }) => {
	const raw = await request.text();
	if (!(await firmaValida(raw, request.headers.get('x-hub-signature-256')))) return json({ error: 'firma non valida' }, { status: 401 });
	const body = JSON.parse(raw) as { object?: string; entry?: { changes?: { field?: string; value?: Valore }[] }[] };
	if (body.object !== 'whatsapp_business_account') return json({ ignored: body.object });
	const db = adminClient();
	if (!db || !whatsappPronto()) return json({ ignored: 'bot non configurato' });
	const valori = (body.entry ?? []).flatMap((e) => e.changes ?? []).filter((c) => c.field === 'messages' && c.value?.messages?.length).map((c) => c.value!);
	const lavoro = (async () => {
		for (const v of valori) for (const m of v.messages ?? []) {
			if (!(await nuovo(db, `wa:${m.id}`))) continue;
			const from = m.from;
			const nome = v.contacts?.find((c) => c.wa_id === from)?.profile?.name ?? null;
			try {
				await whatsappLetto(m.id);
				const immagini: Blocco[] = [];
				let testo = m.text?.body ?? '';
				if (m.type === 'image' && m.image) { const b = await immagineWhatsapp(m.image.id); if (b) immagini.push(b); testo = m.image.caption ?? ''; }
				else if (m.type === 'document') testo = `${m.document?.caption ?? ''} [ha mandato il file "${m.document?.filename ?? 'documento'}": non lo posso aprire qui, va caricato sul sito per l'anteprima]`.trim();
				else if (m.type !== 'text') testo = `[messaggio di tipo ${m.type} non leggibile]`;
				const r = await elabora(db, { canale: 'whatsapp', externalId: from, nome, testo, immagini, origin: url.origin });
				if (r.risposta) await inviaWhatsapp(from, r.risposta);
			} catch (err) {
				console.error('[bot whatsapp]', err);
				try { await inviaWhatsapp(from, 'Ops, ho avuto un intoppo tecnico 🙈 Riprova tra un minuto, oppure scrivici a info@stickerprint.it'); } catch { /* niente */ }
			}
		}
	})();
	waitUntil(lavoro);
	return json({ ok: true });
};
