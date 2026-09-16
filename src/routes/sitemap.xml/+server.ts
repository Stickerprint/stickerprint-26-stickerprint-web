import type { RequestHandler } from './$types';
import { PRODUCTS } from '$lib/products';
import { SITE_URL, isProductionHost } from '$lib/seo';

/**
 * Sitemap XML: solo pagine pubbliche e indicizzabili, con URL assoluti del dominio definitivo.
 * Sui domini di test (anteprime Vercel, meett.it) risponde 404: non deve esistere una sitemap indicizzabile li'.
 * lastmod: per gli articoli la data di modifica vera; per le altre pagine nessuna data (Google la ignora se non e' affidabile).
 */
const STATIC: { path: string; priority: string; changefreq: string }[] = [
	{ path: '/', priority: '1.0', changefreq: 'weekly' },
	{ path: '/prodotti', priority: '0.8', changefreq: 'monthly' },
	{ path: '/kit-adesivi', priority: '0.9', changefreq: 'monthly' },
	{ path: '/offerte', priority: '0.7', changefreq: 'weekly' },
	{ path: '/campioni', priority: '0.7', changefreq: 'monthly' },
	{ path: '/aziende', priority: '0.8', changefreq: 'monthly' },
	{ path: '/chi-siamo', priority: '0.5', changefreq: 'yearly' },
	{ path: '/blog', priority: '0.6', changefreq: 'weekly' },
	{ path: '/support', priority: '0.5', changefreq: 'monthly' },
	{ path: '/resi', priority: '0.3', changefreq: 'yearly' },
	{ path: '/recensioni', priority: '0.3', changefreq: 'yearly' },
	{ path: '/privacy', priority: '0.1', changefreq: 'yearly' },
	{ path: '/cookie-policy', priority: '0.1', changefreq: 'yearly' },
	{ path: '/termini', priority: '0.1', changefreq: 'yearly' }
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	if (!isProductionHost(url.host)) return new Response('Not found', { status: 404 });

	const rows: { loc: string; lastmod?: string; priority: string; changefreq: string; images?: string[] }[] = [];
	for (const s of STATIC) rows.push({ loc: `${SITE_URL}${s.path === '/' ? '/' : s.path}`, priority: s.priority, changefreq: s.changefreq });
	for (const p of Object.values(PRODUCTS)) rows.push({ loc: `${SITE_URL}${p.route}`, priority: '0.9', changefreq: 'monthly', images: p.gallery.map((g) => `${SITE_URL}${g}`) });

	try {
		const { data } = await supabase.from('posts').select('slug, updated_at, published_at, created_at').eq('published', true).order('published_at', { ascending: false });
		for (const post of data ?? []) {
			const d = post.updated_at || post.published_at || post.created_at;
			rows.push({ loc: `${SITE_URL}/blog/${post.slug}`, lastmod: d ? new Date(d).toISOString().slice(0, 10) : undefined, priority: '0.5', changefreq: 'monthly' });
		}
	} catch { /* senza database la sitemap esce senza gli articoli */ }

	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
		rows
			.map((r) => {
				const imgs = (r.images ?? []).map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`).join('');
				return `<url><loc>${esc(r.loc)}</loc>${r.lastmod ? `<lastmod>${r.lastmod}</lastmod>` : ''}<changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority>${imgs}</url>`;
			})
			.join('\n') +
		'\n</urlset>\n';
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
