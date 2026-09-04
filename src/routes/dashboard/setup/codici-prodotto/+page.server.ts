import { fail } from '@sveltejs/kit';
import { CATS } from '$lib/dashboard/orders';
import type { ProductCode } from '$lib/dashboard/orderDraft';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('product_codes').select('*').order('sort').order('code');
	return { codes: (data ?? []) as ProductCode[] };
};
export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const row = { code: s('code').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12), name: s('name').slice(0, 80), category: CATS[s('category')] ? s('category') : 'adesivi_personalizzati', description: s('description') || null, unit_net: s('unit_net') ? Number(s('unit_net').replace(',', '.')) : null, active: f.get('active') !== 'off', sort: Number(f.get('sort') ?? 0) };
		if (!row.code || !row.name) return fail(400, { error: 'Codice e nome sono obbligatori.' });
		const id = s('id');
		const { error } = id ? await supabase.from('product_codes').update(row).eq('id', id) : await supabase.from('product_codes').insert(row);
		if (error) return fail(400, { error: error.code === '23505' ? 'Esiste già questo codice.' : error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('product_codes').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
