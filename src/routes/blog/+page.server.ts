import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const cat = url.searchParams.get('cat') ?? '';
	const [{ data: cats }, { data: posts }] = await Promise.all([
		supabase.from('post_categories').select('name, sort').order('sort'),
		supabase.from('posts').select('id, slug, title, excerpt, category, cover_url, author, published_at, created_at').eq('published', true).order('published_at', { ascending: false, nullsFirst: false })
	]);
	const list = (posts ?? []) as Omit<Post, 'content' | 'published' | 'updated_at'>[];
	return { cat, categories: (cats ?? []).map((c) => c.name as string), posts: cat ? list.filter((p) => p.category === cat) : list };
};
