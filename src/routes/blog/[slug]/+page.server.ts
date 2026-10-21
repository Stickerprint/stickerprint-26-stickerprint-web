import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';
import { t } from '$lib/traduzioni';

export const load: PageServerLoad = async ({ params, locals: { supabase, locale } }) => {
	const { data } = await supabase.from('posts').select('*').eq('slug', params.slug).eq('published', true).maybeSingle();
	if (!data) error(404, t(locale, 'pagine.blog.nonTrovato'));
	return { post: data as Post };
};
