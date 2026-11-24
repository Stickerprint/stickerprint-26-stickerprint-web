import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ENGINES, mergeConfig, type EngineConfig } from '$lib/pricing/engine';
import { LISTINO_SLUG, listinoIniziale, listinoPubblico, normalizzaListino, quantitaProdotto, num, type Listino } from '$lib/pricing/listino';
import { adminClient } from './admin';

const DEFAULTS = DEFAULT_ENGINES;

/* cache in memoria: il listino cambia di rado, ogni pagina prodotto e la home lo chiedono.
   Vale 2 minuti; scaduto, si restituisce l'ultimo valore e si rinnova in sottofondo. */
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; value: { config: EngineConfig; savedAt: string | null } }>();
export function invalidateEngine(slug?: string) { if (slug) cache.delete(slug); else cache.clear(); }

/* il listino 2027 e' uno solo per tutti i prodotti: stessa cache, stessa durata */
let listinoCache: { at: number; value: { listino: Listino; savedAt: string | null } } | null = null;
export function invalidateListino() { listinoCache = null; cache.clear(); }

/** Listino 2027: quello salvato dalla dashboard (riga `listino_2027`), altrimenti quello iniziale nel codice.
 *  La riga NON e' pubblica (`active = false`: contiene fatturato e spese), quindi si legge con la chiave di servizio;
 *  senza chiave (sviluppo) la legge solo lo staff e gli altri vedono il listino iniziale. */
export async function loadListino(supabase: SupabaseClient): Promise<{ listino: Listino; savedAt: string | null }> {
	if (listinoCache && Date.now() - listinoCache.at < CACHE_MS) return listinoCache.value;
	let value: { listino: Listino; savedAt: string | null } = { listino: listinoIniziale(), savedAt: null };
	try {
		const { data } = await (adminClient() ?? supabase).from('pricing_engines').select('config, updated_at').eq('slug', LISTINO_SLUG).maybeSingle();
		const L = normalizzaListino(data?.config);
		if (L) value = { listino: L, savedAt: data?.updated_at ?? null };
	} catch (e) {
		console.warn('[pricing] listino 2027 non disponibile, uso quello iniziale', e);
	}
	listinoCache = { at: Date.now(), value };
	return value;
}

/**
 * Aggancia il listino al config del prodotto: da qui in poi `quoteWith` usa la regola unica.
 * I costi a m² del config (materiali, stampa, lamina, resina) vengono allineati al listino, cosi'
 * l'analisi margini continua a leggere i costi veri; anche le quantita' proposte arrivano dal listino.
 */
export function conListino(config: EngineConfig, L: Listino, slug: string): EngineConfig {
	const p = L.prodotti.find((x) => x.id === slug);
	if (!p) return config;
	const costo = (id: string) => L.materiali.find((m) => m.id === id);
	const lamina = L.finiture.find((f) => f.id === 'lucida') ?? L.finiture.find((f) => f.tipo === 'm2' && num(f.costo) > 0);
	const resina = L.finiture.find((f) => f.tipo === 'resina');
	const qty = quantitaProdotto(p);
	return {
		...config,
		vat: 1 + num(L.comune.iva) / 100,
		materials: config.materials.map((m) => (costo(m.id) ? { ...m, costM2: num(costo(m.id)!.costo), markup: 0 } : m)),
		print: { costM2: num(p.stampa), markup: 0 },
		laminate: lamina ? { costM2: num(lamina.costo), markup: 0 } : config.laminate,
		resin: resina ? { costKg: num(resina.kg), gramsPerCm2: num(resina.g), markup: Math.max(0, num(resina.ric) - 1) } : config.resin,
		quantities: qty.length ? qty : config.quantities,
		recommendedQty: qty.length && !qty.includes(config.recommendedQty) ? (qty.find((n) => n >= config.recommendedQty) ?? qty[qty.length - 1]) : config.recommendedQty,
		listino: { L: listinoPubblico(L, slug), slug } // al browser arrivano solo i numeri del calcolo
	};
}

/** Listino di un prodotto: quello salvato dalla dashboard, altrimenti il default nel codice. */
export async function loadEngine(supabase: SupabaseClient, slug: string): Promise<{ config: EngineConfig; savedAt: string | null }> {
	const hit = cache.get(slug);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
	const p = loadEngineFresh(supabase, slug).then((v) => { cache.set(slug, { at: Date.now(), value: v }); return v; });
	if (hit) { p.catch(() => {}); return hit.value; }
	return p;
}

async function loadEngineFresh(supabase: SupabaseClient, slug: string): Promise<{ config: EngineConfig; savedAt: string | null }> {
	const base = DEFAULTS[slug] ?? DEFAULTS.adesivi_personalizzati;
	const { listino } = await loadListino(supabase);
	try {
		const { data } = await supabase.from('pricing_engines').select('config, updated_at').eq('slug', slug).maybeSingle();
		if (data?.config && Object.keys(data.config).length > 0) {
			return { config: conListino(mergeConfig(base, data.config), listino, slug), savedAt: data.updated_at };
		}
	} catch (e) {
		console.warn('[pricing] listino non disponibile, uso default', e);
	}
	return { config: conListino(base, listino, slug), savedAt: null };
}

export function defaultEngine(slug: string): EngineConfig {
	return DEFAULTS[slug] ?? DEFAULTS.adesivi_personalizzati;
}
