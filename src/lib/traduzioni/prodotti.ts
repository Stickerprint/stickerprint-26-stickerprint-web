/**
 * Area "prodotti": pagina prodotto e blocchi condivisi (ProductPage, Faq, HowTo, FinalCta, SamplesBlock, CompareBlock, ReviewsCarousel, Stars, Breadcrumb, /prodotti). Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Prodotti = typeof it;
const en: Prodotti = { _: 'placeholder' };
const es: Prodotti = { _: 'marcador' };
const fr: Prodotti = { _: 'espace réservé' };
const de: Prodotti = { _: 'Platzhalter' };
const nl: Prodotti = { _: 'plaatshouder' };
export const prodotti: Record<Lang, Prodotti> = { it, en, es, fr, de, nl };
