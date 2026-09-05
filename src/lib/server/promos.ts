import type { SupabaseClient } from '@supabase/supabase-js';

export interface PromoInclude { label: string; normally: string }
export interface PromoPerk { label: string; saves: string }
export interface PromoSize { label: string; w: number; h: number; price: number }
export interface Promo {
	id: string; active: boolean; sort: number;
	qty: number; product_slug: string; product_label: string;
	price: number; price_normal: number | null; subtitle: string | null; ends_at: string | null;
	forma: string; materiale: string; finitura: string | null;
	chips: string[]; includes: PromoInclude[]; perks: PromoPerk[]; save_text: string | null; sizes: PromoSize[]; cta: string;
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizePromo(r: Record<string, unknown>): Promo {
	return {
		id: String(r.id), active: !!r.active, sort: Number(r.sort ?? 0),
		qty: Number(r.qty ?? 0), product_slug: String(r.product_slug ?? 'adesivi_personalizzati'), product_label: String(r.product_label ?? 'adesivi personalizzati'),
		price: Number(r.price ?? 0), price_normal: r.price_normal == null ? null : Number(r.price_normal),
		subtitle: (r.subtitle as string) ?? null, ends_at: (r.ends_at as string) ?? null,
		forma: String(r.forma ?? 'sagomato'), materiale: String(r.materiale ?? 'bianco'), finitura: (r.finitura as string) ?? null,
		chips: arr<string>(r.chips).map(String), includes: arr<PromoInclude>(r.includes), perks: arr<PromoPerk>(r.perks), save_text: (r.save_text as string) ?? null,
		sizes: arr<PromoSize>(r.sizes).map((s) => ({ label: String(s.label), w: Number(s.w), h: Number(s.h ?? s.w), price: Number(s.price) })),
		cta: String(r.cta ?? 'Carica il file per continuare')
	};
}

/** Offerte attive, nell'ordine deciso in dashboard */
export async function loadPromos(supabase: SupabaseClient, all = false): Promise<Promo[]> {
	try {
		let q = supabase.from('promos').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false });
		if (!all) q = q.eq('active', true);
		const { data } = await q;
		return (data ?? []).map((r) => normalizePromo(r as Record<string, unknown>));
	} catch (e) { console.warn('[promos] non disponibili', e); return []; }
}

/** Righe "Etichetta | valore" da una textarea della dashboard */
export function parseLines(text: string, keys: [string, string]): Record<string, string>[] {
	return String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
		const [a, b = ''] = l.split('|').map((s) => s.trim());
		return { [keys[0]]: a, [keys[1]]: b };
	});
}
export function parseSizes(text: string): PromoSize[] {
	// "5 cm | 50 | 50 | 79"  (etichetta | larghezza mm | altezza mm | prezzo)
	return String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
		const [label, w, h, price] = l.split('|').map((s) => s.trim());
		return { label, w: Number(w) || 50, h: Number(h || w) || 50, price: Number(String(price).replace(',', '.')) || 0 };
	}).filter((s) => s.label);
}
export const linesOf = (list: { [k: string]: unknown }[], keys: [string, string]) => list.map((i) => `${i[keys[0]] ?? ''} | ${i[keys[1]] ?? ''}`).join('\n');
export const sizesText = (sizes: PromoSize[]) => sizes.map((s) => `${s.label} | ${s.w} | ${s.h} | ${s.price}`).join('\n');
