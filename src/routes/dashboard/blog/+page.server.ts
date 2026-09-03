import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.from('posts').select('id, slug, title, category, published, published_at, created_at, updated_at').order('created_at', { ascending: false });
	return { posts: (data ?? []) as Omit<Post, 'content' | 'excerpt' | 'cover_url' | 'author'>[] };
};
