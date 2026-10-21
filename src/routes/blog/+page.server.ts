import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';
import { langOf } from '$lib/i18n';
import { postTradotto, categoriaPostTradotta } from '$lib/server/blog-lingue';

export const load: PageServerLoad = async ({ url, locals: { supabase, locale } }) => {
	const lang = langOf(locale);
	const cat = url.searchParams.get('cat') ?? '';
	const [{ data: cats }, { data: posts }] = await Promise.all([
		supabase.from('post_categories').select('name, sort').order('sort'),
		supabase.from('posts').select('*').eq('published', true).order('published_at', { ascending: false, nullsFirst: false })
	]);
	/* articoli nella lingua del sito (titolo, estratto, slug tradotti; categoria tradotta per l'etichetta, il filtro resta sul nome italiano) */
	/* select('*'): la colonna tr c'e' solo dopo la migrazione 0060; il contenuto non serve nell'elenco */
	const list = (posts ?? []).map((p) => { const t = postTradotto(p as Post & { tr?: Record<string, unknown> | null }, lang); const { content: _c, tr: _t, ...resto } = t; void [_c, _t]; return resto; }) as (Omit<Post, 'content' | 'published' | 'updated_at'> & { categoria: string })[];
	const categories = (cats ?? []).map((c) => ({ name: c.name as string, label: categoriaPostTradotta(c.name as string, lang) }));
	return { cat, categories, posts: cat ? list.filter((p) => p.category === cat) : list };
};
