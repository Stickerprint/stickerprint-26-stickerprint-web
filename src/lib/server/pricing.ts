import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ENGINES, mergeConfig, type EngineConfig } from '$lib/pricing/engine';

const DEFAULTS = DEFAULT_ENGINES;

/* cache in memoria: il listino cambia di rado, ogni pagina prodotto e la home lo chiedono.
   Vale 2 minuti; scaduto, si restituisce l'ultimo valore e si rinnova in sottofondo. */
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; value: { config: EngineConfig; savedAt: string | null } }>();
export function invalidateEngine(slug?: string) { if (slug) cache.delete(slug); else cache.clear(); }

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
	try {
		const { data } = await supabase.from('pricing_engines').select('config, updated_at').eq('slug', slug).maybeSingle();
		if (data?.config && Object.keys(data.config).length > 0) {
			return { config: mergeConfig(base, data.config), savedAt: data.updated_at };
		}
	} catch (e) {
		console.warn('[pricing] listino non disponibile, uso default', e);
	}
	return { config: base, savedAt: null };
}

export function defaultEngine(slug: string): EngineConfig {
	return DEFAULTS[slug] ?? DEFAULTS.adesivi_personalizzati;
}
