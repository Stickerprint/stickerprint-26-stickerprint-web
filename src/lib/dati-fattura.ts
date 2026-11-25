/**
 * Dati di fatturazione che il cliente deve completare (Mattia, 25/11/2026).
 * Un ordine manuale o un preventivo possono nascere con il solo nome del cliente: senza partita IVA o codice fiscale
 * e senza indirizzo la fattura elettronica viene scartata dallo SDI. Qui la regola unica su cosa serve, usata dalla
 * pagina del preventivo (alla conferma) e da quella della conferma d'ordine (prima di pagare).
 */
export type TipoCliente = 'azienda' | 'privato';
/** i campi come stanno in `orders.billing` */
export interface DatiFattura {
	company?: string | null; first_name?: string | null; last_name?: string | null;
	vat?: string | null; fiscal_code?: string | null; sdi?: string | null; pec?: string | null;
	street?: string | null; zip?: string | null; city?: string | null; province?: string | null; country?: string | null;
}
/** gli stessi campi dopo la lettura del modulo: tutti presenti, al piu' vuoti */
export type DatiFatturaCompleti = { [K in keyof DatiFattura]-?: string };
export type CampoMancante = 'nome' | 'fiscale' | 'indirizzo' | 'cap' | 'citta' | 'provincia';

const s = (v: unknown) => String(v ?? '').trim();
/** partita IVA italiana: solo le 11 cifre, senza IT davanti */
export const soloPiva = (v: unknown) => s(v).toUpperCase().replace(/^IT/, '').replace(/\D/g, '');
export const soloCf = (v: unknown) => s(v).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** partita IVA italiana: 11 cifre con la cifra di controllo giusta */
export function pivaValida(v: unknown): boolean {
	const p = soloPiva(v);
	if (!/^\d{11}$/.test(p) || p === '00000000000') return false;
	let somma = 0;
	for (let i = 0; i < 10; i++) { let n = +p[i]; if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } somma += n; }
	return (10 - (somma % 10)) % 10 === +p[10];
}
const DISPARI: Record<string, number> = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
/** codice fiscale: 16 caratteri con la lettera di controllo giusta, oppure le 11 cifre di un ente (stessa regola della partita IVA) */
export function cfValido(v: unknown): boolean {
	const c = soloCf(v);
	if (/^\d{11}$/.test(c)) return pivaValida(c);
	if (!/^[A-Z0-9]{15}[A-Z]$/.test(c)) return false;
	let somma = 0;
	for (let i = 0; i < 15; i++) {
		const ch = c[i];
		somma += i % 2 === 0 ? DISPARI[ch] : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 65;
	}
	return String.fromCharCode(65 + (somma % 26)) === c[15];
}

/** Cosa manca per poter fare la fattura. Italia: nome o ragione sociale, partita IVA oppure codice fiscale validi,
 *  via, CAP, comune e provincia. Estero: nome, via e citta' (niente codice fiscale italiano). Lista vuota = tutto a posto. */
export function datiFatturaMancanti(b: DatiFattura | null | undefined): CampoMancante[] {
	const d = b ?? {};
	const out: CampoMancante[] = [];
	const estero = (s(d.country) || 'IT').toUpperCase() !== 'IT';
	if (!s(d.company) && !(s(d.first_name) && s(d.last_name))) out.push('nome');
	if (!estero && !(s(d.vat) ? pivaValida(d.vat) : cfValido(d.fiscal_code))) out.push('fiscale');
	if (!s(d.street)) out.push('indirizzo');
	if (!estero && !/^\d{5}$/.test(s(d.zip))) out.push('cap');
	if (!s(d.city)) out.push('citta');
	if (!estero && !/^[A-Za-z]{2}$/.test(s(d.province))) out.push('provincia');
	return out;
}

/** I campi del modulo compilato dal cliente → dati puliti, con l'elenco di quello che ancora non va */
export function leggiDatiFattura(campo: (nome: string) => unknown): { dati: DatiFatturaCompleti; tipo: TipoCliente; mancanti: CampoMancante[] } {
	const tipo: TipoCliente = s(campo('tipo')) === 'privato' ? 'privato' : 'azienda';
	const country = (s(campo('country')) || 'IT').toUpperCase().slice(0, 2);
	const estero = country !== 'IT';
	const first_name = s(campo('first_name')), last_name = s(campo('last_name'));
	const dati: DatiFatturaCompleti = {
		company: tipo === 'azienda' ? s(campo('company')) : [first_name, last_name].filter(Boolean).join(' '),
		first_name, last_name,
		vat: tipo === 'azienda' ? (estero ? s(campo('vat')).toUpperCase().replace(/\s+/g, '') : soloPiva(campo('vat'))) : '',
		fiscal_code: estero ? '' : soloCf(campo('fiscal_code')),
		sdi: tipo === 'azienda' && !estero ? s(campo('sdi')).toUpperCase().slice(0, 7) : '',
		pec: tipo === 'azienda' && !estero ? s(campo('pec')).toLowerCase() : '',
		street: s(campo('street')), zip: s(campo('zip')), city: s(campo('city')),
		province: estero ? s(campo('province')).slice(0, 3) : s(campo('province')).toUpperCase().slice(0, 2), country
	};
	const mancanti = datiFatturaMancanti(dati);
	/* l'azienda italiana deve dare la partita IVA: il codice fiscale da solo non basta; il privato nome e cognome */
	if (tipo === 'azienda' && !estero && !pivaValida(dati.vat) && !mancanti.includes('fiscale')) mancanti.push('fiscale');
	if (tipo === 'azienda' && !s(campo('company')) && !mancanti.includes('nome')) mancanti.push('nome');
	if (tipo === 'privato' && !(first_name && last_name) && !mancanti.includes('nome')) mancanti.push('nome');
	/* se c'e' un codice fiscale scritto accanto alla partita IVA dev'essere giusto anche lui, altrimenti si toglie */
	if (dati.vat && dati.fiscal_code && !cfValido(dati.fiscal_code)) dati.fiscal_code = '';
	return { dati, tipo, mancanti };
}
