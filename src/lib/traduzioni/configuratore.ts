/**
 * Area "configuratore": Configurator, UploadPreview, EnginePreview, FreeShippingBar, StudioLente, ReorderModal. Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Configuratore = typeof it;
const en: Configuratore = { _: 'placeholder' };
const es: Configuratore = { _: 'marcador' };
const fr: Configuratore = { _: 'espace réservé' };
const de: Configuratore = { _: 'Platzhalter' };
const nl: Configuratore = { _: 'plaatshouder' };
export const configuratore: Record<Lang, Configuratore> = { it, en, es, fr, de, nl };
