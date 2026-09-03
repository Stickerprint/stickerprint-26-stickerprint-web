import type { SupabaseClient } from '@supabase/supabase-js';

export interface DiscountResult { ok: true; code: string; kind: 'percent' | 'fixed'; value: number; amount: number; description: string | null }
/** Verifica un codice sconto e calcola l'importo sull'imponibile */
export async function checkDiscount(supabase: SupabaseClient, code: string, subtotalNet: number): Promise<DiscountResult | { ok: false; error: string }> {
	const c = code.trim().toUpperCase();
	if (!c) return { ok: false, error: 'Inserisci un codice.' };
	const { data } = await supabase.from('discount_codes').select('*').ilike('code', c).eq('active', true).maybeSingle();
	if (!data) return { ok: false, error: 'Codice non valido.' };
	const now = Date.now();
	if (data.valid_from && new Date(data.valid_from).getTime() > now) return { ok: false, error: 'Codice non ancora attivo.' };
	if (data.valid_to && new Date(data.valid_to).getTime() < now) return { ok: false, error: 'Codice scaduto.' };
	if (data.max_uses != null && data.uses >= data.max_uses) return { ok: false, error: 'Codice esaurito.' };
	if (subtotalNet < Number(data.min_order)) return { ok: false, error: `Valido per ordini da ${Number(data.min_order).toFixed(2)} € (IVA esclusa).` };
	const amount = data.kind === 'percent' ? (subtotalNet * Number(data.value)) / 100 : Math.min(Number(data.value), subtotalNet);
	return { ok: true, code: data.code, kind: data.kind, value: Number(data.value), amount: Math.round(amount * 100) / 100, description: data.description };
}
