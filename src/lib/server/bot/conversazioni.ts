/** Conversazioni dell'assistente: una per cliente e canale, salvate in bot_conversations. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { rispondi, type Blocco, type Canale, type Messaggio } from './cervello';

export type RigaChat = { da: 'cliente' | 'bot'; testo: string; ora: string; allegati?: number; strumenti?: { nome: string; input: unknown; output: unknown }[]; ms?: number };
type Conv = { id: string; channel: Canale; external_id: string; name: string | null; history: Messaggio[]; chat: RigaChat[]; handed_off: boolean; ticket_number: string | null; last_at: string };

/** true se il messaggio (id del canale) è nuovo; Meta rimanda gli eventi se non riceve 200 in fretta */
export async function nuovo(db: SupabaseClient, id: string): Promise<boolean> {
	const { error } = await db.from('bot_seen').insert({ id });
	return !error;
}

/* lo storico per il modello resta corto: si taglia solo su un messaggio "vero" del cliente,
   mai tra una chiamata di strumento e il suo risultato */
function taglia(h: Messaggio[], max = 40): Messaggio[] {
	if (h.length <= max) return h;
	for (let i = h.length - max; i < h.length; i++) {
		const m = h[i];
		const vero = m.role === 'user' && (typeof m.content === 'string' || !m.content.some((b) => b.type === 'tool_result'));
		if (vero) return h.slice(i);
	}
	return h;
}

export type InArrivo = { canale: Canale; externalId: string; nome?: string | null; testo: string; immagini?: Blocco[]; origin?: string };

/**
 * Elabora un messaggio in arrivo e restituisce il testo da mandare al cliente.
 * Se la conversazione è già passata a Mattia, il bot resta in silenzio (risponde lui dal ticket).
 */
export async function elabora(db: SupabaseClient, m: InArrivo): Promise<{ risposta: string | null; conv: Conv }> {
	const { data: found } = await db.from('bot_conversations').select('*').eq('channel', m.canale).eq('external_id', m.externalId).maybeSingle();
	let conv = found as Conv | null;
	if (!conv) {
		const { data, error } = await db.from('bot_conversations').insert({ channel: m.canale, external_id: m.externalId, name: m.nome ?? null }).select('*').single();
		if (error) throw new Error(`conversazione non creata: ${error.message}`);
		conv = data as Conv;
	} else if (m.nome && !conv.name) await db.from('bot_conversations').update({ name: m.nome }).eq('id', conv.id);
	const ora = new Date().toISOString();
	const testo = m.testo.trim();
	const nota = m.immagini?.length ? `[Il cliente ha allegato ${m.immagini.length === 1 ? 'un\'immagine' : m.immagini.length + ' immagini'}] ` : '';
	const content: string | Blocco[] = m.immagini?.length ? [...m.immagini, { type: 'text', text: (nota + testo).trim() || nota.trim() }] : testo || '[messaggio senza testo]';
	const chat: RigaChat[] = [...(conv.chat ?? []), { da: 'cliente', testo: testo || (m.immagini?.length ? '📎 immagine' : ''), ora, allegati: m.immagini?.length || undefined }];
	const history: Messaggio[] = [...(conv.history ?? []), { role: 'user', content }];
	if (conv.handed_off) {
		await db.from('bot_conversations').update({ chat, history: taglia(history), last_at: ora }).eq('id', conv.id);
		return { risposta: null, conv };
	}
	const prec = chat.filter((r) => r.da === 'bot').at(-1);
	const t0 = Date.now();
	let passaggio: { motivo: string; riassunto: string; email: string; ticket?: string } | null = null;
	const trascrizione = chat.map((r) => `${r.da === 'bot' ? 'Bot' : 'Cliente'} (${new Date(r.ora).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}): ${r.testo}`).join('\n');
	const r = await rispondi(taglia(history), { db, canale: m.canale, primo: !prec, oreDaUltimo: prec ? (Date.now() - new Date(prec.ora).getTime()) / 36e5 : 0, nomeCliente: conv.name ?? m.nome, origin: m.origin, onPassaggio: (p) => (passaggio = p) }, trascrizione);
	chat.push({ da: 'bot', testo: r.testo, ora: new Date().toISOString(), strumenti: r.strumenti.length ? r.strumenti : undefined, ms: Date.now() - t0 });
	const upd: Partial<Conv> = { chat, history: taglia(r.storico), last_at: new Date().toISOString() };
	if (passaggio) { upd.handed_off = true; upd.ticket_number = (passaggio as { ticket?: string }).ticket ?? null; }
	await db.from('bot_conversations').update(upd).eq('id', conv.id);
	return { risposta: r.testo, conv: { ...conv, ...upd } as Conv };
}
