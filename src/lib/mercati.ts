/**
 * Mercati: paese → zona (Italia, Unione Europea, Stati Uniti), valuta, IVA e spedizione per zona.
 * Il motore prezzi calcola in euro IVA inclusa; fuori dall'UE (USA) l'IVA non si applica: il prezzo in dollari
 * parte dal netto. Le tariffe di spedizione estere sono SEGNAPOSTO finche' Mattia non manda il listino.
 */
import { LOCALES, activeLocales, type Currency, type LocaleCode } from './i18n';

export type Zona = 'it' | 'ue' | 'us';
export const IVA = 0.22;

/** paesi dell'Unione Europea (codici ISO) oltre all'Italia */
export const PAESI_UE = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
export const NOME_PAESE: Record<string, string> = { IT: 'Italia', ES: 'España', FR: 'France', DE: 'Deutschland', NL: 'Nederland', BE: 'Belgique / België', AT: 'Österreich', LU: 'Luxembourg', PT: 'Portugal', IE: 'Ireland', US: 'United States', MC: 'Monaco', DK: 'Danmark', SE: 'Sverige', FI: 'Suomi', PL: 'Polska', CZ: 'Česko', GR: 'Ελλάδα', HU: 'Magyarország', RO: 'România', SK: 'Slovensko', SI: 'Slovenija', HR: 'Hrvatska', BG: 'България', EE: 'Eesti', LV: 'Latvija', LT: 'Lietuva', CY: 'Cyprus', MT: 'Malta' };

export function zonaDi(country: string | null | undefined): Zona {
	const c = (country ?? 'IT').toUpperCase();
	if (c === 'IT' || c === 'SM' || c === 'VA') return 'it';
	if (c === 'US') return 'us';
	return PAESI_UE.includes(c) ? 'ue' : 'ue';
}
/** paesi fra cui scegliere al checkout, in base alla lingua (il primo e' quello proposto).
 *  Finche' online c'e' solo l'italiano (PUBLIC_LOCALES non impostata) il sito italiano spedisce solo in Italia, come oggi. */
export function paesiPer(code: LocaleCode): string[] {
	const primo = LOCALES[code].countries[0];
	if (code === 'us') return ['US'];
	if (code === 'it' && activeLocales().length === 1) return ['IT'];
	const ue = ['IT', 'ES', 'FR', 'DE', 'NL', 'BE', 'AT', 'LU', 'PT', 'IE', ...PAESI_UE.filter((p) => !['ES', 'FR', 'DE', 'NL', 'BE', 'AT', 'LU', 'PT', 'IE'].includes(p))];
	/* /en (inglese per tutta l'Europa) non ha un paese suo: la lista UE com'e', il checkout propone quello dell'IP */
	return primo ? [primo, ...ue.filter((p) => p !== primo)] : ue;
}
export const valutaDi = (zona: Zona): Currency => (zona === 'us' ? 'USD' : 'EUR');
/** IVA applicata: Italia e UE (consumatori) 22% italiana finche' non c'e' l'OSS; USA niente */
export const ivaDi = (zona: Zona) => (zona === 'us' ? 0 : IVA);

/**
 * Spedizione per zona: Italia e UE in EURO IVA inclusa, USA in DOLLARI (senza IVA).
 * Tariffe estere dal listino FedEx del 22/10/2026 (proposta 17005681, servizio International Connect Plus, nette fino a 5 kg,
 * copia in ~/Desktop/CLAUDE/spedizioni e tabella in docs/spedizioni-estero.md):
 *   zona R 7,50 € (AT DE FR SI) · S 7,63 € (BE ES LU NL PT) · T 9,18 € (BG CZ HU PL RO SK) · U 10,99 € (DK EE FI GR HR IE LT LV SE) · V 19,98 € (CY MT)
 *   USA zona H 15,79 € a 0,5 kg, 20,13 € a 2 kg · Puerto Rico zona D 23,26 €.
 * Le nette NON comprendono il supplemento carburante (circa un quarto in piu') ne' dogana: al cliente si chiede una cifra tonda
 * che copre netto + carburante. Chi raggiunge la soglia (69 € UE, 99 $ USA) non paga niente: sopra c'e' margine per assorbirla.
 */
export const SPEDIZIONE: Record<Zona, { valuta: Currency; gratisDa: number; costo: number; costoRemoto: number; nota: string }> = {
	it: { valuta: 'EUR', gratisDa: 50, costo: 10, costoRemoto: 15, nota: 'isole e zone remote 15 €' },
	ue: { valuta: 'EUR', gratisDa: 69, costo: 11.9, costoRemoto: 24.9, nota: 'FedEx Connect Plus: 11,90 € zone R/S, 14,90 € zone T/U, 24,90 € Cipro e Malta' },
	us: { valuta: 'USD', gratisDa: 99, costo: 24.9, costoRemoto: 34.9, nota: 'FedEx Connect Plus zona H; Puerto Rico 34,90 $' }
};
/** tariffa UE al cliente (euro IVA inclusa) per paese: fascia FedEx R/S → 11,90, T/U → 14,90, V (isole) → 24,90; un paese non in lista paga la fascia media */
export const TARIFFA_UE: Record<string, number> = {
	AT: 11.9, DE: 11.9, FR: 11.9, SI: 11.9, MC: 11.9,
	BE: 11.9, ES: 11.9, LU: 11.9, NL: 11.9, PT: 11.9,
	BG: 14.9, CZ: 14.9, HU: 14.9, PL: 14.9, RO: 14.9, SK: 14.9,
	DK: 14.9, EE: 14.9, FI: 14.9, GR: 14.9, HR: 14.9, IE: 14.9, LT: 14.9, LV: 14.9, SE: 14.9,
	CY: 24.9, MT: 24.9
};
export const costoSpedizioneUE = (country: string | null | undefined) => TARIFFA_UE[(country ?? '').toUpperCase()] ?? 14.9;
/** stati USA (sigla → nome), per l'indirizzo */
export const STATI_USA: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };
/** controllo del CAP per paese (formati principali) */
export function capValido(zip: string, country: string): boolean {
	const z = zip.trim();
	switch ((country ?? '').toUpperCase()) {
		case 'IT': return /^\d{5}$/.test(z);
		case 'ES': return /^\d{5}$/.test(z);
		case 'FR': return /^\d{5}$/.test(z);
		case 'DE': return /^\d{5}$/.test(z);
		case 'NL': return /^\d{4}\s?[A-Za-z]{2}$/.test(z);
		case 'BE': case 'AT': case 'LU': case 'DK': case 'CH': return /^\d{4}$/.test(z);
		case 'PT': return /^\d{4}(-\d{3})?$/.test(z);
		case 'US': return /^\d{5}(-\d{4})?$/.test(z);
		case 'IE': return /^[A-Za-z0-9 ]{3,8}$/.test(z);
		default: return z.length >= 3;
	}
}
