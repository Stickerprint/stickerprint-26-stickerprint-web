/**
 * Aggiunte al carrello per la Panoramica marketing: legge carrello_eventi (scritta da POST /api/carrello)
 * e la riassume per oggi, ieri, 7 e 30 giorni in una lettura sola, cosi' i filtri cambiano all'istante nella pagina.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { giornoRoma, inizioGiornoRoma, piuGiorni } from '$lib/dashboard/tempo';
import { riassumi, type EventoCarrello, type PeriodoCarrello, type RiassuntoCarrello, type StatoCarrello } from '$lib/marketing/carrello';

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
