/**
 * Pagine dei documenti del cliente (fattura, conferma d'ordine, preventivo, assistenza): si aprono nella SUA lingua
 * anche quando il link non ha il prefisso (email vecchie, link copiati dalla dashboard, link incollati in chat).
 * Regola di Mattia del 26/11/2026: tutto quello che arriva al cliente e' nella sua lingua.
 */
import { redirect } from '@sveltejs/kit';
import { activeLocales, localizePath, stripLocale, type LocaleCode } from '$lib/i18n';

/**
 * Se la pagina e' aperta senza prefisso di lingua e il cliente ne ha un'altra (online), rimanda a quella. Con un prefisso
 * gia' nell'indirizzo non fa nulla. Chi ha fatto l'accesso non viene rimandato: lo staff apre queste pagine dalla
 * dashboard, e il rinvio gli cambierebbe la lingua salvata di tutto il sito (il cookie segue il prefisso); un cliente
 * con l'account naviga gia' nella sua lingua.
 */
export function vaiAllaLinguaDelCliente(url: URL, attuale: LocaleCode, cliente: LocaleCode, conAccesso = false): void {
	if (conAccesso || attuale !== 'it' || cliente === 'it') return;
	if (!activeLocales().includes(cliente)) return;
	redirect(302, `${localizePath(stripLocale(url.pathname), cliente)}${url.search}`);
}
