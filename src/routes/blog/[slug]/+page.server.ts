import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Post } from '$lib/blog';
import { t } from '$lib/traduzioni';
import { langOf, localizePath } from '$lib/i18n';
import { postTradotto, trovaPost } from '$lib/server/blog-lingue';

export const load: PageServerLoad = async ({ params, locals: { supabase, locale } }) => {
	const lang = langOf(locale);
	const data = await trovaPost(supabase, params.slug, lang);
	if (!data) error(404, t(locale, 'pagine.blog.nonTrovato'));
	const post = postTradotto(data, lang);
	/* URL canonico nella lingua: se si arriva con lo slug italiano su un sito in lingua (o viceversa), si va allo slug giusto */
	if (post.slug !== params.slug) redirect(301, localizePath(`/blog/${post.slug}`, locale));
	return { post: post as Post & { categoria: string } };
};
