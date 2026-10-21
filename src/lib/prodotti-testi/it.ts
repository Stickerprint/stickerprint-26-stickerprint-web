/** Tipi e testi italiani dei prodotti (la forma per le altre lingue). */
import { PRODUCTS, KIT, type ProductContent } from '$lib/products';
import type { CompareData } from '$lib/components/CompareBlock.svelte';

/** i campi di testo di un prodotto (tutto cio' che si traduce) */
export interface ProductTexts {
	name: string; title: string; h1?: [string, string]; seoTitle?: string; seoDesc?: string; seoCategory?: string;
	sub: string; desc: string; checks: string[]; cosa: string; faq: { q: string; a: string }[]; faqTitle: string; cta: string;
	compare?: CompareData; care: ProductContent['care']; reviewsTitle: string; reviewsHl: string; reviewsSub: string;
}
export interface KitTexts { price: string; checks: string[] }
export interface TestiLingua { prodotti: Record<string, ProductTexts>; kit: KitTexts }

const CAMPI: (keyof ProductTexts)[] = ['name', 'title', 'h1', 'seoTitle', 'seoDesc', 'seoCategory', 'sub', 'desc', 'checks', 'cosa', 'faq', 'faqTitle', 'cta', 'compare', 'care', 'reviewsTitle', 'reviewsHl', 'reviewsSub'];
/** i testi italiani, presi da products.ts (la forma per le altre lingue) */
export const testiIt: TestiLingua = {
	prodotti: Object.fromEntries(Object.entries(PRODUCTS).map(([slug, p]) => [slug, Object.fromEntries(CAMPI.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) as unknown as ProductTexts])),
	kit: { price: KIT.price, checks: KIT.checks }
};

