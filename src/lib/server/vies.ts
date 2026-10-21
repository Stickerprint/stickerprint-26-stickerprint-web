/**
 * VIES: controllo della partita IVA intracomunitaria (servizio della Commissione Europea).
 * Serve al checkout per le aziende UE: partita IVA valida → vendita intracomunitaria senza IVA (natura N3.2,
 * art. 41 DL 331/93; Stickerprint e' iscritta al VIES). Se il servizio non risponde si applica l'IVA: mai
 * fatturare senza IVA sulla parola del cliente.
 */
const ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export interface EsitoVies { valido: boolean; verificato: boolean; nome?: string | null; errore?: string }

/** separa il prefixo paese dal numero ("DE123456789", "de 123", "123" + paese del modulo) */
export function normalizzaPiva(piva: string, country: string): { paese: string; numero: string } {
	const pulita = piva.replace(/[\s.-]/g, '').toUpperCase();
	const m = pulita.match(/^([A-Z]{2})(.+)$/);
	const paese = (m ? m[1] : country.toUpperCase()).replace('GR', 'EL');
	return { paese, numero: m ? m[2] : pulita };
}

export async function verificaVies(piva: string, country: string, timeoutMs = 6000): Promise<EsitoVies> {
	const { paese, numero } = normalizzaPiva(piva, country);
	if (!numero || numero.length < 4) return { valido: false, verificato: true, errore: 'partita IVA troppo corta' };
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ countryCode: paese, vatNumber: numero }), signal: ctrl.signal });
		if (!r.ok) return { valido: false, verificato: false, errore: `VIES ${r.status}` };
		const d = (await r.json()) as { valid?: boolean; name?: string; userError?: string };
		if (d.userError && d.userError !== 'VALID' && d.userError !== 'INVALID') return { valido: false, verificato: false, errore: d.userError };
		return { valido: !!d.valid, verificato: true, nome: d.name && d.name !== '---' ? d.name : null };
	} catch (e) {
		return { valido: false, verificato: false, errore: e instanceof Error ? e.message : String(e) };
	} finally {
		clearTimeout(timer);
	}
}
