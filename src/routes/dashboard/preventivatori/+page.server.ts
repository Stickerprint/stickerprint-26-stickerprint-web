import { PRODUCT_ENGINES } from '$lib/pricing/engine';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('pricing_engines').select('slug, name, active, updated_at, config');
	const saved = new Map((data ?? []).map((r) => [r.slug, r]));
	return {
		engines: PRODUCT_ENGINES.map((p) => {
			const r = saved.get(p.slug);
			return { ...p, active: r?.active ?? p.slug === 'adesivi_personalizzati', updatedAt: r?.updated_at ?? null, hasConfig: !!r && Object.keys(r.config ?? {}).length > 0 };
		})
	};
};
