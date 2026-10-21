/**
 * Area "home": la pagina iniziale (src/routes/+page.svelte). Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Home = typeof it;
const en: Home = { _: 'placeholder' };
const es: Home = { _: 'marcador' };
const fr: Home = { _: 'espace réservé' };
const de: Home = { _: 'Platzhalter' };
const nl: Home = { _: 'plaatshouder' };
export const home: Record<Lang, Home> = { it, en, es, fr, de, nl };
