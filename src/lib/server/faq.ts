import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPPORT_TOPICS } from '$lib/support-faq';
import { supportFaqFor } from '$lib/support-faq-lingue';
import { faqTradotta, categoriaFaqTradotta } from './contenuti-tradotti';
import { LOCALES, formatAmount, toCurrency, type Lang } from '$lib/i18n';

export interface FaqItem { id: string; q: string; a: string; sort: number; active: boolean; products: string[]; tr?: Record<string, unknown> | null }
export interface FaqCategory { id: string; slug: string; name: string; product_slug: string | null; sort: number; active: boolean; items: FaqItem[]; tr?: Record<string, unknown> | null }

const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<Lang, { at: number; value: FaqCategory[] }>();
export function invalidateFaq() { cache.clear(); }

/** cifre nelle risposte tradotte: {soglia} (spedizione gratuita) e {campioni} (kit) nella valuta del locale */
function riempi(lang: Lang) {
	const locale = Object.values(LOCALES).find((l) => l.lang === lang) ?? LOCALES.it;
	const valori: Record<string, string> = { soglia: formatAmount(locale.freeShipping, locale, 0), campioni: formatAmount(toCurrency(10, locale.currency), locale, 0) };
	return (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => valori[k] ?? m);
}

/** Tutte le categorie con le loro domande (solo attive, salvo `all` per la dashboard), nella lingua: tradotte dal database/file, altrimenti statiche */
export async function loadFaq(supabase: SupabaseClient, all = false, lang: Lang = 'it'): Promise<FaqCategory[]> {
	const c = cache.get(lang);
	if (!all && c && Date.now() - c.at < CACHE_MS) return c.value;
	const r = lang === 'it' ? riempi('it') : riempi(lang);
	try {
		const [{ data: cats, error: e1 }, { data: items, error: e2 }] = await Promise.all([
			supabase.from('faq_categories').select('*').order('sort').order('created_at'),
			supabase.from('faq_items').select('*').order('sort').order('created_at')
		]);
		if (e1 || e2) throw e1 ?? e2;
		const list: FaqCategory[] = (cats ?? []).map((c) => ({
			id: c.id, slug: c.slug, name: all ? c.name : categoriaFaqTradotta({ id: c.id, name: c.name, tr: c.tr }, lang), product_slug: c.product_slug ?? null, sort: c.sort ?? 0, active: !!c.active, tr: c.tr ?? null,
			items: (items ?? []).filter((i) => i.category_id === c.id).map((i) => { const t = all ? { q: i.q, a: i.a } : faqTradotta({ id: i.id, q: i.q, a: i.a, tr: i.tr }, lang); return { id: i.id, q: all ? t.q : r(t.q), a: all ? t.a : r(t.a), sort: i.sort ?? 0, active: !!i.active, products: Array.isArray(i.products) ? i.products : [], tr: i.tr ?? null }; })
		}));
		const out = all ? list : list.filter((c) => c.active).map((c) => ({ ...c, items: c.items.filter((i) => i.active) })).filter((c) => c.items.length);
		if (!all) cache.set(lang, { at: Date.now(), value: out });
		return out;
	} catch (e) {
		console.warn('[faq] uso i testi statici', e);
		return (lang === 'it' ? SUPPORT_TOPICS : supportFaqFor(lang)).map((t, i) => ({ id: `s${i}`, slug: `s${i}`, name: t.title, product_slug: null, sort: i, active: true, items: t.faqs.map((f, j) => ({ id: `s${i}-${j}`, q: f.q, a: f.a, sort: j, active: true, products: [] })) }));
	}
}

/** Domande per la pagina di un prodotto: quelle con la spunta su quel prodotto, piu' quelle delle categorie collegate al prodotto */
export async function loadFaqFor(supabase: SupabaseClient, productSlug: string, lang: Lang = 'it'): Promise<{ q: string; a: string }[]> {
	const cats = await loadFaq(supabase, false, lang);
	const seen = new Set<string>(); const out: { q: string; a: string }[] = [];
	for (const c of cats) for (const i of c.items) {
		if ((i.products.includes(productSlug) || c.product_slug === productSlug) && !seen.has(i.id)) { seen.add(i.id); out.push({ q: i.q, a: i.a }); }
	}
	return out;
}
