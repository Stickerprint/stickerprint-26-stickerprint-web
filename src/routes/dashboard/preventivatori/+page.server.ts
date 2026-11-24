import { fail } from '@sveltejs/kit';
import { PRODUCT_ENGINES } from '$lib/pricing/engine';
import { LISTINO_SLUG, listinoIniziale, normalizzaListino, problemaListino, type Listino } from '$lib/pricing/listino';
import { invalidateListino, loadListino } from '$lib/server/pricing';
import type { Actions, PageServerLoad } from './$types';

/** Preventivatore unico: il listino 2027 vale per tutti i prodotti (riga `listino_2027` di `pricing_engines`). */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	invalidateListino(); // in dashboard si vede sempre l'ultimo salvataggio, non la copia in memoria
	const { savedAt } = await loadListino(supabase);
	const { data: history } = await supabase
		.from('pricing_engine_history')
		.select('id, changed_at, config')
		.eq('slug', LISTINO_SLUG)
		.order('changed_at', { ascending: false })
		.limit(10);
	return {
		savedAt,
		prodotti: PRODUCT_ENGINES.map((p) => ({ slug: p.slug, name: p.name, href: p.href })),
		history: (history ?? []).map((h) => ({ id: h.id as string, changedAt: h.changed_at as string, ricarico: (h.config as Listino | null)?.comune?.ricarico ?? null, aumento: (h.config as Listino | null)?.comune?.aumentoBase ?? null }))
	};
};

async function scrivi(supabase: App.Locals['supabase'], userId: string | undefined, L: Listino) {
	const { data: prev } = await supabase.from('pricing_engines').select('config').eq('slug', LISTINO_SLUG).maybeSingle();
	if (prev?.config && Object.keys(prev.config).length) await supabase.from('pricing_engine_history').insert({ slug: LISTINO_SLUG, config: prev.config, changed_by: userId });
	/* active = false: la riga contiene fatturato e spese, non deve essere leggibile dal pubblico (il sito la legge dal server) */
	const { error: e } = await supabase.from('pricing_engines').upsert({ slug: LISTINO_SLUG, name: 'Listino 2027', config: L, active: false, updated_by: userId });
	invalidateListino();
	return e;
}

export const actions: Actions = {
	save: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		let parsed: unknown;
		try { parsed = JSON.parse(String(f.get('listino') ?? '')); } catch { return fail(400, { error: 'Listino non valido: ricarica la pagina e riprova.' }); }
		const L = normalizzaListino(parsed);
		if (!L) return fail(400, { error: 'Listino non valido: ricarica la pagina e riprova.' });
		const problema = problemaListino(L);
		if (problema) return fail(400, { error: problema });
		const e = await scrivi(supabase, user?.id, L);
		if (e) return fail(400, { error: e.message });
		return { ok: true, quando: Date.now() };
	},
	restore: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const { data: h } = await supabase.from('pricing_engine_history').select('config').eq('id', String(f.get('id'))).eq('slug', LISTINO_SLUG).maybeSingle();
		const L = normalizzaListino(h?.config);
		if (!L) return fail(404, { error: 'Versione non trovata.' });
		const e = await scrivi(supabase, user?.id, L);
		if (e) return fail(400, { error: e.message });
		return { ok: true, quando: Date.now() };
	},
	reset: async ({ locals: { supabase, user } }) => {
		const e = await scrivi(supabase, user?.id, listinoIniziale());
		if (e) return fail(400, { error: e.message });
		return { ok: true, quando: Date.now() };
	}
};
