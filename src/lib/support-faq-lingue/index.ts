/**
 * FAQ statiche del supporto nelle altre lingue (la base italiana e' src/lib/support-faq.ts; le FAQ del database sono solo in italiano).
 * Stessa struttura (SupportTopic[]) e stesso ordine di argomenti e domande. I segnaposto {soglia} (spedizione gratuita da) e
 * {campioni} (prezzo del kit campioni) si riempiono con la valuta del locale: mai cifre scritte a mano nei testi.
 */
import { LOCALES, formatAmount, toCurrency, type Lang } from '$lib/i18n';
import { SUPPORT_TOPICS, type SupportTopic } from '$lib/support-faq';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { nl } from './nl';

const PER_LINGUA: Record<Lang, SupportTopic[]> = { it: SUPPORT_TOPICS, en, es, fr, de, nl };

/** le FAQ nella lingua: per 'it' quelle italiane, per le altre la traduzione statica con le cifre del locale */
export function supportFaqFor(lang: Lang): SupportTopic[] {
	if (lang === 'it') return SUPPORT_TOPICS;
	const locale = Object.values(LOCALES).find((l) => l.lang === lang) ?? LOCALES.it;
	const valori: Record<string, string> = { soglia: formatAmount(locale.freeShipping, locale, 0), campioni: formatAmount(toCurrency(10, locale.currency), locale, 0) };
	const riempi = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => valori[k] ?? m);
	return (PER_LINGUA[lang] ?? SUPPORT_TOPICS).map((t) => ({ title: t.title, faqs: t.faqs.map((f) => ({ q: riempi(f.q), a: riempi(f.a) })) }));
}
