/**
 * LINGUA E VALUTA DEL CLIENTE: un solo punto per tutto quello che gli arriva (regola di Mattia, 26/11/2026).
 *
 * Ogni email e ogni documento commerciale (conferma d'ordine, fattura, preventivo, avvisi di spedizione) esce nella
 * lingua del cliente e, se ha pagato in dollari, con gli importi in dollari. Da noi (dashboard, XML per lo SDI) tutto
 * resta in italiano e in euro: quello non passa da qui.
 *
 * Come si decide la lingua:
 *  - ordine del sito → il sito da cui ha ordinato (`orders.locale`: /de, /us...);
 *  - ordine manuale, preventivo, fattura dai DDT → il paese di fatturazione (la colonna `locale` di un ordine manuale
 *    vale sempre 'it' perche' e' il valore predefinito: NON dice la lingua del cliente);
 *  - ticket e richieste → la lingua del modulo da cui sono arrivati, altrimenti quella dell'ultimo ordine di quell'email.
 *
 * File senza dipendenze dal server: lo usano anche i testi proposti nella dashboard.
 */
import { LOCALES, isLocale, langOf, type Currency, type Lang, type LocaleCode } from '$lib/i18n';

export interface LinguaCliente { lang: Lang; locale: LocaleCode }
const LINGUE: Lang[] = ['it', 'en', 'es', 'fr', 'de', 'nl'];
/** nome della lingua in italiano, per gli avvisi allo staff in dashboard */
export const NOME_LINGUA: Record<Lang, string> = { it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco', nl: 'olandese' };
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LINGUE as string[]).includes(v);
/** locale di una lingua, quando si ha solo quella: l'inglese e' quello in euro (/en), mai i dollari */
const localeDi = (lang: Lang): LocaleCode => (lang === 'en' ? 'en' : (Object.values(LOCALES).find((l) => l.lang === lang)?.code ?? 'it'));
export const daLingua = (lang: Lang): LinguaCliente => ({ lang, locale: localeDi(lang) });

/** Lingua dal paese: Italia (e i paesi del sito italiano) = italiano; un paese con la sua lingua sul sito = quella; ogni altro paese = inglese */
export function linguaDaPaese(country?: string | null): Lang {
	const c = (country || 'IT').trim().toUpperCase();
	/* il paese puo' arrivare scritto per esteso dalle anagrafiche inserite a mano */
	const iso = c.length === 2 ? c : (NOMI_PAESE[c] ?? (c ? '??' : 'IT'));
	if (iso === '??') return 'it';
	return Object.values(LOCALES).find((l) => l.countries.includes(iso))?.lang ?? 'en';
}
/* nomi di paese che capitano nelle anagrafiche scritte a mano → codice ISO. Un nome sconosciuto resta italiano:
   meglio un'email in italiano a un cliente che abbiamo inserito noi, che in inglese a un italiano scritto male. */
const NOMI_PAESE: Record<string, string> = {
	ITALIA: 'IT', ITALY: 'IT', ITALIEN: 'IT', ITALIE: 'IT',
	GERMANIA: 'DE', GERMANY: 'DE', DEUTSCHLAND: 'DE', AUSTRIA: 'AT', ÖSTERREICH: 'AT',
	FRANCIA: 'FR', FRANCE: 'FR', BELGIO: 'BE', BELGIUM: 'BE', BELGIQUE: 'BE', LUSSEMBURGO: 'LU', LUXEMBOURG: 'LU',
	SPAGNA: 'ES', SPAIN: 'ES', ESPAÑA: 'ES', ESPANA: 'ES',
	OLANDA: 'NL', 'PAESI BASSI': 'NL', NETHERLANDS: 'NL', NEDERLAND: 'NL',
	'STATI UNITI': 'US', USA: 'US', 'UNITED STATES': 'US',
	SVIZZERA: 'CH', SWITZERLAND: 'CH', SCHWEIZ: 'CH', SUISSE: 'CH', 'SAN MARINO': 'SM',
	'REGNO UNITO': 'GB', UK: 'GB', 'UNITED KINGDOM': 'GB', PORTOGALLO: 'PT', PORTUGAL: 'PT', IRLANDA: 'IE', IRELAND: 'IE',
	POLONIA: 'PL', POLAND: 'PL', SVEZIA: 'SE', SWEDEN: 'SE', DANIMARCA: 'DK', DENMARK: 'DK', GRECIA: 'GR', GREECE: 'GR'
};

type Indirizzo = Record<string, string> | null | undefined;
/** un ordine arriva dal sito (e allora `locale` e' la lingua scelta dal cliente) o lo abbiamo inserito noi? */
const delSito = (o: { channel?: string | null }) => !!o.channel && o.channel !== 'manuale';

