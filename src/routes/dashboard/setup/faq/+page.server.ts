import { fail } from '@sveltejs/kit';
import { invalidateFaq, loadFaq } from '$lib/server/faq';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	return { categories: await loadFaq(supabase, true) };
};

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const actions: Actions = {
	saveCategory: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const name = String(f.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Scrivi il nome della categoria.' });
		const row = { name, slug: String(f.get('slug') ?? '').trim() || slugify(name), product_slug: String(f.get('product_slug') ?? '').trim() || null, sort: Number(f.get('sort') ?? 0) || 0, active: f.get('active') === 'on' };
		const { error } = id ? await supabase.from('faq_categories').update(row).eq('id', id) : await supabase.from('faq_categories').insert(row);
		if (error) return fail(400, { error: error.code === '23505' ? 'Esiste già una categoria con questo slug.' : error.message });
		invalidateFaq();
		return { ok: true };
	},
	deleteCategory: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('faq_categories').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		invalidateFaq();
		return { ok: true };
	},
	saveItem: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const q = String(f.get('q') ?? '').trim(), a = String(f.get('a') ?? '').trim();
		const category_id = String(f.get('category_id') ?? '');
		if (!q || !a) return fail(400, { error: 'Servono sia la domanda sia la risposta.' });
		if (!category_id) return fail(400, { error: 'Scegli la categoria.' });
		const row = { q, a, category_id, sort: Number(f.get('sort') ?? 0) || 0, active: f.get('active') !== 'off', updated_at: new Date().toISOString() };
		const { error } = id ? await supabase.from('faq_items').update(row).eq('id', id) : await supabase.from('faq_items').insert(row);
		if (error) return fail(400, { error: error.message });
		invalidateFaq();
		return { ok: true };
	},
	deleteItem: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('faq_items').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		invalidateFaq();
		return { ok: true };
	}
};
