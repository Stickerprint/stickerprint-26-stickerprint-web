/**
 * Testi delle pagine prodotto per lingua. Le foto, le route interne e il motore stanno in src/lib/products.ts (italiano, forma);
 * qui ogni lingua ha SOLO i testi, con le stesse chiavi (TypeScript le controlla). productFor(slug, lang) li mette insieme.
 */
import { PRODUCTS, KIT, type ProductContent } from '$lib/products';
import type { Lang } from '$lib/i18n';
import { testiIt, type TestiLingua } from './it';
export { testiIt, type ProductTexts, type KitTexts, type TestiLingua } from './it';

import { testiEn } from './en';
import { testiEs } from './es';
import { testiFr } from './fr';
import { testiDe } from './de';
import { testiNl } from './nl';
export const TESTI: Record<Lang, TestiLingua> = { it: testiIt, en: testiEn, es: testiEs, fr: testiFr, de: testiDe, nl: testiNl };

/** il prodotto completo nella lingua: foto e motore dall'italiano, testi dalla lingua (se manca, italiano) */
export function productFor(slug: string, lang: Lang): ProductContent | null {
	const base = PRODUCTS[slug];
	if (!base) return null;
	const testi = TESTI[lang]?.prodotti[slug] ?? testiIt.prodotti[slug];
	return { ...base, ...testi };
}
export const kitFor = (lang: Lang) => ({ ...KIT, ...(TESTI[lang]?.kit ?? testiIt.kit) });
