/** Analisi margini: spesa pubblicitaria per canale e per mese (condiviso fra server e pagine). */
import type { Canale } from '$lib/marketing/ads-tipi';

export interface SpesaCanale {
	canale: Canale;
	nome: string;
	/** ok = letta dalla piattaforma; storico = piattaforma in errore, uso lo storico salvato ogni notte */
	stato: 'ok' | 'storico' | 'non_collegato' | 'errore';
	/** perche' il dato manca o viene dallo storico (sempre scritto quando stato non e' ok) */
	motivo: string | null;
	/** spesa di ogni mese dell'anno (0 = gennaio), in euro IVA esclusa */
	mesi: number[];
}
export interface SpesaAds { anno: number; canali: SpesaCanale[]; aggiornato: string }

/** spesa di un canale nel periodo: tutto l'anno o un mese */
export const spesaPeriodo = (c: SpesaCanale, periodo: string) => (periodo === 'anno' ? c.mesi.reduce((s, v) => s + v, 0) : c.mesi[Number(periodo)] ?? 0);
/** canali con un numero vero (letti o dallo storico) */
export const conDato = (s: SpesaAds | null) => (s?.canali ?? []).filter((c) => c.stato === 'ok' || c.stato === 'storico');
