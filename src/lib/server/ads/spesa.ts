/**
 * Spesa pubblicitaria dell'anno, mese per mese e canale per canale, per l'Analisi margini.
 * Una lettura leggera per piattaforma (solo la spesa). Se la piattaforma non risponde si usa lo storico
 * salvato ogni notte in ads_giorni e lo si dice; se il canale non e' collegato si scrive cosa manca.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CANALI, NOME_CANALE, type Canale } from '$lib/marketing/ads-tipi';
import type { SpesaAds, SpesaCanale } from '$lib/margini/ads';
import { metaConfigured, metaMissing, metaSpesaMesi } from './meta';
import { googleAdsConfigured, googleAdsMissing, googleSpesaMesi } from './google';
import { tiktokConfigured, tiktokMissing, tiktokSpesaMesi } from './tiktok';
import type { Periodo } from './periodo';
import { isoData } from '$lib/marketing/formato';

const LETTORI: Record<Canale, { ok: () => boolean; mancanti: () => string[]; mesi: (p: Periodo) => Promise<Record<string, number>> }> = {
	meta: { ok: metaConfigured, mancanti: metaMissing, mesi: metaSpesaMesi },
	google: { ok: googleAdsConfigured, mancanti: googleAdsMissing, mesi: googleSpesaMesi },
	tiktok: { ok: tiktokConfigured, mancanti: tiktokMissing, mesi: tiktokSpesaMesi }
};

/* la spesa dei mesi chiusi non cambia piu': 10 minuti di memoria bastano e non si martellano le piattaforme */
const cache = new Map<number, { at: number; v: SpesaAds }>();

const r2 = (v: number) => Math.round(v * 100) / 100;
const dodici = (m: Record<string, number>, anno: number) => Array.from({ length: 12 }, (_, i) => r2(m[`${anno}-${String(i + 1).padStart(2, '0')}`] ?? 0));

async function dallo_storico(db: SupabaseClient, canale: Canale, p: Periodo): Promise<{ mesi: Record<string, number>; dal: string | null }> {
	const { data } = await db.from('ads_giorni').select('giorno, spesa').eq('canale', canale).gte('giorno', p.da).lte('giorno', p.a);
	const mesi: Record<string, number> = {};
	let dal: string | null = null;
	for (const r of (data ?? []) as { giorno: string; spesa: number | string }[]) {
		const k = String(r.giorno).slice(0, 7);
		mesi[k] = (mesi[k] ?? 0) + (Number(r.spesa) || 0);
		if (!dal || r.giorno < dal) dal = r.giorno;
	}
	return { mesi, dal };
}

export async function spesaAnno(db: SupabaseClient, anno: number): Promise<SpesaAds> {
	const c = cache.get(anno);
	if (c && Date.now() - c.at < 10 * 60_000) return c.v;
	const oggi = isoData(new Date());
	const p: Periodo = { da: `${anno}-01-01`, a: `${anno}-12-31` < oggi ? `${anno}-12-31` : oggi };
	const vuoto = Array<number>(12).fill(0);
	if (p.da > p.a) return { anno, canali: CANALI.map((canale) => ({ canale, nome: NOME_CANALE[canale], stato: 'ok', motivo: null, mesi: vuoto })), aggiornato: new Date().toISOString() };

	const canali = await Promise.all(CANALI.map(async (canale): Promise<SpesaCanale> => {
		const l = LETTORI[canale];
		const nome = NOME_CANALE[canale];
		if (!l.ok()) return { canale, nome, stato: 'non_collegato', motivo: `Non collegato: mancano ${l.mancanti().join(', ')} su Vercel (Marketing → Impostazioni).`, mesi: vuoto };
		try {
			return { canale, nome, stato: 'ok', motivo: null, mesi: dodici(await l.mesi(p), anno) };
		} catch (e) {
			const errore = e instanceof Error ? e.message : 'errore';
			const s = await dallo_storico(db, canale, p).catch(() => ({ mesi: {}, dal: null }));
			if (s.dal) return { canale, nome, stato: 'storico', motivo: `${errore}. Uso lo storico salvato ogni notte, che parte dal ${s.dal.split('-').reverse().join('/')}: i mesi prima non sono contati.`, mesi: dodici(s.mesi, anno) };
			return { canale, nome, stato: 'errore', motivo: `${errore}. Nessuno storico salvato per quest'anno.`, mesi: vuoto };
		}
	}));
	const v: SpesaAds = { anno, canali, aggiornato: new Date().toISOString() };
	/* in memoria solo le letture riuscite: un errore si riprova al prossimo caricamento */
	if (canali.every((x) => x.stato === 'ok' || x.stato === 'non_collegato')) cache.set(anno, { at: Date.now(), v });
	return v;
}
