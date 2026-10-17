/**
 * Chi ha scritto: si cerca in anagrafica per email, poi per dominio (chi scrive da @metrica.it e' Metrica),
 * altrimenti si crea un contatto col nome in firma, segnato "da completare". Qui stanno anche le regole
 * di prezzo dei clienti che hanno accordi fissi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Estratto, Lavorazione } from './tipi';

/** domini di posta generici: non identificano un'azienda */
const GENERICI = new Set(['gmail.com', 'googlemail.com', 'hotmail.it', 'hotmail.com', 'outlook.it', 'outlook.com', 'live.it', 'live.com', 'yahoo.it', 'yahoo.com', 'libero.it', 'virgilio.it', 'alice.it', 'tin.it', 'tiscali.it', 'icloud.com', 'me.com', 'pec.it', 'legalmail.it', 'aruba.it', 'email.it', 'fastwebnet.it', 'msn.com', 'protonmail.com', 'proton.me']);
export const dominioDi = (email: string) => (email.split('@')[1] ?? '').toLowerCase().trim();
export const dominioGenerico = (email: string) => GENERICI.has(dominioDi(email));

export interface ContattoTrovato { id: string; name: string; email: string | null; vat: string | null; creato: boolean; come: 'email' | 'dominio' | 'nuovo' }

export async function trovaContatto(db: SupabaseClient, email: string): Promise<ContattoTrovato | null> {
	const e = email.toLowerCase().trim();
	const { data: perEmail } = await db.from('contacts').select('id, name, email, vat').ilike('email', e).limit(1).maybeSingle();
	if (perEmail) return { ...perEmail, creato: false, come: 'email' };
	const dom = dominioDi(e);
	if (dom && !GENERICI.has(dom)) {
		const { data: perDominio } = await db.from('contacts').select('id, name, email, vat').contains('domini', [dom]).limit(1).maybeSingle();
		if (perDominio) return { ...perDominio, creato: false, come: 'dominio' };
	}
	return null;
}

/** contatto nuovo col nome che si legge nella mail: Mattia lo completa dall'anagrafica */
export async function creaContatto(db: SupabaseClient, email: string, nomeMittente: string | null, est: Estratto): Promise<ContattoTrovato | null> {
	const e = email.toLowerCase().trim();
	const azienda = (est.cliente.azienda ?? '').trim();
	const persona = (est.cliente.nome ?? nomeMittente ?? '').trim();
	const name = azienda || persona || e;
	const dom = dominioDi(e);
	const row = { kind: azienda ? 'azienda' : 'privato', name, first_name: !azienda && persona ? persona.split(' ')[0] : null, last_name: !azienda && persona ? persona.split(' ').slice(1).join(' ') || null : null, email: e, phone: est.cliente.telefono ?? null, domini: dom && !GENERICI.has(dom) ? [dom] : [], notes: `Creato dall'assistente dalla posta: da completare (P.IVA, indirizzo, SDI).${azienda && persona ? ` Referente: ${persona}.` : ''}` };
	const { data } = await db.from('contacts').insert(row).select('id, name, email, vat').single();
	return data ? { ...data, creato: true, come: 'nuovo' } : null;
}

/* ------------------------------------------------------------------ regole di prezzo per cliente */

export interface RegolaPrezzo { prezzo: number; descrizione: string; codice: string; lavorazione: Lavorazione; motivo: string }
/** P.IVA → regola: Comaplast ha due articoli a prezzo fisso (Mattia, 17/10/2026) */
const COMAPLAST = '05545430968';
export const METRICA = '00584770242';

/** prezzo fisso per i clienti con accordo: null = si va di listino */
export function prezzoFisso(vat: string | null, riga: { descrizione: string; misura?: { w: number; h: number } | null; file: string | null }): RegolaPrezzo | null {
	if (vat !== COMAPLAST) return null;
	const t = `${riga.descrizione} ${riga.file ?? ''}`.toLowerCase();
	const tondaPiccola = /11[,.]?[79]|tond|bollin|logo/.test(t) && !/misura nuova|rettang|11\s?x\s?15/.test(t);
	const rettangolare = /misura nuova|rettang|11\s?x\s?15/.test(t) || (riga.misura ? riga.misura.w > riga.misura.h * 1.15 : false);
	if (rettangolare) return { prezzo: 0.11, descrizione: '11x15mm', codice: 'ADR', lavorazione: 'resinata', motivo: 'Comaplast: etichetta rettangolare "misura nuova" a 0,11 €' };
	if (tondaPiccola || riga.misura == null) return { prezzo: 0.06, descrizione: '11,9mm', codice: 'ADR', lavorazione: 'resinata', motivo: 'Comaplast: etichetta tonda piccola a 0,06 €' };
	return { prezzo: 0.06, descrizione: '11,9mm', codice: 'ADR', lavorazione: 'resinata', motivo: 'Comaplast: etichetta tonda piccola a 0,06 €' };
}

/** codice prodotto e lamina dalla lavorazione scritta nella mail */
export function codiceDaLavorazione(l: Lavorazione | null): { codice: string; lamination: string } {
	if (l === 'resinata') return { codice: 'ADR', lamination: 'nessuna' };
	if (l === 'plastificata') return { codice: 'EAT', lamination: 'lucida' };
	return { codice: 'EAT', lamination: 'nessuna' };
}
