/**
 * Lingue e valute del sito pubblico (la dashboard resta in italiano).
 *
 * Sei "locali": it (/), es (/es), fr (/fr), de (/de), nl (/nl) in euro, us (/us) in inglese e dollari.
 * - L'URL comanda: /de/adesivi-personalizzati e' la pagina tedesca; src/hooks.ts (reroute) toglie il prefisso
 *   per trovare la route, l'hook server legge il prefisso e mette la lingua in locals.locale.
 * - PUBLIC_LOCALES (es. "it,de,us") dice quali lingue sono ONLINE: le altre rispondono in italiano finche'
 *   non sono pronte. Lo staff le vede in anteprima col cookie sp-locale-preview (da /set-locale/anteprima).
 * - Niente redirect automatici sul paese: Google arriva dagli Stati Uniti e si ritroverebbe su /us.
 *   Il paese serve solo a SUGGERIRE la lingua; chi sceglie dal footer (cookie) viene tenuto nella sua.
 * - Prezzi: il motore calcola in euro; il dollaro ha un suo listino (cambio e maggiorazione, vedi PRICE_BOOKS).
 */
import { env } from '$env/dynamic/public';
import { slugInterno, slugLocale } from './slugs';

export type LocaleCode = 'it' | 'es' | 'fr' | 'de' | 'nl' | 'us';
export type Lang = 'it' | 'es' | 'fr' | 'de' | 'nl' | 'en';
export type Currency = 'EUR' | 'USD';
export interface Locale {
	code: LocaleCode; lang: Lang; currency: Currency;
	/** per <html lang> e hreflang */
	hreflang: string; intl: string;
	/** nome nel selettore, nella sua lingua */
	label: string; path: string; flag: LocaleCode;
	/** paesi che suggeriscono questa lingua (header x-vercel-ip-country) */
	countries: string[];
	/** spedizione gratuita da (nella valuta del locale) */
	freeShipping: number;
}
export const LOCALES: Record<LocaleCode, Locale> = {
	it: { code: 'it', lang: 'it', currency: 'EUR', hreflang: 'it', intl: 'it-IT', label: 'Italiano · € EUR', path: '', flag: 'it', countries: ['IT', 'SM', 'VA', 'CH'], freeShipping: 50 },
	es: { code: 'es', lang: 'es', currency: 'EUR', hreflang: 'es', intl: 'es-ES', label: 'Español · € EUR', path: '/es', flag: 'es', countries: ['ES'], freeShipping: 69 },
	fr: { code: 'fr', lang: 'fr', currency: 'EUR', hreflang: 'fr', intl: 'fr-FR', label: 'Français · € EUR', path: '/fr', flag: 'fr', countries: ['FR', 'BE', 'LU', 'MC'], freeShipping: 69 },
	de: { code: 'de', lang: 'de', currency: 'EUR', hreflang: 'de', intl: 'de-DE', label: 'Deutsch · € EUR', path: '/de', flag: 'de', countries: ['DE', 'AT'], freeShipping: 69 },
	nl: { code: 'nl', lang: 'nl', currency: 'EUR', hreflang: 'nl', intl: 'nl-NL', label: 'Nederlands · € EUR', path: '/nl', flag: 'nl', countries: ['NL'], freeShipping: 69 },
	us: { code: 'us', lang: 'en', currency: 'USD', hreflang: 'en-US', intl: 'en-US', label: 'English (US) · $ USD', path: '/us', flag: 'us', countries: ['US'], freeShipping: 99 }
};
export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];
/* 'sp-lingua' dal 21/10/2026 sera: il vecchio 'sp-locale' era stato scritto in automatico anche a chi restava in italiano e bloccava il redirect per paese */
export const LOCALE_COOKIE = 'sp-lingua';
export const PREVIEW_COOKIE = 'sp-locale-preview';
export const isLocale = (v: unknown): v is LocaleCode => typeof v === 'string' && v in LOCALES;
/** lingua da un locale salvato (ordine, profilo, cookie): sconosciuto o assente → italiano */
export const langOf = (code: unknown): Lang => LOCALES[isLocale(code) ? code : 'it'].lang;

/** lingue online (PUBLIC_LOCALES su Vercel, es. "it,de,us"); l'italiano c'e' sempre */
export function activeLocales(): LocaleCode[] {
	const list = (env.PUBLIC_LOCALES ?? 'it').split(',').map((s) => s.trim()).filter(isLocale);
	return ['it', ...list.filter((c) => c !== 'it')];
}

