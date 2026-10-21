/**
 * Area "account": area personale, login, signup, reset password, pagina di errore. Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Account = typeof it;
const en: Account = { _: 'placeholder' };
const es: Account = { _: 'marcador' };
const fr: Account = { _: 'espace réservé' };
const de: Account = { _: 'Platzhalter' };
const nl: Account = { _: 'plaatshouder' };
export const account: Record<Lang, Account> = { it, en, es, fr, de, nl };
