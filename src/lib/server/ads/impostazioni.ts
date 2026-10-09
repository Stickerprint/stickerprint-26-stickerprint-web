import type { SupabaseClient } from '@supabase/supabase-js';
import { OBIETTIVI_DEFAULT, type Canale, type Obiettivi } from '$lib/marketing/ads-tipi';

type DB = SupabaseClient;
const n = (v: unknown): number | null => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

export async function leggiObiettivi(db: DB): Promise<Obiettivi> {
	const { data } = await db.from('marketing_impostazioni').select('*').eq('id', 1).maybeSingle();
	if (!data) return OBIETTIVI_DEFAULT;
	const quote: Partial<Record<Canale, number>> = {};
	for (const [k, v] of Object.entries((data.quote as Record<string, unknown>) ?? {})) { const x = n(v); if (x != null && x > 0) quote[k as Canale] = x; }
	return { budgetMese: n(data.budget_mese), quote, valoreOrdine: n(data.valore_ordine) ?? OBIETTIVI_DEFAULT.valoreOrdine, roasTarget: n(data.roas_target) ?? OBIETTIVI_DEFAULT.roasTarget, cpaTarget: n(data.cpa_target), note: String(data.note ?? '') };
}
export async function salvaObiettivi(db: DB, o: Obiettivi): Promise<string | null> {
	const { error } = await db.from('marketing_impostazioni').upsert({ id: 1, budget_mese: o.budgetMese, quote: o.quote, valore_ordine: o.valoreOrdine, roas_target: o.roasTarget, cpa_target: o.cpaTarget, note: o.note || null, updated_at: new Date().toISOString() });
	return error ? error.message : null;
}