/** percorsi senza lingua: API, dashboard, studio, file tecnici */
const NON_LOCALIZZATI = ['/api', '/dashboard', '/studio', '/set-locale', '/robots.txt', '/sitemap.xml', '/sw.js', '/manifest.webmanifest', '/auth', '/logout', '/proof'];
export const isLocalizable = (pathname: string) => !NON_LOCALIZZATI.some((p) => pathname === p || pathname.startsWith(p + '/'));

/** dal percorso: la lingua del prefisso (null = italiano / nessun prefisso) e il percorso INTERNO senza prefisso (slug italiani) */
export function localeFromPath(pathname: string): { code: LocaleCode | null; rest: string } {
	const m = pathname.match(/^\/(es|fr|de|nl|us)(?=\/|$)/);
	if (!m) return { code: null, rest: pathname };
	const code = m[1] as LocaleCode;
	const rest = pathname.slice(m[0].length) || '/';
	return { code, rest: slugInterno(rest, LOCALES[code].lang) };
}
export const stripLocale = (pathname: string) => localeFromPath(pathname).rest;
/** lo stesso percorso in un'altra lingua, con lo slug tradotto: /de/individuelle-aufkleber; l'italiano non ha prefisso */
export function localizePath(pathname: string, code: LocaleCode): string {
	const rest = stripLocale(pathname);
	if (!isLocalizable(rest) || code === 'it') return rest;
	/* home in lingua: /de senza barra finale (SvelteKit toglie le barre finali: con /de/ si rimbalzava fra /de e /de/) */
	if (rest === '/') return LOCALES[code].path;
	return `${LOCALES[code].path}${slugLocale(rest, LOCALES[code].lang)}`;
}

/** lingua suggerita da paese (header Vercel) e lingua del browser, fra quelle ammesse; mai un redirect, solo un suggerimento */
export function detectLocale(country: string | null, acceptLanguage: string | null, allowed: LocaleCode[] = LOCALE_CODES): LocaleCode {
	const ok = (c: LocaleCode) => allowed.includes(c);
	const c = (country ?? '').toUpperCase();
	for (const l of Object.values(LOCALES)) if (l.countries.includes(c) && ok(l.code)) return l.code;
	const langs = (acceptLanguage ?? '').toLowerCase().split(',').map((s) => s.trim().split(';')[0].slice(0, 2));
	for (const lang of langs) {
		const hit = Object.values(LOCALES).find((l) => l.lang === lang && ok(l.code) && l.code !== 'us');
		if (hit) return hit.code;
		if (lang === 'en' && ok('us')) return 'us';
	}
	return 'it';
}

/* ------------------------------------------------------------------ valute */
/** listino per valuta: il motore prezzi calcola in euro IVA inclusa; in dollari si toglie l'IVA (export) e si applica
 *  cambio × maggiorazione (spedizione USA dentro il prezzo), arrotondando a 0,05. Da spostare in dashboard (tabella)
 *  quando si parte davvero con gli USA: cambio e maggiorazione li decide Mattia. */
export const PRICE_BOOKS: Record<Currency, { rate: number; markup: number; step: number }> = {
	EUR: { rate: 1, markup: 1, step: 0.01 },
	USD: { rate: 1.08, markup: 1.1, step: 0.05 }
};
/** @deprecated usa PRICE_BOOKS.USD.rate */
export const USD_RATE = PRICE_BOOKS.USD.rate;
/** IVA italiana: i prezzi del sito sono IVA inclusa; fuori dall'UE (dollari) l'IVA non c'e' e si parte dal netto */
export const IVA_IT = 0.22;
/** importo in euro → importo nella valuta del locale (numero), con l'arrotondamento del listino.
 *  `lordo` (default) = l'importo in euro e' IVA inclusa: in dollari si toglie l'IVA prima del cambio (export senza IVA). */
export function toCurrency(amountEur: number, currency: Currency, lordo = true): number {
	if (currency === 'EUR') return Math.round(amountEur * 100) / 100;
	const b = PRICE_BOOKS[currency];
	const base = lordo ? amountEur / (1 + IVA_IT) : amountEur;
	const v = base * b.rate * b.markup;
	return Math.round(Math.round(v / b.step) * b.step * 100) / 100;
}
export function formatMoney(amountEur: number, locale: Locale, decimals = 2): string {
	const value = toCurrency(amountEur, locale.currency);
	return new Intl.NumberFormat(locale.intl, { style: 'currency', currency: locale.currency, useGrouping: 'always', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
/** formatta un importo gia' nella valuta (niente conversione) */
export function formatAmount(value: number, locale: Locale, decimals = 2): string {
	return new Intl.NumberFormat(locale.intl, { style: 'currency', currency: locale.currency, useGrouping: 'always', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