/** Lingua del cliente di un ordine (basta una riga del gruppo). */
export function linguaOrdine(o: { locale?: string | null; channel?: string | null; billing?: Indirizzo; shipping?: Indirizzo } | null | undefined): LinguaCliente {
	if (!o) return daLingua('it');
	if (delSito(o) && isLocale(o.locale)) return { lang: langOf(o.locale), locale: o.locale };
	/* inserito a mano: 'it' e' solo il valore predefinito della colonna; una lingua diversa, se c'e', e' voluta */
	if (isLocale(o.locale) && o.locale !== 'it') return { lang: langOf(o.locale), locale: o.locale };
	return daLingua(linguaDaPaese(o.billing?.country || o.shipping?.country));
}
/** Lingua del cliente di un preventivo: quella indicata nella bozza, altrimenti il paese dell'anagrafica */
export function linguaPreventivo(draft: { lang?: string | null; customer?: { country?: string | null } | null } | null | undefined): LinguaCliente {
	if (isLang(draft?.lang)) return daLingua(draft.lang);
	return daLingua(linguaDaPaese(draft?.customer?.country));
}

/* ------------------------------------------------------------------ valuta */
/** Quanto ha pagato il cliente nella sua valuta, se non e' l'euro (ordini dal sito USA): somma delle righe dell'ordine */
export function pagatoInValuta(rows: { currency?: string | null; total_paid_currency?: number | string | null }[]): { currency: Currency; amount: number } | null {
	const cur = rows.map((r) => r.currency).find((c) => c && c !== 'EUR');
	if (cur !== 'USD') return null;
	const amount = Math.round(rows.filter((r) => r.currency === cur).reduce((s, r) => s + Number(r.total_paid_currency ?? 0), 0) * 100) / 100;
	return amount > 0 ? { currency: cur, amount } : null;
}
/**
 * Convertitore euro → valuta del cliente per UN documento: il rapporto e' quello vero di quell'ordine
 * (pagato in valuta / totale in euro), non il listino di oggi, cosi' la somma torna al centesimo con l'addebito.
 * `totaleEur` = totale in euro del documento a cui corrisponde `pagato`.
 */
export function convertitore(pagato: { currency: Currency; amount: number } | null | undefined, totaleEur: number): { currency: Currency; k: number; conv: (eur: number) => number } {
	if (!pagato || pagato.currency === 'EUR' || !(totaleEur > 0) || !(pagato.amount > 0)) return { currency: 'EUR', k: 1, conv: (v) => Math.round(v * 100) / 100 };
	const k = pagato.amount / totaleEur;
	return { currency: pagato.currency, k, conv: (v) => Math.round(v * k * 100) / 100 };
}
/** Ripartisce `totale` (in valuta) sulle righe in proporzione ai loro importi in euro: la somma delle righe fa `totale` al centesimo */
export function ripartisci(importiEur: number[], totale: number): number[] {
	const somma = importiEur.reduce((s, v) => s + v, 0);
	if (!(somma > 0)) return importiEur.map(() => 0);
	const out = importiEur.map((v) => Math.round((v / somma) * totale * 100) / 100);
	const resto = Math.round((totale - out.reduce((s, v) => s + v, 0)) * 100) / 100;
	if (resto !== 0) { let i = 0; for (let j = 1; j < out.length; j++) if (importiEur[j] > importiEur[i]) i = j; out[i] = Math.round((out[i] + resto) * 100) / 100; }
	return out;
}
/** importo gia' nella valuta, nel formato della lingua del cliente (i dollari sempre all'americana: $85.50) */
export function formatoValuta(v: number, currency: Currency, lang: Lang, maxDec = 2): string {
	const intl = currency === 'USD' ? 'en-US' : LOCALES[localeDi(lang)].intl;
	return new Intl.NumberFormat(intl, { style: 'currency', currency, useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: maxDec }).format(v);
}
/** data nel formato della lingua del cliente; `stile`: 'breve' 8 nov 2026 · 'lunga' 8 novembre 2026 · 'giorno' lunedì 8 novembre */
export function dataCliente(d: string | Date | null | undefined, lang: Lang, stile: 'breve' | 'lunga' | 'giorno' = 'lunga'): string | null {
	if (!d) return null;
	const quando = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d);
	if (Number.isNaN(quando.getTime())) return null;
	const intl = LOCALES[localeDi(lang)].intl;
	const o: Intl.DateTimeFormatOptions = stile === 'giorno' ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: stile === 'breve' ? 'short' : 'long', year: 'numeric' };
	return quando.toLocaleDateString(intl, o);
}
