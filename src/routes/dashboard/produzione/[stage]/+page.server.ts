import { error, fail } from '@sveltejs/kit';
import { PROD_STAGES, nextStage, type OrderRow } from '$lib/dashboard/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	if (!PROD_STAGES[params.stage]) error(404, 'Fase non trovata');
	const { data } = await supabase.from('orders').select('*').eq('status', 'in_produzione').eq('prod_stage', params.stage).order('created_at', { ascending: true });
	return { stage: params.stage, label: PROD_STAGES[params.stage], items: (data ?? []) as OrderRow[] };
};

export const actions: Actions = {
	/** Un lavoro esce da un reparto solo col check dell'operatore */
	advance: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('item'));
		const { data: it } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
		if (!it) return fail(404, { error: 'Articolo non trovato.' });
		const next = nextStage(it as OrderRow);
		const patch = next ? { prod_stage: next } : { prod_stage: null, status: 'pronto' };
		const { error: e } = await supabase.from('orders').update(patch).eq('id', id);
		if (e) return fail(400, { error: e.message });
		return { ok: true };
	}
};
