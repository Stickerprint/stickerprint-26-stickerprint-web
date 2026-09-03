import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ENGINES, mergeConfig, type EngineConfig } from '$lib/pricing/engine';

const DEFAULTS = DEFAULT_ENGINES;

/** Listino di un prodotto: quello salvato dalla dashboard, altrimenti il default nel codice. */
export async function loadEngine(supabase: SupabaseClient, slug: string): Promise<{ config: EngineConfig; savedAt: string | null }> {
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
