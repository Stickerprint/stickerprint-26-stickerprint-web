import type { RequestHandler } from './$types';
import { SITE_URL, isProductionHost } from '$lib/seo';

/**
 * robots.txt per ambiente:
 * - produzione (stickerprint.it): scansione libera delle pagine pubbliche, esclusi account, checkout, dashboard, api e link con token;
 *   le pagine private hanno comunque il meta noindex, il Disallow qui serve solo a non sprecare scansioni.
 * - test e anteprime (meett.it, *.vercel.app): tutto bloccato e nessuna sitemap. Il meta noindex + X-Robots-Tag lo mette hooks.server.ts:
 *   Google legge il noindex anche se qui c'e' il Disallow? No: per sicurezza sui domini di test NON blocchiamo la scansione,
 *   cosi' Googlebot vede il noindex e toglie le pagine dall'indice se mai ci fossero entrate.
 */
export const GET: RequestHandler = ({ url }) => {
	const prod = isProductionHost(url.host);
	const body = prod
		? ['User-agent: *', 'Allow: /', 'Disallow: /account', 'Disallow: /dashboard', 'Disallow: /admin', 'Disallow: /checkout', 'Disallow: /api/', 'Disallow: /login', 'Disallow: /signup', 'Disallow: /logout', 'Disallow: /reset-password', 'Disallow: /auth/', 'Disallow: /fattura/', 'Disallow: /preventivo/', 'Disallow: /conferma/', 'Disallow: /assistenza/', 'Disallow: /recensione/', 'Disallow: /proof/', 'Disallow: /en', 'Disallow: /us', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n')
		: ['# Dominio di test: le pagine sono servite con noindex, nofollow (meta e X-Robots-Tag).', 'User-agent: *', 'Allow: /', 'Disallow: /account', 'Disallow: /dashboard', 'Disallow: /checkout', 'Disallow: /api/', ''].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
