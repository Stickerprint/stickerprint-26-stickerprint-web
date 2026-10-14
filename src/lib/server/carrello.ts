/**
 * Aggiunte al carrello per la Panoramica marketing: legge carrello_eventi (scritta da POST /api/carrello)
 * e la riassume per oggi, ieri, 7 e 30 giorni in una lettura sola, cosi' i filtri cambiano all'istante nella pagina.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { giornoRoma, inizioGiornoRoma, piuGiorni } from '$lib/dashboard/tempo';

export type PeriodoCarrello = 'oggi' | 'ieri' | '7' | '30';
export const PERIODI_CARRELLO: { id: PeriodoCarrello; label: string }[] = [{ id: 'oggi', label: 'Oggi' }, { id: 'ieri', label: 'Ieri' }, { id: '7', label: 'Ultimi 7 giorni' }, { id: '30', label: 'Ultimi 30 giorni' }];
export interface RiassuntoCarrello {
	periodo: PeriodoCarrello; da: string; a: string;
	aggiunte: number; visitatori: number; pezzi: number; valore: number;
	/** confronto con il periodo precedente della stessa lunghezza */
	prima: { aggiunte: number; visitatori: number; valore: number };
	prodotti: { prodotto: string; nome: string; aggiunte: number; valore: number }[];
	giorni: { giorno: string; aggiunte: number; valore: number }[];
	dispositivi: { nome: string; aggiunte: number }[];
}
export interface EventoCarrello { id: string; creato_il: string; visitatore: string; prodotto: string; nome: string; forma: string | null; materiale: string | null; finitura: string | null; larghezza_mm: number | null; altezza_mm: number | null; qta: number; netto: number; lordo: number; sorgente: string; promo: string | null; dispositivo: string | null }
export interface CarrelloDati { stato: 'dati'; oggi: string; riassunti: Record<PeriodoCarrello, RiassuntoCarrello>; ultime: EventoCarrello[]; totaleStorico: number }
export type StatoCarrello = CarrelloDati | { stato: 'vuoto'; oggi: string } | { stato: 'errore'; errore: string };

const r2 = (v: number) => Math.round(v * 100) / 100;
const giornoDi = (iso: string) => giornoRoma(new Date(iso));
function intervallo(periodo: PeriodoCarrello, oggi: string): { da: string; a: string } {
	if (periodo === 'oggi') return { da: oggi, a: oggi };
	if (periodo === 'ieri') { const i = piuGiorni(oggi, -1); return { da: i, a: i }; }
	return { da: piuGiorni(oggi, -(Number(periodo) - 1)), a: oggi };
}
/** riassume gli eventi tra due giorni compresi (yyyy-mm-dd, ora italiana). Pura: si prova senza database. */
export function riassumi(eventi: EventoCarrello[], periodo: PeriodoCarrello, oggi: string): RiassuntoCarrello {
	const { da, a } = intervallo(periodo, oggi);
	const n = Number(periodo) || 1;
	const primaA = piuGiorni(da, -1), primaDa = piuGiorni(primaA, -(n - 1));
	const dentro = eventi.filter((e) => { const g = giornoDi(e.creato_il); return g >= da && g <= a; });
	const prima = eventi.filter((e) => { const g = giornoDi(e.creato_il); return g >= primaDa && g <= primaA; });
	const prod = new Map<string, { prodotto: string; nome: string; aggiunte: number; valore: number }>();
	const gg = new Map<string, { giorno: string; aggiunte: number; valore: number }>();
	const disp = new Map<string, number>();
	for (let i = 0; i < n; i++) { const g = piuGiorni(da, i); gg.set(g, { giorno: g, aggiunte: 0, valore: 0 }); }
	for (const e of dentro) {
		const p = prod.get(e.prodotto) ?? { prodotto: e.prodotto, nome: e.nome || e.prodotto, aggiunte: 0, valore: 0 };
		p.aggiunte++; p.valore = r2(p.valore + Number(e.lordo)); prod.set(e.prodotto, p);
		const g = gg.get(giornoDi(e.creato_il)); if (g) { g.aggiunte++; g.valore = r2(g.valore + Number(e.lordo)); }
		const d = e.dispositivo ?? 'sconosciuto'; disp.set(d, (disp.get(d) ?? 0) + 1);
	}
	return {
		periodo, da, a,
		aggiunte: dentro.length, visitatori: new Set(dentro.map((e) => e.visitatore)).size, pezzi: dentro.reduce((s, e) => s + e.qta, 0), valore: r2(dentro.reduce((s, e) => s + Number(e.lordo), 0)),
		prima: { aggiunte: prima.length, visitatori: new Set(prima.map((e) => e.visitatore)).size, valore: r2(prima.reduce((s, e) => s + Number(e.lordo), 0)) },
		prodotti: [...prod.values()].sort((x, y) => y.aggiunte - x.aggiunte).slice(0, 6),
		giorni: [...gg.values()],
		dispositivi: [...disp.entries()].map(([nome, aggiunte]) => ({ nome, aggiunte })).sort((x, y) => y.aggiunte - x.aggiunte)
	};
}

export async function aggiunteCarrello(db: SupabaseClient): Promise<StatoCarrello> {
	const oggi = giornoRoma();
	// 60 giorni: i 30 del periodo piu' lungo e i 30 prima per il confronto
	const da = inizioGiornoRoma(piuGiorni(oggi, -59)).toISOString();
	const [{ data, error }, { count }] = await Promise.all([
		db.from('carrello_eventi').select('id, creato_il, visitatore, prodotto, nome, forma, materiale, finitura, larghezza_mm, altezza_mm, qta, netto, lordo, sorgente, promo, dispositivo').gte('creato_il', da).order('creato_il', { ascending: false }).limit(20000),
		db.from('carrello_eventi').select('id', { count: 'exact', head: true })
	]);
	if (error) return { stato: 'errore', errore: error.message };
	const eventi = (data ?? []) as EventoCarrello[];
	if (!count) return { stato: 'vuoto', oggi };
	const riassunti = Object.fromEntries((['oggi', 'ieri', '7', '30'] as PeriodoCarrello[]).map((p) => [p, riassumi(eventi, p, oggi)])) as Record<PeriodoCarrello, RiassuntoCarrello>;
	return { stato: 'dati', oggi, riassunti, ultime: eventi.slice(0, 8), totaleStorico: count };
}
