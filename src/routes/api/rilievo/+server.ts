import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

/* ANALISI VISIVA DEL RILIEVO
   Il motore di anteprima divide l'immagine del cliente in zone numerate e le manda qui.
   Un modello di visione le guarda come farebbe un grafico e sceglie dove va l'effetto
   rilievo UV. Il risultato e' salvato per immagine (hash), cosi' lo stesso file non
   viene analizzato due volte. Senza chiave API il motore usa le sue regole di riserva. */

const MODELLO = env.RILIEVO_AI_MODEL || 'claude-sonnet-5';

const REGOLE = `Sei il grafico prestampa di Stickerprint, esperto di adesivi con effetto RILIEVO UV: una vernice spessa e lucida stesa solo su alcune zone, sopra una stampa che resta opaca. Il rilievo si vede e si tocca: crea un gioco di luci fra le parti lucide in rilievo e lo sfondo opaco.

Ricevi l'immagine di un cliente e la stessa immagine con le zone numerate (ogni zona e' una campitura di colore uniforme; i colori veri sono quelli dell'immagine, i pezzi dei gruppi G sono tinti per riconoscerli). Devi decidere QUALI ZONE ricevono il rilievo, con l'obiettivo di stupire: il cliente deve dire "wow".

Come ragiona un grafico:
- Prima capisci cos'e' SFONDO (campiture grandi, sfumature di fondo, placche, ombre, il filetto o contorno attorno alla sagoma, l'ombra estrusa dietro una scritta): lo sfondo resta OPACO, mai in rilievo.
- Le SCRITTE vanno sempre in rilievo, anche piccole.
- NASTRI, BANNER, TARGHETTE e CARTIGLI con una scritta sopra: scegli SOLO la scritta (e i pallini o i fregi accanto), MAI il nastro: la scritta lucida sul nastro opaco e' il contrasto piu' bello. Se scegli anche il nastro, la scritta sparisce nel rilievo.
- Vanno in rilievo i DETTAGLI che caratterizzano il disegno: occhi, denti, unghie, creste, squame, corna, capelli, gioielli, stelline, pallini, ghirigori, foglie e rami, ornamenti, icone e piccoli simboli, contorni fini e linee decorative.
- Pallini, bolle, stelline, coriandoli e puntini SPARSI SULLO SFONDO sono decorazione, non sfondo: vanno in rilievo (danno l'effetto 'wow' con il gioco di luci). Se sono in un gruppo G, scegli il gruppo.
- Il CORPO PRINCIPALE di un personaggio o di una figura grande resta opaco (e' la base su cui i dettagli in rilievo risaltano), a meno che l'intero disegno sia un logo/lettering: allora le lettere vanno in rilievo per intero e i loro fori restano opachi.
- Non mettere in rilievo un filo di contorno attorno alle lettere se le lettere stesse sono in rilievo: il rilievo segue la lettera.
- Le zone segnate come "tratto sottile" sono linee: il contorno nero di un personaggio o di un oggetto resta opaco (e' solo un bordo); vanno invece in rilievo le linee che SONO il disegno (illustrazione a linee, tatuaggio, ghirigori, ornamenti, venature).
- Se un elemento e' diviso in piu' zone numerate (un teschio tagliato da linee nere, una lettera in due colori), scegli TUTTE le sue zone: mezzo elemento in rilievo e' un errore.
- Le zone G1, G2… sono GRUPPI di pezzi piccoli dello stesso colore (scritte piccole, pallini, stelline, nocche, foglioline, dettagli minuti). Scegliendo un gruppo alzi tutti i suoi pezzi. Se il gruppo ha il colore dello sfondo (i fori delle lettere, gli spazi fra i dettagli) NON sceglierlo; se ha il colore delle scritte e dei dettagli, scegli il gruppo cosi' le scritte piccole e i dettagli sono in rilievo.
- Meglio poche zone giuste che tante zone a caso: il rilievo deve avere un senso visivo. Ma ogni scritta e ogni dettaglio caratterizzante deve esserci.
- Le lettere grandi di un logo sono spesso divise in due o tre zone (parte chiara, parte colorata, ombra): la zona chiara di una lettera e' LETTERA, non sfondo. Elenca prima tutte le zone che compongono la scritta principale, poi il resto.
- Prima di rispondere, ricontrolla lettera per lettera: OGNI lettera della scritta principale e di quelle secondarie deve avere tutte le sue zone nell'elenco (le lettere sono spesso divise in piu' zone: parte chiara, parte scura, ombra). Una scritta con una lettera mancante e' un errore grave.

Rispondi SOLO con un oggetto JSON, senza altro testo:
{"rilievo":[numeri delle zone e sigle dei gruppi, es. 3, 7, "G2"], "motivo":"una frase in italiano che spiega la scelta"}`;

type Zona = { id: number | string; colore: string; area: number; pos: string; sottile?: boolean; fascia?: boolean; bordo?: boolean; pezzi?: number };

function admin() {
	const service = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!service || !PUBLIC_SUPABASE_URL) return null;
	return createClient(PUBLIC_SUPABASE_URL, service, { auth: { persistSession: false } });
}

