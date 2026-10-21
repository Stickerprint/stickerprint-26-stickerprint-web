/**
 * Area "kit": KitBuilder e /kit-adesivi. Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Kit = typeof it;
const en: Kit = { _: 'placeholder' };
const es: Kit = { _: 'marcador' };
const fr: Kit = { _: 'espace réservé' };
const de: Kit = { _: 'Platzhalter' };
const nl: Kit = { _: 'plaatshouder' };
export const kit: Record<Lang, Kit> = { it, en, es, fr, de, nl };
