/**
 * SEO: un solo posto per il dominio canonico, i percorsi privati e i dati strutturati.
 *
 * - SITE_URL e' il dominio definitivo (canonical, sitemap, Open Graph, JSON-LD): NON dipende
 *   dalla variabile PUBLIC_SITE_URL, che serve ai link nelle email e oggi punta a Vercel.
 * - Qualsiasi host diverso da quello di produzione (anteprime Vercel, meett.it, stickerprint-web.vercel.app)
 *   viene servito con noindex, nofollow (meta + header X-Robots-Tag) e senza sitemap: vedi hooks.server.ts.
 */
export const SITE_URL = 'https://stickerprint.it';
export const SITE_NAME = 'Stickerprint';
export const SITE_HOST = new URL(SITE_URL).host;
/** immagine social di riserva (1200x630) */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-stickerprint.jpg`;

/** host che Google puo' indicizzare: solo il dominio definitivo (con o senza www) */
export function isProductionHost(host: string | null | undefined): boolean {
	const h = (host ?? '').toLowerCase().replace(/:\d+$/, '');
	return h === SITE_HOST || h === `www.${SITE_HOST}`;
}

/** percorsi che non vanno mai in indice (area personale, dashboard, checkout, link con token) */
const PRIVATE_PREFIXES = ['/account', '/dashboard', '/admin', '/checkout', '/login', '/signup', '/logout', '/reset-password', '/auth', '/api', '/fattura', '/preventivo', '/conferma', '/assistenza', '/recensione', '/proof', '/en', '/us'];
export function isPrivatePath(pathname: string): boolean {
	return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** URL canonico assoluto: dominio definitivo, percorso senza query e senza barra finale */
export function canonicalUrl(pathname: string): string {
	const clean = pathname.replace(/\/+$/, '') || '/';
	return clean === '/' ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

export function absUrl(path: string): string {
	if (/^https?:\/\//.test(path)) return path;
	return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/* ------------------------------------------------------------------ JSON-LD */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** serializza un nodo JSON-LD in modo sicuro dentro <script> */
export function jsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: canonicalUrl(it.path) }))
	};
}

export interface ProductLdInput {
	path: string;
	name: string;
	description: string;
	images: string[];
	sku: string;
	category?: string;
	material?: string;
	/** prezzo "a partire da" davvero mostrato in pagina, IVA inclusa, in euro */
	fromPrice?: number | null;
	/** media e numero recensioni del prodotto, SOLO se vengono da recensioni vere del database */
	rating?: { average: number; count: number } | null;
	/** recensioni vere mostrate in pagina (mai quelle di esempio) */
	reviews?: { author: string; body: string; rating: number; date?: string; title?: string }[];
}

export function productLd(p: ProductLdInput) {
	const url = canonicalUrl(p.path);
	const node: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		'@id': `${url}#product`,
		name: p.name,
		url,
		description: p.description,
		image: p.images.map(absUrl),
		sku: p.sku,
		brand: { '@type': 'Brand', name: SITE_NAME },
		manufacturer: { '@id': ORG_ID }
	};
	if (p.category) node.category = p.category;
	if (p.material) node.material = p.material;
	if (p.fromPrice && p.fromPrice > 0) {
		node.offers = {
			'@type': 'AggregateOffer',
			url,
			priceCurrency: 'EUR',
			lowPrice: p.fromPrice.toFixed(2),
			offerCount: 1,
			availability: 'https://schema.org/InStock',
			itemCondition: 'https://schema.org/NewCondition',
			seller: { '@id': ORG_ID }
		};
	}
	if (p.rating && p.rating.count > 0 && p.rating.average > 0 && p.rating.average <= 5) {
		node.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.rating.average.toFixed(1), bestRating: '5', worstRating: '1', reviewCount: p.rating.count };
		if (p.reviews?.length) {
			node.review = p.reviews.slice(0, 10).map((r) => {
				const rv: Record<string, unknown> = {
					'@type': 'Review',
					author: { '@type': 'Person', name: r.author },
					reviewBody: r.body,
					reviewRating: { '@type': 'Rating', ratingValue: String(Math.max(1, Math.min(5, r.rating))), bestRating: '5', worstRating: '1' }
				};
				if (r.title) rv.name = r.title;
				if (r.date) rv.datePublished = r.date;
				return rv;
			});
		}
	}
	return node;
}
