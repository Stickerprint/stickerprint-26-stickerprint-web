/** Articoli del blog nella lingua del sito: titolo, estratto, contenuto e slug tradotti (colonna tr o file contenuti.json). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { localizePath, LOCALES, type Lang } from '$lib/i18n';
import type { Post } from '$lib/blog';
import { traduzioneDi, categoriaPostTradotta } from './contenuti-tradotti';
export { categoriaPostTradotta };

type PostRiga = Partial<Post> & { id: string; slug: string; title: string; category: string; tr?: Record<string, unknown> | null };

/** l'articolo con i campi nella lingua (l'italiano resta se non c'e' traduzione valida) */
export function postTradotto<T extends PostRiga>(p: T, lang: Lang): T & { categoria: string } {
	const categoria = categoriaPostTradotta(p.category, lang);
	if (lang === 'it') return { ...p, categoria };
	const italiano = { title: p.title, excerpt: p.excerpt ?? null, content: p.content ?? undefined };
	if (p.content === undefined) delete (italiano as { content?: unknown }).content;
	const t = traduzioneDi('posts', p, lang, italiano) ?? traduzioneDi('posts', p, lang, { title: p.title, excerpt: p.excerpt ?? null, content: p.content ?? '' });
	if (!t) return { ...p, categoria };
	/* link interni dentro l'articolo (href="/aziende") con il prefisso e lo slug della lingua */
	const code = Object.values(LOCALES).find((l) => l.lang === lang)?.code ?? 'it';
	const conPrefisso = (html: string) => html.replace(/href="(\/[a-z0-9-]*)(["#?])/g, (m, path: string, fine: string) => `href="${localizePath(path, code)}${fine}`);
	const content = p.content !== undefined && typeof t.content === 'string' ? conPrefisso(t.content) : p.content;
	return { ...p, categoria, slug: typeof t.slug === 'string' && t.slug ? t.slug : p.slug, title: typeof t.title === 'string' ? t.title : p.title, excerpt: typeof t.excerpt === 'string' ? t.excerpt : p.excerpt, content };
}

/** trova l'articolo da uno slug: italiano, tradotto nel database (tr->lang->>slug) o tradotto nel file */
export async function trovaPost(supabase: SupabaseClient, slug: string, lang: Lang): Promise<(Post & { tr?: Record<string, unknown> | null }) | null> {
	const diretto = await supabase.from('posts').select('*').eq('slug', slug).eq('published', true).maybeSingle();
	if (diretto.data) return diretto.data;
	if (lang === 'it') return null;
	const perTr = await supabase.from('posts').select('*').eq('published', true).filter(`tr->${lang}->>slug`, 'eq', slug).maybeSingle();
	if (perTr.data) return perTr.data;
	/* slug del file contenuti.json: pochi articoli, si scorrono */
	const { data: tutti } = await supabase.from('posts').select('*').eq('published', true);
	for (const p of tutti ?? []) if (postTradotto(p, lang).slug === slug) return p;
	return null;
}
