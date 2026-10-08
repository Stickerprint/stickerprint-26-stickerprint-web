/**
 * Tipi condivisi dell'area Marketing interna: ogni canale pubblicitario (Meta, Google, TikTok)
 * viene letto dal suo modulo in src/lib/server/ads/ e riportato in questa forma unica,
 * così panoramica, pagine dei canali e regole dei consigli ragionano sugli stessi campi.
 */
export type Canale = 'meta' | 'google' | 'tiktok';
export const CANALI: Canale[] = ['meta', 'google', 'tiktok'];
export const NOME_CANALE: Record<Canale, string> = { meta: 'Meta (Instagram e Facebook)', google: 'Google Ads', tiktok: 'TikTok Ads' };
export const NOME_BREVE: Record<Canale, string> = { meta: 'Meta', google: 'Google', tiktok: 'TikTok' };

export type StatoCampagna = 'attiva' | 'in_pausa' | 'altro';

export interface Campagna {
	canale: Canale;
	id: string;
	nome: string;
	stato: StatoCampagna;
	statoOriginale: string;
	obiettivo: string;
	/** budget giornaliero in euro; null se la campagna non ha un tetto giornaliero (budget sui gruppi o totale) */
	budgetGiorno: number | null;
	/** budget totale della campagna, quando è quello il tipo */
	budgetTotale: number | null;
	/** true se il budget si può cambiare da qui (giornaliero, non condiviso) */
	budgetModificabile: boolean;
	spesa: number;
	impressioni: number;
	clic: number;
	conversioni: number;
	/** valore delle conversioni in euro, null se il canale non lo misura */
	valore: number | null;
	/** Meta: spesa e risultati divisi per piattaforma (instagram, facebook, altro) */
	piattaforme?: Record<string, Risultati>;
}

export interface Risultati { spesa: number; impressioni: number; clic: number; conversioni: number; valore: number | null }

export interface CanaleDati {
	canale: Canale;
	account: string;
	periodo: { da: string; a: string };
	kpi: Risultati;
	/** stesso numero di giorni, subito prima del periodo (per i confronti); null se non letto */
	prima: Risultati | null;
	spesaMese: number;
	giorni: { giorno: string; spesa: number; clic: number; conversioni: number; valore: number | null }[];
	campagne: Campagna[];
	piattaforme?: Record<string, Risultati>;
	aggiornato: string;
}

export type StatoCanale =
	| { canale: Canale; configurato: false; mancanti: string[]; dati: null; errore: null }
	| { canale: Canale; configurato: true; mancanti: []; dati: null; errore: string }
	| { canale: Canale; configurato: true; mancanti: []; dati: CanaleDati; errore: null };

/** Obiettivi scelti in Marketing → Impostazioni (tabella marketing_impostazioni). */
export interface Obiettivi {
	budgetMese: number | null;
	quote: Partial<Record<Canale, number>>;
	valoreOrdine: number;
	roasTarget: number;
	cpaTarget: number | null;
	note: string;
}
export const OBIETTIVI_DEFAULT: Obiettivi = { budgetMese: null, quote: {}, valoreOrdine: 45, roasTarget: 3, cpaTarget: null, note: '' };

export const ctr = (r: Risultati) => (r.impressioni ? (r.clic / r.impressioni) * 100 : null);
export const cpc = (r: Risultati) => (r.clic ? r.spesa / r.clic : null);
export const cpa = (r: Risultati) => (r.conversioni ? r.spesa / r.conversioni : null);
export const roas = (r: Risultati) => (r.spesa && r.valore != null ? r.valore / r.spesa : null);
export const sommaRisultati = (xs: Risultati[]): Risultati => {
	const s: Risultati = { spesa: 0, impressioni: 0, clic: 0, conversioni: 0, valore: null };
	for (const x of xs) {
		s.spesa += x.spesa; s.impressioni += x.impressioni; s.clic += x.clic; s.conversioni += x.conversioni;
		if (x.valore != null) s.valore = (s.valore ?? 0) + x.valore;
	}
	return s;
};
