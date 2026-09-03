import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data } = await supabase.from('posts').select('*').eq('slug', params.slug).eq('published', true).maybeSingle();
	if (!data) error(404, 'Articolo non trovato');
	return { post: data as Post };
};
