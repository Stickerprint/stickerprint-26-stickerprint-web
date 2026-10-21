/**
 * t(): il testo nella lingua del locale. Le chiavi sono "area.nome" (es. "header.accedi", "home.titolo"); {segnaposto} si riempiono
 * con i parametri. Ogni AREA del sito ha il suo file in questa cartella con tutte e sei le lingue (la forma e' l'italiano,
 * TypeScript segnala le chiavi mancanti; il test controlla che nessuna lingua abbia testi vuoti). Regole e glossario: docs/traduzioni.md.
 * Nei componenti: const { t, path, prezzo } = usaLingua(); nel server: t(locale, 'chiave').
 */
import { getContext, setContext } from 'svelte';
import { LOCALES, PRICE_BOOKS, localizePath, toCurrency, formatAmount, type LocaleCode, type Locale, type Lang } from '$lib/i18n';
import { comune } from './comune';
import { home } from './home';
import { prodotti } from './prodotti';
import { configuratore } from './configuratore';
import { kit } from './kit';
import { fogli } from './fogli';
import { checkout } from './checkout';
import { account } from './account';
import { pagine } from './pagine';
import { email } from './email';
import { documenti } from './documenti';

const LINGUE: Lang[] = ['it', 'en', 'es', 'fr', 'de', 'nl'];
/** tutte le aree insieme, per lingua */
export const MESSAGGI = Object.fromEntries(LINGUE.map((l) => [l, { ...comune[l], home: home[l], prodotti: prodotti[l], configuratore: configuratore[l], kit: kit[l], fogli: fogli[l], checkout: checkout[l], account: account[l], pagine: pagine[l], email: email[l], documenti: documenti[l] }])) as unknown as Record<Lang, Record<string, unknown>>;
export type Params = Record<string, string | number>;
export type T = (chiave: string, params?: Params) => string;

function cerca(obj: unknown, chiave: string): string | undefined {
	let cur: unknown = obj;
	for (const parte of chiave.split('.')) { if (cur && typeof cur === 'object' && parte in (cur as object)) cur = (cur as Record<string, unknown>)[parte]; else return undefined; }
	return typeof cur === 'string' ? cur : undefined;
}
export function t(locale: LocaleCode, chiave: string, params?: Params): string {
	const lang = LOCALES[locale]?.lang ?? 'it';
	let s = cerca(MESSAGGI[lang], chiave) ?? cerca(MESSAGGI.it, chiave) ?? chiave;
	for (const [k, v] of Object.entries(params ?? {})) s = s.replaceAll(`{${k}}`, String(v));
	return s;
}
export const traduttore = (locale: LocaleCode): T => (chiave, params) => t(locale, chiave, params);
/** t() a partire dalla lingua (per email e PDF, dove si ha la lingua del cliente e non il locale) */
export const perLingua = (lang: Lang): LocaleCode => (Object.values(LOCALES).find((l) => l.lang === lang)?.code ?? 'it');

/* ------------------------------------------------------------------ numeri, prezzi, date per lingua */
/** prezzo a partire dagli euro: nella valuta del locale (dollari col listino), formato della lingua */
export const prezzoIn = (locale: Locale, eur: number, decimali = 2) => formatAmount(toCurrency(eur, locale.currency), locale, decimali);
/** prezzo al pezzo: fino a 4 decimali (0,295 €), mai meno di 2 */
export const prezzoUnitIn = (locale: Locale, eur: number) => new Intl.NumberFormat(locale.intl, { style: 'currency', currency: locale.currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(locale.currency === 'EUR' ? eur : (eur / 1.22) * PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup);
export const numeroIn = (locale: Locale, n: number, decimali = 0) => new Intl.NumberFormat(locale.intl, { maximumFractionDigits: decimali }).format(n);
export const dataIn = (locale: Locale, d: string | Date, lunga = false) => new Date(d).toLocaleDateString(locale.intl, lunga ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });

/* ------------------------------------------------------------------ contesto per i componenti */
const CHIAVE = Symbol('lingua');
export interface Lingua {
	code: LocaleCode; lang: Lang; locale: Locale; t: T;
	/** link interno con prefisso e slug della lingua: path('/adesivi-personalizzati') → /de/individuelle-aufkleber */
	path: (p: string) => string;
	/** prezzo dagli euro, nella valuta e nel formato della lingua */
	prezzo: (eur: number, decimali?: number) => string;
	prezzoUnit: (eur: number) => string;
	numero: (n: number, decimali?: number) => string;
	data: (d: string | Date, lunga?: boolean) => string;
}
export function creaLingua(code: LocaleCode): Lingua {
	const locale = LOCALES[code] ?? LOCALES.it;
	return { code: locale.code, lang: locale.lang, locale, t: traduttore(locale.code), path: (p) => localizePath(p, locale.code), prezzo: (e, d) => prezzoIn(locale, e, d), prezzoUnit: (e) => prezzoUnitIn(locale, e), numero: (n, d) => numeroIn(locale, n, d), data: (d, l) => dataIn(locale, d, l) };
}
export function impostaLingua(code: LocaleCode): Lingua {
	const l = creaLingua(code);
	setContext(CHIAVE, l);
	return l;
}
/** nel componente: const { t, path, prezzo } = usaLingua(); */
export function usaLingua(): Lingua {
	return getContext<Lingua>(CHIAVE) ?? creaLingua('it');
}
/** nomi delle lingue, per l'avviso "questo sito è disponibile in …" (ogni nome nella propria lingua) */
export const NOME_LINGUA: Record<LocaleCode, string> = { it: 'italiano', es: 'español', fr: 'français', de: 'Deutsch', nl: 'Nederlands', us: 'English' };
