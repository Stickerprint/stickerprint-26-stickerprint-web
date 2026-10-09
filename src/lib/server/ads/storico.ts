/**
 * Storico in casa: ogni notte il cron salva in ads_giorni la spesa e i risultati di ieri, campagna per campagna.
 * Così i confronti mese su mese non dipendono da quanto indietro lasciano leggere le piattaforme.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CANALI, type Canale } from '$lib/marketing/ads-tipi';
import { leggiCanale, type Periodo } from './index';

type DB = SupabaseClient;

export async function salvaGiorno(db: DB, giorno: string): Promise<Record<string, string>> {
	const periodo: Periodo = { da: giorno, a: giorno };
	const esito: Record<string, string> = {};
	for (const canale of CANALI) {
		const s = await leggiCanale(canale, periodo, { prima: false });
		if (!s.configurato) { esito[canale] = 'non collegato'; continue; }
		if (!s.dati) { esito[canale] = s.errore; continue; }
		const righe = s.dati.campagne.filter((c) => c.spesa > 0 || c.impressioni > 0 || c.conversioni > 0).map((c) => ({ canale, campagna_id: c.id, giorno, nome: c.nome, stato: c.stato, spesa: c.spesa, impressioni: c.impressioni, clic: c.clic, conversioni: c.conversioni, valore: c.valore }));
		if (!righe.length) { esito[canale] = 'nessuna spesa'; continue; }
		const { error } = await db.from('ads_giorni').upsert(righe, { onConflict: 'canale,campagna_id,giorno' });
		esito[canale] = error ? error.message : `${righe.length} campagne`;
	}
	return esito;
}

export interface Mese { mese: string; spesa: number; clic: number; conversioni: number; valore: number | null }
/** Ultimi 12 mesi dallo storico, per canale (o tutti insieme). */
export async function mesiStorico(db: DB, canale?: Canale): Promise<Mese[]> {
	const da = new Date(); da.setMonth(da.getMonth() - 12); da.setDate(1);
	let q = db.from('ads_giorni').select('canale, giorno, spesa, clic, conversioni, valore').gte('giorno', da.toISOString().slice(0, 10));
	if (canale) q = q.eq('canale', canale);
	const { data } = await q;
	const mesi = new Map<string, Mese>();
	for (const r of data ?? []) {
		const k = String(r.giorno).slice(0, 7);
		const m = mesi.get(k) ?? { mese: k, spesa: 0, clic: 0, conversioni: 0, valore: null };
		m.spesa += Number(r.spesa) || 0; m.clic += Number(r.clic) || 0; m.conversioni += Number(r.conversioni) || 0;
		if (r.valore != null) m.valore = (m.valore ?? 0) + Number(r.valore);
		mesi.set(k, m);
	}
	return [...mesi.values()].sort((a, b) => b.mese.localeCompare(a.mese));
}
