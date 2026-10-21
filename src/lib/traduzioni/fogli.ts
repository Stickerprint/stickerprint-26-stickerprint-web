/**
 * Area "fogli": SheetBuilder e /fogli. Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Fogli = typeof it;
const en: Fogli = { _: 'placeholder' };
const es: Fogli = { _: 'marcador' };
const fr: Fogli = { _: 'espace réservé' };
const de: Fogli = { _: 'Platzhalter' };
const nl: Fogli = { _: 'plaatshouder' };
export const fogli: Record<Lang, Fogli> = { it, en, es, fr, de, nl };
