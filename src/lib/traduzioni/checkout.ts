/**
 * Area "checkout": checkout, grazie, messaggi del server del checkout, LoyaltyCard, OrderRow. Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla).
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	_: 'segnaposto'
};
export type Checkout = typeof it;
const en: Checkout = { _: 'placeholder' };
const es: Checkout = { _: 'marcador' };
const fr: Checkout = { _: 'espace réservé' };
const de: Checkout = { _: 'Platzhalter' };
const nl: Checkout = { _: 'plaatshouder' };
export const checkout: Record<Lang, Checkout> = { it, en, es, fr, de, nl };