function estraiJson(testo: string): { rilievo: string[]; motivo: string } | null {
	// il modello puo' avvolgere il JSON in un blocco ```json … ``` o aggiungere testo: si prende l'oggetto che contiene "rilievo"
	const pulito = testo.replace(/```(?:json)?/gi, '');
	const inizio = pulito.indexOf('{');
	const fine = pulito.lastIndexOf('}');
	if (inizio < 0 || fine <= inizio) return null;
	try {
		const o = JSON.parse(pulito.slice(inizio, fine + 1));
		const rilievo = Array.isArray(o.rilievo) ? o.rilievo.map((n: unknown) => String(n).trim().toUpperCase()).filter((n: string) => /^(G\d+|\d+)$/.test(n)) : [];
		return { rilievo, motivo: String(o.motivo ?? '') };
	} catch {
		/* JSON sbagliato (una parentesi al posto di un'altra): si leggono i numeri dell'elenco e la frase */
		const m = pulito.match(/"rilievo"\s*:\s*\[([^\]}]*)[\]}]/);
		if (!m) return null;
		const rilievo = (m[1].toUpperCase().match(/G\d+|\d+/g) ?? []);
		const mm = pulito.match(/"motivo"\s*:\s*"([^"]*)"/);
		return { rilievo, motivo: mm ? mm[1] : '' };
	}
}

/* il banco di prova locale (localhost:8790) chiama l'API con i file veri: CORS solo per lui */
const CORS_OK = new Set(['http://localhost:8790', 'http://127.0.0.1:8790']);
function cors(request: Request): Record<string, string> {
	const o = request.headers.get('origin') ?? '';
	return CORS_OK.has(o) ? { 'access-control-allow-origin': o, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' } : {};
}
export const OPTIONS: RequestHandler = async ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null) as { hash?: string; img?: string; overlay?: string; zone?: Zona[] } | null;
	if (!body?.hash || !body.img || !body.overlay || !Array.isArray(body.zone)) return json({ ok: false, motivo: 'richiesta incompleta' }, { status: 400, headers: cors(request) });
	const key = env.ANTHROPIC_API_KEY;
	if (!key) return json({ ok: false, motivo: 'analisi visiva non configurata' }, { status: 503, headers: cors(request) });

	const db = admin();
	if (db) {
		const { data } = await db.from('rilievo_ai').select('zone').eq('hash', body.hash).maybeSingle();
		if (data?.zone) return json({ ok: true, cache: true, ...(data.zone as object) }, { status: 200, headers: cors(request) });
	}

	const b64 = (u: string) => u.replace(/^data:image\/\w+;base64,/, '');
	const tipo = (u: string) => (/^data:image\/png/.test(u) ? 'image/png' : 'image/jpeg');
	const lista = body.zone
		.map((z) => `${z.id}: colore ${z.colore}, ${z.area}% dell'area, ${z.pos}${z.pezzi ? `, gruppo di ${z.pezzi} pezzi piccoli` : ''}${z.sottile ? ', tratto sottile' : ''}${z.bordo ? ', tocca il bordo esterno' : ''}`)
		.join('\n');

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
		body: JSON.stringify({
			model: MODELLO,
			max_tokens: 1500,
			thinking: { type: 'disabled' },   // niente blocco di ragionamento: serve solo il JSON
			system: REGOLE,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Immagine del cliente:' },
						{ type: 'image', source: { type: 'base64', media_type: tipo(body.img), data: b64(body.img) } },
						{ type: 'text', text: 'La stessa immagine con le zone numerate (il numero sta dentro la zona):' },
						{ type: 'image', source: { type: 'base64', media_type: tipo(body.overlay), data: b64(body.overlay) } },
						{ type: 'text', text: `Elenco delle zone:\n${lista}\n\nScegli le zone da mettere in rilievo. Rispondi solo con il JSON.` }
					]
				}
			]
		})
	}).catch(() => null);
	if (!res || !res.ok) {
		const err = res ? await res.text().catch(() => '') : 'rete';
		console.error('[rilievo ai]', res?.status, err.slice(0, 300));
		return json({ ok: false, motivo: 'analisi non riuscita', dettaglio: `HTTP ${res?.status ?? 0} ${err.slice(0, 300)}` }, { status: 502, headers: cors(request) });
	}
	const out = await res.json().catch(() => null) as { content?: { type: string; text?: string }[]; stop_reason?: string } | null;
	const testo = (out?.content ?? []).map((c) => c.text ?? '').join('\n');
	const scelta = estraiJson(testo);
	if (!scelta) {
		console.error('[rilievo ai] risposta non leggibile', out?.stop_reason, JSON.stringify(out).slice(0, 600));
		const blocchi = (out?.content ?? []).map((c) => `${c.type}:${(c.text ?? (c as { thinking?: string }).thinking ?? '').length}`).join(' ');
		return json({ ok: false, motivo: 'risposta non leggibile', dettaglio: `stop=${out?.stop_reason ?? '?'} blocchi=[${blocchi}] testo=${testo.slice(0, 300)}` }, { status: 502, headers: cors(request) });
	}
	const valide = new Set(body.zone.map((z) => String(z.id).toUpperCase()));
	scelta.rilievo = scelta.rilievo.filter((n) => valide.has(n));
	if (db) await db.from('rilievo_ai').upsert({ hash: body.hash, zone: scelta, modello: MODELLO });
	return json({ ok: true, ...scelta }, { status: 200, headers: cors(request) });
};
