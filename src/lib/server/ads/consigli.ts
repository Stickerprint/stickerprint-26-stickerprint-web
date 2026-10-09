/**
 * I consigli: regole (src/lib/marketing/analisi.ts) + un testo scritto dall'assistente sui verdetti delle regole.
 * Il report si salva in marketing_report e si rilegge dalle pagine: non si rigenera a ogni apertura
 * (costa e cambia poco), ma col bottone "Aggiorna i consigli" o dal cron del lunedì.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { CANALI, NOME_CANALE, type Canale, type Obiettivi, type StatoCanale } from '$lib/marketing/ads-tipi';
import { analizzaCanale, analizzaTutto, cpaObiettivo, type AnalisiCanale, type AnalisiTotale } from '$lib/marketing/analisi';
import { leggiTutti, ultimiGiorni, type Periodo } from './index';

type DB = SupabaseClient;
const MODEL = () => env.MARKETING_MODEL || 'claude-sonnet-5-5';
export const assistenteDisponibile = () => Boolean(env.ANTHROPIC_API_KEY);

export interface Report { id: string; canale: Canale | 'tutti'; periodo: Periodo; analisi: AnalisiCanale | AnalisiTotale; testo: string | null; modello: string | null; generatoIl: string }

export async function ultimoReport(db: DB, canale: Canale | 'tutti'): Promise<Report | null> {
	const { data } = await db.from('marketing_report').select('id, canale, periodo_da, periodo_a, analisi, testo, modello, generato_il').eq('canale', canale).order('generato_il', { ascending: false }).limit(1).maybeSingle();
	if (!data) return null;
	return { id: data.id, canale: data.canale, periodo: { da: data.periodo_da, a: data.periodo_a }, analisi: data.analisi, testo: data.testo, modello: data.modello, generatoIl: data.generato_il };
}

const SISTEMA = `Sei il responsabile marketing di Stickerprint, una tipografia italiana che stampa adesivi personalizzati, etichette, adesivi resinati e in rilievo e vende online a privati e aziende (ordine medio qualche decina di euro, margini da stampa digitale). Ricevi i numeri delle campagne pubblicitarie e i verdetti già calcolati dalle regole della dashboard: il tuo compito è spiegarli al titolare, Mattia, che non è un tecnico.
Scrivi in italiano, dai del tu, frasi corte e concrete, niente gergo inglese se c'è la parola italiana (spesa, ordini, ritorno, costo per ordine). Non inventare numeri: usa solo quelli che ricevi. Non contraddire i verdetti delle regole; puoi aggiungere sfumature (stagionalità, pochi dati, creatività da rifare).
Rispondi con esattamente queste tre sezioni, ognuna con il titolo su una riga che inizia con "## ":
## Come sta andando
3-5 frasi sul periodo: spesa, ordini, ritorno, confronto col periodo prima, cosa salta all'occhio.
## Cosa farei questa settimana
Un elenco puntato (massimo 6 punti) di mosse concrete, nominando le campagne per nome: cosa spingere, cosa spegnere, cosa lasciare, cosa controllare.
## Budget
2-4 frasi: quanto spendere al mese e come dividerlo, con i numeri proposti dalle regole, e a che condizione alzarlo o abbassarlo.`;

async function scrivi(analisi: AnalisiCanale | AnalisiTotale, o: Obiettivi, ambito: string): Promise<string | null> {
	const key = env.ANTHROPIC_API_KEY;
	if (!key) return null;
	const compatto = JSON.stringify({ ambito, obiettivi: { ritornoMinimo: o.roasTarget, costoMassimoPerOrdine: cpaObiettivo(o), valoreMedioOrdine: o.valoreOrdine, tettoMensile: o.budgetMese, quote: o.quote, note: o.note || undefined }, analisi }, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
		body: JSON.stringify({ model: MODEL(), max_tokens: 1500, system: SISTEMA, messages: [{ role: 'user', content: `Ecco i numeri e i verdetti (JSON). Scrivi il report.\n\n${compatto}` }] })
	});
	const j = await res.json();
	if (!res.ok) throw new Error(`Assistente: ${j.error?.message ?? res.status}`);
	return (j.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim() || null;
}

/** Genera e salva il report di un canale (o di tutti). Torna il report o il motivo per cui non si è potuto fare. */
export async function generaReport(db: DB, canale: Canale | 'tutti', o: Obiettivi, giorni = 30, letti?: StatoCanale[]): Promise<{ ok: true; report: Report } | { ok: false; errore: string }> {
	const periodo = ultimiGiorni(giorni);
	const stati = letti ?? (await leggiTutti(periodo));
	const conDati = stati.filter((s) => s.dati && (canale === 'tutti' || s.canale === canale));
	if (!conDati.length) {
		const s = stati.find((x) => x.canale === canale);
		return { ok: false, errore: canale === 'tutti' ? 'Nessun canale collegato: niente da analizzare.' : s?.errore ?? `${NOME_CANALE[canale as Canale]} non è collegato.` };
	}
	const perCanale = conDati.map((s) => analizzaCanale(s.dati!, o));
	const analisi = canale === 'tutti' ? analizzaTutto(perCanale, o) : perCanale[0];
	let testo: string | null = null;
	let avviso = '';
	try { testo = await scrivi(analisi, o, canale === 'tutti' ? 'tutti i canali insieme' : NOME_CANALE[canale]); }
	catch (e) { avviso = e instanceof Error ? e.message : 'Errore'; }
	const dati = Object.fromEntries(conDati.map((s) => [s.canale, { kpi: s.dati!.kpi, prima: s.dati!.prima, spesaMese: s.dati!.spesaMese, campagne: s.dati!.campagne.map(({ piattaforme, ...c }) => c) }]));
	const { data, error } = await db.from('marketing_report').insert({ canale, periodo_da: periodo.da, periodo_a: periodo.a, dati, analisi, testo, modello: testo ? MODEL() : null }).select('id, generato_il').single();
	if (error) return { ok: false, errore: error.message };
	if (!testo && avviso) console.warn('[marketing] testo dei consigli non scritto:', avviso);
	return { ok: true, report: { id: data.id, canale, periodo, analisi, testo, modello: testo ? MODEL() : null, generatoIl: data.generato_il } };
}

/** Tutti i report in un giro (cron del lunedì): panoramica più un report per ogni canale che risponde. */
export async function generaTuttiIReport(db: DB, o: Obiettivi, giorni = 30): Promise<Record<string, string>> {
	const stati = await leggiTutti(ultimiGiorni(giorni));
	const esito: Record<string, string> = {};
	for (const c of ['tutti', ...CANALI] as const) {
		const r = await generaReport(db, c, o, giorni, stati);
		esito[c] = r.ok ? (r.report.testo ? 'ok' : 'solo regole') : r.errore;
	}
	return esito;
}
