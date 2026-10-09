/**
 * Analisi margini: rating del mese (AAA … D) e commento in stile report finanziario.
 * Ogni lunedi' si salva un rating provvisorio del mese in corso; il 1° del mese quello del mese appena chiuso
 * diventa definitivo (fatturato completo). Si puo' aggiornare anche a mano dalla pagina.
 * La lettera viene dalle regole (src/lib/margini/rating.ts); il commento lo scrive l'assistente sui numeri
 * del mese e non puo' cambiare la lettera. Senza assistente (ANTHROPIC_API_KEY) il commento lo scrivono le regole.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { CATS, groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { contestoMargini, indiceFatture, margineOrdine, COLONNE_FATTURA, type FatturaMargine } from '$lib/server/margini';
import { spesaAnno } from '$lib/server/ads/spesa';
import { conDato, type SpesaAds } from '$lib/margini/ads';
import { materiali, perProdotto, totali } from '$lib/margini/aggrega';
import { calcolaRating, commentoRegole, type InputRating, type Rating } from '$lib/margini/rating';
import type { OrdineMargine } from '$lib/margini/tipi';

type DB = SupabaseClient;
const MODELLO = () => env.MARGINI_MODEL || 'claude-opus-5-5';
export const assistenteRating = () => Boolean(env.ANTHROPIC_API_KEY);

export interface RigaRating {
	id: string; mese: string; lettera: string; punteggio: number; definitivo: boolean; dati_fino_al: string;
	dati: { rating: Rating; input: InputRating; avviso?: string | null };
	pro: string[]; contro: string[]; considerazioni: string | null; autore: 'assistente' | 'regole'; modello: string | null; generato_il: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const r2 = (v: number) => Math.round(v * 100) / 100;
const giorniDel = (y: number, m: number) => new Date(y, m, 0).getDate();
export const meseDopo = (mese: string) => { const [y, m] = mese.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
export const mesePrima = (mese: string) => { const [y, m] = mese.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
/** mese di oggi in Italia (yyyy-mm) e giorno */
export function oggiItalia(): { mese: string; giorno: number; iso: string } {
	const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	return { mese: p.slice(0, 7), giorno: Number(p.slice(8, 10)), iso: p };
}

const spesaMese = (s: SpesaAds | null, m: number): number | null => { const c = conDato(s); return c.length ? r2(c.reduce((t, x) => t + (x.mesi[m - 1] ?? 0), 0)) : null; };

