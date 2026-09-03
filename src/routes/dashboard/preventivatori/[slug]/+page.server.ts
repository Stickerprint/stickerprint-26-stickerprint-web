import { error, fail } from '@sveltejs/kit';
import { PRODUCT_ENGINES, mergeConfig, type EngineConfig } from '$lib/pricing/engine';
import { defaultEngine, loadEngine } from '$lib/server/pricing';
import { estimatedShipDate, formatItDate } from '$lib/utils/shipping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const product = PRODUCT_ENGINES.find((p) => p.slug === params.slug);
	if (!product) error(404, 'Preventivatore non trovato');
	const { config, savedAt } = await loadEngine(supabase, params.slug);
	const { data: row } = await supabase.from('pricing_engines').select('active').eq('slug', params.slug).maybeSingle();
	const { data: history } = await supabase
		.from('pricing_engine_history')
		.select('id, changed_at, config')
		.eq('slug', params.slug)
		.order('changed_at', { ascending: false })
		.limit(10);
	return { product, config, savedAt, active: row?.active ?? false, history: history ?? [], defaults: defaultEngine(params.slug), shipDate: formatItDate(estimatedShipDate(5)) };
};

export const actions: Actions = {
	save: async ({ request, params, locals: { supabase, user } }) => {
		const f = await request.formData();
		let parsed: unknown;
		try {
			parsed = JSON.parse(String(f.get('config') ?? '{}'));
		} catch {
			return fail(400, { error: 'Configurazione non valida.' });
		}
		const cfg = mergeConfig(defaultEngine(params.slug), parsed) as EngineConfig;
		// controlli minimi
		if (!cfg.quantities.length) return fail(400, { error: 'Inserisci almeno una quantità.' });
		if (!cfg.materials.some((m) => m.visible)) return fail(400, { error: 'Almeno un materiale deve essere visibile.' });
		if (!cfg.shapes.some((s) => s.visible)) return fail(400, { error: 'Almeno una sagoma deve essere visibile.' });
		if (!(cfg.size.minMm > 0) || !(cfg.size.maxMm > cfg.size.minMm)) return fail(400, { error: 'Misura minima e massima non valide.' });
		if (!(cfg.vat >= 1)) return fail(400, { error: 'IVA non valida (es. 1.22).' });

		// salva la versione precedente nello storico
		const { data: prev } = await supabase.from('pricing_engines').select('config').eq('slug', params.slug).maybeSingle();
		if (prev?.config && Object.keys(prev.config).length) {
			await supabase.from('pricing_engine_history').insert({ slug: params.slug, config: prev.config, changed_by: user?.id });
		}
		const name = PRODUCT_ENGINES.find((p) => p.slug === params.slug)?.name ?? params.slug;
		const active = f.get('active') === 'on';
		const { error: e } = await supabase.from('pricing_engines').upsert({ slug: params.slug, name, config: cfg, active, updated_by: user?.id });
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},
	restore: async ({ request, params, locals: { supabase, user } }) => {
		const f = await request.formData();
		const { data: h } = await supabase.from('pricing_engine_history').select('config').eq('id', String(f.get('id'))).maybeSingle();
		if (!h) return fail(404, { error: 'Versione non trovata.' });
		const { data: prev } = await supabase.from('pricing_engines').select('config').eq('slug', params.slug).maybeSingle();
		if (prev?.config && Object.keys(prev.config).length) await supabase.from('pricing_engine_history').insert({ slug: params.slug, config: prev.config, changed_by: user?.id });
		const { error: e } = await supabase.from('pricing_engines').update({ config: h.config, updated_by: user?.id }).eq('slug', params.slug);
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	},
	reset: async ({ params, locals: { supabase, user } }) => {
		const { data: prev } = await supabase.from('pricing_engines').select('config').eq('slug', params.slug).maybeSingle();
		if (prev?.config && Object.keys(prev.config).length) await supabase.from('pricing_engine_history').insert({ slug: params.slug, config: prev.config, changed_by: user?.id });
		const { error: e } = await supabase.from('pricing_engines').update({ config: {}, updated_by: user?.id }).eq('slug', params.slug);
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	}
};
