import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPPORT_TOPICS } from '$lib/support-faq';

export interface FaqItem { id: string; q: string; a: string; sort: number; active: boolean }
export interface FaqCategory { id: string; slug: string; name: string; product_slug: string | null; sort: number; active: boolean; items: FaqItem[] }

const CACHE_MS = 2 * 60 * 1000;
let cache: { at: number; value: FaqCategory[] } | null = null;
export function invalidateFaq() { cache = null; }

/** Tutte le categorie con le loro domande (solo attive, salvo `all` per la dashboard) */
export async function loadFaq(supabase: SupabaseClient, all = false): Promise<FaqCategory[]> {
	if (!all && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
	try {
		const [{ data: cats, error: e1 }, { data: items, error: e2 }] = await Promise.all([
			supabase.from('faq_categories').select('*').order('sort').order('created_at'),
			supabase.from('faq_items').select('*').order('sort').order('created_at')
		]);
		if (e1 || e2) throw e1 ?? e2;
		const list: FaqCategory[] = (cats ?? []).map((c) => ({
			id: c.id, slug: c.slug, name: c.name, product_slug: c.product_slug ?? null, sort: c.sort ?? 0, active: !!c.active,
			items: (items ?? []).filter((i) => i.category_id === c.id).map((i) => ({ id: i.id, q: i.q, a: i.a, sort: i.sort ?? 0, active: !!i.active }))
		}));
		const out = all ? list : list.filter((c) => c.active).map((c) => ({ ...c, items: c.items.filter((i) => i.active) })).filter((c) => c.items.length);
		if (!all) cache = { at: Date.now(), value: out };
		return out;
	} catch (e) {
		console.warn('[faq] uso i testi statici', e);
		return SUPPORT_TOPICS.map((t, i) => ({ id: `s${i}`, slug: `s${i}`, name: t.title, product_slug: null, sort: i, active: true, items: t.faqs.map((f, j) => ({ id: `s${i}-${j}`, q: f.q, a: f.a, sort: j, active: true })) }));
	}
}

/** Domande della categoria collegata a un prodotto (per la pagina prodotto); vuoto se non c'e' */
export async function loadFaqFor(supabase: SupabaseClient, productSlug: string): Promise<{ q: string; a: string }[]> {
	const cats = await loadFaq(supabase);
	return cats.filter((c) => c.product_slug === productSlug).flatMap((c) => c.items.map((i) => ({ q: i.q, a: i.a })));
}
