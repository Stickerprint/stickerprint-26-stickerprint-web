import { error, fail, redirect } from '@sveltejs/kit';
import { slugify, type Post } from '$lib/blog';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: cats } = await supabase.from('post_categories').select('name, sort').order('sort');
	const categories = (cats ?? []).map((c) => c.name as string);
	if (params.id === 'nuovo') return { post: null, categories };
	const { data } = await supabase.from('posts').select('*').eq('id', params.id).maybeSingle();
	if (!data) error(404, 'Articolo non trovato');
	return { post: data as Post, categories };
};

export const actions: Actions = {
	save: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const title = s('title');
		if (!title) return fail(400, { error: 'Il titolo è obbligatorio.' });
		let category = s('new_category') || s('category') || 'News';
		category = category.slice(0, 40);
		// categoria nuova: la creo al volo
		await supabase.from('post_categories').upsert({ name: category }, { onConflict: 'name', ignoreDuplicates: true });
		const published = f.get('published') === 'on';
		const row = {
			title,
			slug: slugify(s('slug') || title) || `articolo-${Date.now()}`,
			excerpt: s('excerpt') || null,
			category,
			cover_url: s('cover_url') || null,
			content: String(f.get('content') ?? ''),
			author: s('author') || 'Admin',
			published,
			published_at: published ? s('published_at') || new Date().toISOString() : null
		};
		if (params.id === 'nuovo') {
			const { data, error: e } = await supabase.from('posts').insert(row).select('id').single();
			if (e) return fail(400, { error: e.code === '23505' ? 'Esiste già un articolo con questo slug.' : e.message });
			redirect(303, `/dashboard/blog/${data.id}`);
		}
		const { error: e } = await supabase.from('posts').update(row).eq('id', params.id);
		if (e) return fail(400, { error: e.code === '23505' ? 'Esiste già un articolo con questo slug.' : e.message });
		return { ok: true };
	},
	delete: async ({ params, locals: { supabase } }) => {
		if (params.id === 'nuovo') redirect(303, '/dashboard/blog');
		const { error: e } = await supabase.from('posts').delete().eq('id', params.id);
		if (e) return fail(400, { error: e.message });
		redirect(303, '/dashboard/blog');
	}
};
