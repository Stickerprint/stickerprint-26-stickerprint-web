/**
 * URL in lingua: il primo pezzo del percorso cambia per ogni lingua (SEO: un tedesco cerca "aufkleber", non "adesivi").
 * La route interna resta quella italiana: /de/individuelle-aufkleber → route /adesivi-personalizzati (src/hooks.ts).
 * I pezzi dopo il primo (es. /blog/<slug>, /account/ordini) non si traducono.
 */
import type { Lang } from './i18n';

type Slug = Record<Exclude<Lang, 'it'>, string>;
export const SLUGS: Record<string, Slug> = {
	'adesivi-personalizzati': { es: 'pegatinas-personalizadas', fr: 'stickers-personnalises', de: 'individuelle-aufkleber', nl: 'stickers-op-maat', en: 'custom-stickers' },
	'adesivi-resinati': { es: 'pegatinas-resinadas', fr: 'stickers-resines', de: 'doming-aufkleber', nl: 'doming-stickers', en: 'domed-stickers' },
	'adesivi-rilievo': { es: 'pegatinas-en-relieve', fr: 'stickers-en-relief', de: 'relief-aufkleber', nl: 'relief-stickers', en: 'raised-stickers' },
	etichette: { es: 'etiquetas', fr: 'etiquettes', de: 'etiketten', nl: 'etiketten', en: 'labels' },
	fogli: { es: 'hojas-de-pegatinas', fr: 'planches-de-stickers', de: 'stickerbogen', nl: 'stickervellen', en: 'sticker-sheets' },
	vetrofanie: { es: 'vinilos-para-escaparate', fr: 'stickers-vitrine', de: 'fensteraufkleber', nl: 'raamstickers', en: 'window-decals' },
	'kit-adesivi': { es: 'pack-de-pegatinas', fr: 'kit-de-stickers', de: 'sticker-set', nl: 'stickerpakket', en: 'sticker-pack' },
	offerte: { es: 'ofertas', fr: 'promos', de: 'angebote', nl: 'aanbiedingen', en: 'deals' },
	aziende: { es: 'empresas', fr: 'entreprises', de: 'firmen', nl: 'zakelijk', en: 'business' },
	campioni: { es: 'muestras', fr: 'echantillons', de: 'muster', nl: 'proefpakket', en: 'samples' },
	'chi-siamo': { es: 'quienes-somos', fr: 'qui-sommes-nous', de: 'ueber-uns', nl: 'over-ons', en: 'about-us' },
	support: { es: 'ayuda', fr: 'assistance', de: 'hilfe', nl: 'klantenservice', en: 'support' },
	resi: { es: 'devoluciones', fr: 'retours', de: 'ruecksendungen', nl: 'retouren', en: 'returns' },
	recensioni: { es: 'resenas', fr: 'avis', de: 'bewertungen', nl: 'beoordelingen', en: 'reviews' },
	prodotti: { es: 'productos', fr: 'produits', de: 'produkte', nl: 'producten', en: 'products' },
	checkout: { es: 'carrito', fr: 'panier', de: 'warenkorb', nl: 'winkelwagen', en: 'cart' },
	login: { es: 'acceder', fr: 'connexion', de: 'anmelden', nl: 'inloggen', en: 'login' },
	signup: { es: 'registro', fr: 'inscription', de: 'registrieren', nl: 'registreren', en: 'signup' },
	account: { es: 'cuenta', fr: 'compte', de: 'konto', nl: 'account', en: 'account' },
	termini: { es: 'terminos', fr: 'conditions', de: 'agb', nl: 'voorwaarden', en: 'terms' },
	privacy: { es: 'privacidad', fr: 'confidentialite', de: 'datenschutz', nl: 'privacy', en: 'privacy' }
};
/** slug in lingua → pezzo interno (per la route) */
const INVERSO: Record<Exclude<Lang, 'it'>, Record<string, string>> = { es: {}, fr: {}, de: {}, nl: {}, en: {} };
for (const [interno, per] of Object.entries(SLUGS)) for (const [lang, slug] of Object.entries(per)) INVERSO[lang as Exclude<Lang, 'it'>][slug] = interno;

/** /individuelle-aufkleber/x → /adesivi-personalizzati/x (percorso gia' senza prefisso lingua) */
export function slugInterno(path: string, lang: Lang): string {
	if (lang === 'it') return path;
	const m = path.match(/^\/([^/]+)(.*)$/);
	if (!m) return path;
	const interno = INVERSO[lang][m[1]];
	return interno ? `/${interno}${m[2]}` : path;
}
/** /adesivi-personalizzati/x → /individuelle-aufkleber/x */
export function slugLocale(path: string, lang: Lang): string {
	if (lang === 'it') return path;
	const m = path.match(/^\/([^/]+)(.*)$/);
	if (!m) return path;
	const slug = SLUGS[m[1]]?.[lang];
	return slug ? `/${slug}${m[2]}` : path;
}
