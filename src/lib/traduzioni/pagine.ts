/**
 * Area "pagine": offerte, aziende, campioni, chi-siamo, support, resi, recensioni, recensione, legali, blog (contorno). Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Pagine = typeof it;
const en: Pagine = { _: 'placeholder' };
const es: Pagine = { _: 'marcador' };
const fr: Pagine = { _: 'espace réservé' };
const de: Pagine = { _: 'Platzhalter' };
const nl: Pagine = { _: 'plaatshouder' };
export const pagine: Record<Lang, Pagine> = { it, en, es, fr, de, nl };
