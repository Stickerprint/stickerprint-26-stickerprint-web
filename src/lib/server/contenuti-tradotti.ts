/**
 * Contenuti che vivono nel database (FAQ, articoli del blog, offerte) nelle altre lingue.
 * Ordine di ricerca per un campo tradotto:
 *   1. colonna `tr` della riga (migrazione 0060), riempita dal lavoro /api/cron/traduzioni o dal bottone in dashboard;
 *   2. src/lib/contenuti-tradotti/contenuti.json (traduzioni fatte il 21/10/2026, valide finche' l'italiano non cambia: impronta);
 *   3. per le FAQ, la traduzione statica di src/lib/support-faq-lingue se domanda e risposta italiane coincidono;
 *   4. l'italiano.
 */
import { createHash } from 'node:crypto';
import { LOCALES, type Lang } from '$lib/i18n';
import { SUPPORT_TOPICS } from '$lib/support-faq';
import { en } from '$lib/support-faq-lingue/en';
import { es } from '$lib/support-faq-lingue/es';
import { fr } from '$lib/support-faq-lingue/fr';
import { de } from '$lib/support-faq-lingue/de';
import { nl } from '$lib/support-faq-lingue/nl';
import contenuti from '$lib/contenuti-tradotti/contenuti.json';

/** lingue da tradurre: tutte quelle definite in LOCALES tranne l'italiano (una lingua nuova entra da sola, senza altro lavoro) */
export const LINGUE_ESTERE: Exclude<Lang, 'it'>[] = [...new Set(Object.values(LOCALES).map((l) => l.lang))].filter((l): l is Exclude<Lang, 'it'> => l !== 'it');
type Riga = { id: string; tr?: Record<string, unknown> | null };
type File = Record<string, Record<string, { _hash?: string } & Record<string, Record<string, unknown>>>>;
const FILE = contenuti as unknown as File;

/** impronta dell'italiano: se cambia, la traduzione salvata non vale piu' */
export const impronta = (campi: Record<string, unknown>) => createHash('sha1').update(JSON.stringify(campi)).digest('hex').slice(0, 16);

/** traduzione di una riga (tutti i campi) nella lingua, o null se non c'e' una traduzione valida */
export function traduzioneDi(tabella: string, riga: Riga, lang: Lang, italiano: Record<string, unknown>): Record<string, unknown> | null {
	if (lang === 'it') return null;
	const h = impronta(italiano);
	const db = riga.tr?.[lang];
	const hashDb = riga.tr?._hash;
	if (db && typeof db === 'object' && (!hashDb || hashDb === h)) return db as Record<string, unknown>;
	const f = FILE[tabella]?.[riga.id];
	if (f && f[lang] && (!f._hash || f._hash === h)) return f[lang];
	return null;
}

/* FAQ statiche: domanda+risposta italiana → traduzioni (stesso ordine nei cinque file) */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const STATICHE: Map<string, Record<string, { q: string; a: string }>> = new Map();
const perLingua: Record<string, typeof en> = { en, es, fr, de, nl };
SUPPORT_TOPICS.forEach((t, i) => t.faqs.forEach((f, j) => {
	const out: Record<string, { q: string; a: string }> = {};
	for (const l of LINGUE_ESTERE) { const x = perLingua[l]?.[i]?.faqs?.[j]; if (x) out[l] = { q: x.q, a: x.a }; }
	STATICHE.set(norm(f.q) + '\n' + norm(f.a), out);
}));
const TITOLI: Map<string, Record<string, string>> = new Map();
SUPPORT_TOPICS.forEach((t, i) => { const out: Record<string, string> = {}; for (const l of LINGUE_ESTERE) { const x = perLingua[l]?.[i]; if (x) out[l] = x.title; } TITOLI.set(norm(t.title), out); });

/** domanda e risposta di una FAQ nella lingua ({soglia}/{campioni} restano da riempire a chi mostra) */
export function faqTradotta(item: Riga & { q: string; a: string }, lang: Lang): { q: string; a: string } {
	if (lang === 'it') return { q: item.q, a: item.a };
	const t = traduzioneDi('faq_items', item, lang, { q: item.q, a: item.a });
	if (t && typeof t.q === 'string' && typeof t.a === 'string') return { q: t.q, a: t.a };
	const s = STATICHE.get(norm(item.q) + '\n' + norm(item.a))?.[lang];
	return s ?? { q: item.q, a: item.a };
}
export function categoriaFaqTradotta(cat: Riga & { name: string }, lang: Lang): string {
	if (lang === 'it') return cat.name;
	const t = traduzioneDi('faq_categories', cat, lang, { name: cat.name });
	if (t && typeof t.name === 'string') return t.name;
	return TITOLI.get(norm(cat.name))?.[lang] ?? cat.name;
}
export function categoriaPostTradotta(nome: string, lang: Lang): string {
	if (lang === 'it') return nome;
	const f = (contenuti as unknown as { post_categories?: Record<string, Record<string, string>> }).post_categories?.[nome];
	return f?.[lang] ?? nome;
}
