import { leggiTutti, ultimiGiorni } from '$lib/server/ads';
import { leggiObiettivi } from '$lib/server/ads/impostazioni';
import { assistenteDisponibile, ultimoReport } from '$lib/server/ads/consigli';
import { mesiStorico } from '$lib/server/ads/storico';
import { analizzaCanale, analizzaTutto } from '$lib/marketing/analisi';
import { azioneConsigliTutti, giorniDa } from '$lib/server/ads/azioni';
import { aggiunteCarrello } from '$lib/server/carrello';
import type { Actions, PageServerLoad } from './$types';

/** Panoramica: i tre canali letti adesso e messi insieme, i verdetti delle regole, l'ultimo report salvato, le aggiunte al carrello del sito. */
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const giorni = giorniDa(url);
	const periodo = ultimiGiorni(giorni);
	const [canali, obiettivi, report, mesi, carrello] = await Promise.all([leggiTutti(periodo), leggiObiettivi(supabase), ultimoReport(supabase, 'tutti'), mesiStorico(supabase), aggiunteCarrello(supabase)]);
	const analisi = canali.filter((c) => c.dati).map((c) => analizzaCanale(c.dati!, obiettivi));
	const totale = analisi.length ? analizzaTutto(analisi, obiettivi) : null;
	return { giorni, periodo, canali, obiettivi, analisi, totale, report, mesi, carrello, assistente: assistenteDisponibile() };
};
export const actions: Actions = { consigli: azioneConsigliTutti };