/** numeri del mese e del mese prima, pronti per il rating e per il commento */
async function numeri(db: DB, mese: string, definitivo: boolean) {
	const [y, m] = mese.split('-').map(Number);
	const prima = mesePrima(mese);
	const [py, pm] = prima.split('-').map(Number);
	const [{ data: righe, error }, { data: fatture }, ctx, adsAnno, adsPrimaAnno] = await Promise.all([
		db.from('orders').select('*').gte('created_at', `${prima}-01`).lt('created_at', `${meseDopo(mese)}-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').limit(5000),
		db.from('invoices').select(COLONNE_FATTURA).gte('issued_at', `${mesePrima(prima)}-01`).lt('issued_at', `${meseDopo(meseDopo(mese))}-01`).limit(5000),
		contestoMargini(db),
		spesaAnno(db, y).catch(() => null),
		py !== y ? spesaAnno(db, py).catch(() => null) : Promise.resolve(null)
	]);
	if (error) throw new Error(error.message);
	const fatturaDi = indiceFatture((fatture ?? []) as FatturaMargine[]);
	const tutti = groupOrders((righe ?? []) as OrderRow[]).map((g) => margineOrdine(g, ctx, fatturaDi(g)));
	const delMese = (k: string) => tutti.filter((o) => o.created_at.slice(0, 7) === k);
	const cur = delMese(mese), prev = delMese(prima);
	const t = totali(cur), tp = totali(prev);
	const sito = totali(cur.filter((o: OrdineMargine) => o.channel !== 'manuale'));
	const ads = spesaMese(adsAnno, m);
	const adsPrima = spesaMese(py !== y ? adsPrimaAnno : adsAnno, pm);
	const oggi = oggiItalia();
	const chiuso = definitivo || mese < oggi.mese;
	const giorniMese = giorniDel(y, m);
	const giorniTrascorsi = chiuso ? giorniMese : mese === oggi.mese ? Math.min(oggi.giorno, giorniMese) : 0;
	const input: InputRating = {
		mese, giorniTrascorsi, giorniMese, ordini: t.ordini, ordiniSito: t.sito, daCompletare: t.daCompletare,
		fatturato: t.fatturato, calcolato: t.calcolato, costoProduzione: t.costo.totale, ads, fatturatoSito: sito.fatturato,
		prima: prev.length ? { calcolato: tp.calcolato, fatturato: tp.fatturato, giorni: giorniDel(py, pm), margineNettoPct: tp.calcolato > 0 ? Math.round(((tp.calcolato - tp.costo.totale - (adsPrima ?? 0)) / tp.calcolato) * 1000) / 10 : null } : null
	};
	const nome = (s: string) => CATS[s]?.name ?? (s === 'kit_adesivi' ? 'Kit di adesivi' : s);
	const mat = materiali(cur, nome);
	/* quello che legge l'assistente: solo numeri gia' calcolati, arrotondati */
	const riepilogo = {
		mese, statoMese: chiuso ? 'chiuso' : `in corso: ${giorniTrascorsi} giorni su ${giorniMese}`,
		ordini: { totali: t.ordini, sito: t.sito, manuali: t.manuali, senzaMisura: t.daCompletare, fatturatoSenzaCosto: r2(t.fatturato - t.calcolato) },
		fatturatoNetto: t.fatturato, fatturatoConCostoCalcolato: t.calcolato,
		ricavo: t.ricavo, costi: { ...t.costo, pubblicita: ads },
		pubblicitaPerCanale: (adsAnno?.canali ?? []).map((c) => ({ canale: c.nome, stato: c.stato, spesa: c.mesi[m - 1] ?? 0, nota: c.motivo })),
		fatturatoSito: sito.fatturato,
		prodotti: perProdotto(cur).slice(0, 8).map((p) => ({ prodotto: nome(p.slug), ordini: p.ordini, pezzi: p.pezzi, fatturato: p.ricavo, costoMateriale: p.costo, margine: p.margine, marginePct: p.marginePct, senzaMisura: p.senzaCosto })),
		materiale: { bobinaMetri: r2(mat.bobinaMm / 1000), bobinaM2: mat.bobinaM2, resaPct: mat.resaPct, pezziStampati: mat.pezziDaFare, vinili: mat.vinili.map((v) => ({ tipo: v.label, m2: v.m2 })) },
		mesePrima: prev.length ? { mese: prima, fatturato: tp.fatturato, margineDopoPubblicitaPct: input.prima?.margineNettoPct ?? null, pubblicita: adsPrima, ordini: tp.ordini } : null,
		esclusiDalMargine: ['manodopera', 'imballo', 'commissioni di pagamento', 'avvio macchina']
	};
	return { input, riepilogo, chiuso, oggi };
}

const SISTEMA = `Sei l'analista di un'agenzia di rating che ogni mese valuta la salute economica di Stickerprint, una tipografia italiana che stampa adesivi personalizzati, etichette, adesivi resinati e in rilievo e li vende online e a clienti diretti. Scrivi per il titolare, Mattia: tono professionale da report finanziario, ma chiaro per chi non è un tecnico. Italiano, frasi corte, niente gergo inglese quando esiste la parola italiana.
Ricevi i numeri del mese e il rating già calcolato dalle regole della dashboard (lettera, punteggio e le quattro voci con i loro punti). Non cambiare la lettera e non contraddire le regole: spiegale, metti in fila cause ed effetti, aggiungi sfumature (stagionalità, pochi ordini, mese ancora in corso, ordini senza misura che restano fuori dal margine).
Usa solo i numeri che ricevi, citandoli quando servono (euro con la virgola, es. 1.234,50 €). Non inventare dati che mancano: se un dato manca, dillo. Ricorda che il margine comprende materiale, corriere e pubblicità ma non manodopera, imballo e commissioni.
Rispondi solo con il JSON richiesto:
- pro: da 2 a 5 punti di forza, una frase ciascuno;
- contro: da 2 a 5 debolezze o rischi, una frase ciascuno;
- considerazioni: 4-7 frasi di considerazioni finali: giudizio complessivo, cosa sostiene o minaccia il rating, e cosa fare o guardare nelle prossime settimane per migliorarlo.`;

const SCHEMA = {
	type: 'object',
	properties: {
		pro: { type: 'array', items: { type: 'string' } },
		contro: { type: 'array', items: { type: 'string' } },
		considerazioni: { type: 'string' }
	},
	required: ['pro', 'contro', 'considerazioni'],
	additionalProperties: false
};

async function scrivi(rating: Rating, riepilogo: unknown): Promise<{ pro: string[]; contro: string[]; considerazioni: string }> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const res = await client.beta.messages.create({
		model: MODELLO(),
		max_tokens: 16000,
		/* se il modello rifiuta, l'API ripete la richiesta su un altro modello da sola */
		betas: ['server-side-fallback-2026-07-01'],
		fallbacks: 'default',
		output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
		system: SISTEMA,
		messages: [{ role: 'user', content: `Rating del mese e numeri (JSON). Scrivi il report.\n\n${JSON.stringify({ rating, numeri: riepilogo })}` }]
	});
	if (res.stop_reason === 'refusal') throw new Error('l’assistente ha rifiutato la richiesta');
	if (res.stop_reason === 'max_tokens') throw new Error('risposta troncata');
	const testo = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
	const j = JSON.parse(testo) as { pro?: unknown; contro?: unknown; considerazioni?: unknown };
	const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 6) : []);
	const out = { pro: lista(j.pro), contro: lista(j.contro), considerazioni: String(j.considerazioni ?? '').trim() };
	if (!out.pro.length || !out.contro.length || !out.considerazioni) throw new Error('risposta incompleta');
	return out;
}

/** Calcola, fa scrivere il commento e salva il rating di un mese. */
export async function generaRating(db: DB, mese: string, definitivo: boolean): Promise<{ ok: true; riga: RigaRating } | { ok: false; errore: string }> {
	if (!/^\d{4}-\d{2}$/.test(mese)) return { ok: false, errore: 'Mese non valido.' };
	const { input, riepilogo, chiuso, oggi } = await numeri(db, mese, definitivo);
	if (definitivo && !chiuso) return { ok: false, errore: 'Il mese non è ancora finito: il rating può essere solo provvisorio.' };
	if (!input.ordini) return { ok: false, errore: `Nessun ordine in ${mese}: niente da valutare.` };
	const rating = calcolaRating(input);
	let commento = commentoRegole(rating, input);
	let autore: RigaRating['autore'] = 'regole', avviso: string | null = null;
	if (assistenteRating()) {
		try { commento = await scrivi(rating, riepilogo); autore = 'assistente'; }
		catch (e) {
			avviso = e instanceof Anthropic.APIError ? `assistente non raggiungibile (${e.status ?? 'rete'}): ${e.message}` : `assistente: ${e instanceof Error ? e.message : 'errore'}`;
			console.warn('[margini] commento scritto dalle regole:', avviso);
		}
	} else avviso = 'assistente non collegato: manca ANTHROPIC_API_KEY su Vercel';
	const [y, m] = mese.split('-').map(Number);
	const finoAl = chiuso ? `${mese}-${pad(giorniDel(y, m))}` : oggi.iso;
	const { data, error } = await db.from('margini_rating').insert({
		mese, lettera: rating.lettera, punteggio: rating.punteggio, definitivo, dati_fino_al: finoAl,
		dati: { rating, input, avviso }, pro: commento.pro, contro: commento.contro, considerazioni: commento.considerazioni,
		autore, modello: autore === 'assistente' ? MODELLO() : null
	}).select('*').single();
	if (error) return { ok: false, errore: error.code === '23505' ? `Il rating di ${mese} è già definitivo.` : error.message };
	return { ok: true, riga: data as RigaRating };
}

/** ultimo rating di ogni mese dell'anno: il definitivo se c'e', altrimenti il provvisorio piu' recente; piu' lo storico delle lettere */
export async function ratingAnno(db: DB, anno: number): Promise<{ perMese: Record<string, RigaRating>; storico: Record<string, { lettera: string; definitivo: boolean; generato_il: string }[]> }> {
	const { data } = await db.from('margini_rating').select('*').gte('mese', `${anno}-01`).lte('mese', `${anno}-12`).order('generato_il', { ascending: false }).limit(400);
	const perMese: Record<string, RigaRating> = {};
	const storico: Record<string, { lettera: string; definitivo: boolean; generato_il: string }[]> = {};
	for (const r of (data ?? []) as RigaRating[]) {
		const cur = perMese[r.mese];
		if (!cur || (r.definitivo && !cur.definitivo)) perMese[r.mese] = r;
		(storico[r.mese] ??= []).push({ lettera: r.lettera, definitivo: r.definitivo, generato_il: r.generato_il });
	}
	return { perMese, storico };
}
