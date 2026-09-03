/**
 * Lingue e valute del sito. Oggi i testi sono in italiano: qui c'è la struttura
 * (rilevamento automatico, cookie, selettore nel footer, percorsi /en e /us) su cui
 * arriveranno le traduzioni e i prezzi in dollari.
 */
export type LocaleCode = 'it' | 'en' | 'us';
export interface Locale { code: LocaleCode; lang: 'it' | 'en'; currency: 'EUR' | 'USD'; label: string; path: string; flag: 'it' | 'eu' | 'us' }
export const LOCALES: Record<LocaleCode, Locale> = {
	it: { code: 'it', lang: 'it', currency: 'EUR', label: 'Italiano (IT) - € EUR', path: '/', flag: 'it' },
	en: { code: 'en', lang: 'en', currency: 'EUR', label: 'English (EN) - € EUR', path: '/en', flag: 'eu' },
	us: { code: 'us', lang: 'en', currency: 'USD', label: 'English (EN) - $ USD', path: '/us', flag: 'us' }
};
export const LOCALE_COOKIE = 'sp-locale';
/** Cambio EUR → USD usato per i prezzi in dollari (da aggiornare periodicamente) */
export const USD_RATE = 1.08;
export const isLocale = (v: unknown): v is LocaleCode => v === 'it' || v === 'en' || v === 'us';
/** Rilevamento: paese (header Vercel) e lingua del browser */
export function detectLocale(country: string | null, acceptLanguage: string | null): LocaleCode {
	if (country === 'US') return 'us';
	if (country === 'IT') return 'it';
	const lang = (acceptLanguage ?? '').toLowerCase();
	if (lang.startsWith('it')) return 'it';
	if (lang) return 'en';
	return 'it';
}
export function formatMoney(amountEur: number, locale: Locale, decimals = 2): string {
	const value = locale.currency === 'USD' ? amountEur * USD_RATE : amountEur;
	return new Intl.NumberFormat(locale.lang === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: locale.currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
