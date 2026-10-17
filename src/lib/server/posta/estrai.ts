/**
 * L'assistente legge la mail e dice cos'e' (ordine, richiesta di preventivo, altro) e cosa chiede:
 * righe con file, quantita' e lavorazione. Risposta in JSON con schema fisso: niente testo libero.
 */
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { Estratto } from './tipi';

const MODELLO = () => env.POSTA_MODEL || 'claude-sonnet-5-5';
export const assistentePosta = () => Boolean(env.ANTHROPIC_API_KEY);

const SCHEMA = {
	type: 'object',
	properties: {
		tipo: { type: 'string', enum: ['ordine', 'preventivo', 'altro'] },
		motivo: { type: 'string', description: 'una frase: perche\' hai scelto questo tipo' },
		cliente: { type: 'object', properties: { azienda: { type: ['string', 'null'] }, nome: { type: ['string', 'null'] }, telefono: { type: ['string', 'null'] } }, required: ['azienda', 'nome', 'telefono'], additionalProperties: false },
		righe: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					file: { type: ['string', 'null'], description: 'nome esatto dell\'allegato a cui si riferisce la riga, preso dall\'elenco degli allegati; null se non c\'e\'' },
					descrizione: { type: 'string', description: 'cosa va stampato, con le parole del cliente' },
					quantita: { type: ['number', 'null'], description: 'pezzi scritti nel TESTO della mail; null se non scritti' },
					lavorazione: { type: ['string', 'null'], enum: ['resinata', 'plastificata', 'carta_coprente', 'nessuna', null] },
					misura_mm: { type: ['string', 'null'], description: 'misura scritta nel testo, es. "11,9 mm" o "50x30"; null se non scritta' },
					prezzo_unitario: { type: ['number', 'null'], description: 'prezzo al pezzo scritto nel testo (es. preventivo confermato); null altrimenti' },
					note: { type: ['string', 'null'] }
				},
				required: ['file', 'descrizione', 'quantita', 'lavorazione', 'misura_mm', 'prezzo_unitario', 'note'],
				additionalProperties: false
			}
		},
		urgenza: { type: ['string', 'null'] },
		conferma_preventivo: { type: ['string', 'null'], description: 'se il cliente conferma un preventivo gia\' fatto: il numero (SPP...) o la frase; altrimenti null' }
	},
	required: ['tipo', 'motivo', 'cliente', 'righe', 'urgenza', 'conferma_preventivo'],
	additionalProperties: false
};

const SISTEMA = `Sei l'addetto agli ordini di Stickerprint (stampa di adesivi ed etichette, Italia). Leggi UNA mail ricevuta e rispondi col JSON richiesto.

Classifica:
- "ordine": il cliente chiede di PRODURRE qualcosa (anche con parole semplici: "ti mando le etichette da fare", "2 schede misura nuova pz 400", "conferma del preventivo", "procedi"). Le righe sono gli articoli da stampare.
- "preventivo": chiede un prezzo, una quotazione, informazioni per decidere, campioni, prove: non ha ancora deciso di comprare.
- "altro": tutto il resto (risposte senza richiesta, ringraziamenti, solleciti, fatture, fornitori, newsletter, notifiche automatiche, conferme di inoltro di Gmail, mail che chiedono solo "a che punto siamo").

Regole sulle righe degli ordini:
- Le QUANTITA' sono quelle scritte nel testo della mail. Il nome del file spesso contiene "_250pz": e' un indizio, ma se il testo dice un numero diverso vince il testo; se il testo non dice niente usa il numero nel nome del file.
- Una riga per ogni articolo. Esempi: "- 99646NH_SOFIBAC_5m_370pz" dentro "tutte plastificate" = file 99646NH_SOFIBAC_5m_370pz.pdf, quantita' 370, lavorazione plastificata. "1000 pz resinate (etichetta e bollino giallo), l'etichetta nera normale" = righe con lavorazioni diverse.
- Lavorazione: resinata (resina, resinate, cupola), plastificata (plastificate, laminate), carta_coprente, nessuna (normale, semplice, carta). Se non e' scritta: null.
- Abbina ogni riga al nome ESATTO di un allegato dell'elenco quando e' chiaro (stesso codice o stesso nome); altrimenti file null.
- Comaplast scrive "schede": ogni scheda e' una riga; "misura nuova" e' l'etichetta rettangolare, "11,9" o "tonde" quella tonda piccola.
- Non inventare: se un dato non c'e', metti null e spiegalo in note.`;

export async function estraiMail(m: { mittente: string; nome: string | null; oggetto: string | null; testo: string; allegati: string[] }): Promise<{ estratto: Estratto; modello: string }> {
	if (!env.ANTHROPIC_API_KEY) throw new Error('manca ANTHROPIC_API_KEY su Vercel');
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const corpo = m.testo.replace(/\r/g, '').slice(0, 12000);
	const res = await client.beta.messages.create({
		model: MODELLO(),
		max_tokens: 4000,
		betas: ['server-side-fallback-2026-07-01'],
		fallbacks: 'default',
		output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
		system: SISTEMA,
		messages: [{ role: 'user', content: `Da: ${m.nome ? `${m.nome} <${m.mittente}>` : m.mittente}\nOggetto: ${m.oggetto ?? '(senza oggetto)'}\nAllegati: ${m.allegati.length ? m.allegati.join(' | ') : 'nessuno'}\n\n---\n${corpo}` }]
	});
	if (res.stop_reason === 'refusal') throw new Error('l’assistente ha rifiutato la richiesta');
	const testo = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
	const e = JSON.parse(testo) as Estratto;
	e.righe = (e.righe ?? []).map((r) => ({ ...r, quantita: r.quantita != null && r.quantita > 0 ? Math.round(r.quantita) : null }));
	return { estratto: e, modello: res.model };
}
