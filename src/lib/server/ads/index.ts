/**
 * Un punto solo per i tre canali: leggi un canale (o tutti) in forma unica, cambia budget e stato.
 * Ogni canale ha tre stati: non configurato (mancano le variabili su Vercel), errore (le chiavi ci sono ma
 * la piattaforma non risponde), dati. Un canale rotto non blocca mai gli altri.
 */
import type { Canale, StatoCanale } from '$lib/marketing/ads-tipi';
import { CANALI } from '$lib/marketing/ads-tipi';
import { getMeta, metaBudget, metaConfigured, metaMissing, metaStato } from './meta';
import { getGoogleAds, googleAdsConfigured, googleAdsMissing, googleBudget, googleStato } from './google';
import { getTiktok, tiktokBudget, tiktokConfigured, tiktokMissing, tiktokStato } from './tiktok';
import type { Periodo } from './periodo';
export { ultimiGiorni, nGiorni, type Periodo } from './periodo';

const MODULI = {
	meta: { configurato: metaConfigured, mancanti: metaMissing, leggi: getMeta, budget: metaBudget, stato: metaStato },
	google: { configurato: googleAdsConfigured, mancanti: googleAdsMissing, leggi: getGoogleAds, budget: googleBudget, stato: googleStato },
	tiktok: { configurato: tiktokConfigured, mancanti: tiktokMissing, leggi: getTiktok, budget: tiktokBudget, stato: tiktokStato }
} as const;

export const canaleConfigurato = (c: Canale) => MODULI[c].configurato();
export const canaliConfigurati = () => CANALI.filter(canaleConfigurato);

export async function leggiCanale(canale: Canale, periodo: Periodo, opts: { prima?: boolean } = {}): Promise<StatoCanale> {
	const m = MODULI[canale];
	if (!m.configurato()) return { canale, configurato: false, mancanti: m.mancanti(), dati: null, errore: null };
	try { return { canale, configurato: true, mancanti: [], dati: await m.leggi(periodo, opts), errore: null }; }
	catch (e) { return { canale, configurato: true, mancanti: [], dati: null, errore: e instanceof Error ? e.message : 'Errore' }; }
}
export const leggiTutti = (periodo: Periodo, opts: { prima?: boolean } = {}) => Promise.all(CANALI.map((c) => leggiCanale(c, periodo, opts)));

export const cambiaBudget = (canale: Canale, id: string, euroGiorno: number) => MODULI[canale].budget(id, euroGiorno);
export const cambiaStato = (canale: Canale, id: string, on: boolean) => MODULI[canale].stato(id, on);
