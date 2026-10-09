import { leggiCanale, ultimiGiorni } from '$lib/server/ads';
import { leggiObiettivi } from '$lib/server/ads/impostazioni';
import { assistenteDisponibile, ultimoReport } from '$lib/server/ads/consigli';
import { mesiStorico } from '$lib/server/ads/storico';
import { analizzaCanale } from '$lib/marketing/analisi';
import { azioniCanale, giorniDa } from '$lib/server/ads/azioni';
import type { Canale } from '$lib/marketing/ads-tipi';
import type { Actions, PageServerLoad } from './$types';

/** La pagina di un canale: numeri, campagne con verdetto, consigli e storico. */
export const load: PageServerLoad = async ({ params, url, parent, locals: { supabase } }) => {
	const canale = params.canale as Canale;
	const giorni = giorniDa(url);
	const [stato, obiettivi, report, mesi, { role }] = await Promise.all([leggiCanale(canale, ultimiGiorni(giorni)), leggiObiettivi(supabase), ultimoReport(supabase, canale), mesiStorico(supabase, canale), parent()]);
	const analisi = stato.dati ? analizzaCanale(stato.dati, obiettivi) : null;
	return { canale, giorni, stato, obiettivi, analisi, report, mesi, assistente: assistenteDisponibile(), puoAgire: role === 'admin' };
};
export const actions: Actions = {
	budget: (e) => azioniCanale(e.params.canale as Canale).budget(e),
	stato: (e) => azioniCanale(e.params.canale as Canale).stato(e),
	consigli: (e) => azioniCanale(e.params.canale as Canale).consigli(e)
};
