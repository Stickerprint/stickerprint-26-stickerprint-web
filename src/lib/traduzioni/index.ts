/**
 * t(): il testo nella lingua del locale. Le chiavi sono "blocco.nome" (vedi it.ts); {segnaposto} si riempiono con i parametri.
 * Nei componenti si usa usaT() (contesto Svelte messo dal layout), nel server t(locale, chiave).
 */
import { getContext, setContext } from 'svelte';
import { LOCALES, type LocaleCode, type Locale } from '$lib/i18n';
import { it, type Traduzioni } from './it';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { nl } from './nl';

export const MESSAGGI: Record<Locale['lang'], Traduzioni> = { it, en, es, fr, de, nl };
export type Params = Record<string, string | number>;
export type T = (chiave: string, params?: Params) => string;

function cerca(obj: unknown, chiave: string): string | undefined {
	let cur: unknown = obj;
	for (const parte of chiave.split('.')) { if (cur && typeof cur === 'object' && parte in (cur as object)) cur = (cur as Record<string, unknown>)[parte]; else return undefined; }
	return typeof cur === 'string' ? cur : undefined;
}
export function t(locale: LocaleCode, chiave: string, params?: Params): string {
	const lang = LOCALES[locale]?.lang ?? 'it';
	let s = cerca(MESSAGGI[lang], chiave) ?? cerca(it, chiave) ?? chiave;
	for (const [k, v] of Object.entries(params ?? {})) s = s.replaceAll(`{${k}}`, String(v));
	return s;
}
export const traduttore = (locale: LocaleCode): T => (chiave, params) => t(locale, chiave, params);

/* ------------------------------------------------------------------ contesto per i componenti */
const CHIAVE = Symbol('lingua');
export interface Lingua { code: LocaleCode; locale: Locale; t: T; path: (p: string) => string }
export function impostaLingua(code: LocaleCode): Lingua {
	const locale = LOCALES[code] ?? LOCALES.it;
	const l: Lingua = { code: locale.code, locale, t: traduttore(locale.code), path: (p) => (locale.code === 'it' ? p : `${locale.path}${p === '/' ? '/' : p}`) };
	setContext(CHIAVE, l);
	return l;
}
/** nel componente: const { t, path, locale } = usaLingua(); */
export function usaLingua(): Lingua {
	return getContext<Lingua>(CHIAVE) ?? { code: 'it', locale: LOCALES.it, t: traduttore('it'), path: (p) => p };
}
/** nomi delle lingue, per l'avviso "questo sito è disponibile in …" (ogni nome nella propria lingua) */
export const NOME_LINGUA: Record<LocaleCode, string> = { it: 'italiano', es: 'español', fr: 'français', de: 'Deutsch', nl: 'Nederlands', us: 'English' };
