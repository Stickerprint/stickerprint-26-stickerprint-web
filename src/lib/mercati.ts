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
	return [primo, ...ue.filter((p) => p !== primo)];
}
export const valutaDi = (zona: Zona): Currency => (zona === 'us' ? 'USD' : 'EUR');
/** IVA applicata: Italia e UE (consumatori) 22% italiana finche' non c'e' l'OSS; USA niente */
export const ivaDi = (zona: Zona) => (zona === 'us' ? 0 : IVA);

/** spedizione per zona: Italia e UE in EURO IVA inclusa, USA in DOLLARI (senza IVA). SEGNAPOSTO per UE e USA finche' Mattia non manda le tariffe. */
export const SPEDIZIONE: Record<Zona, { valuta: Currency; gratisDa: number; costo: number; costoRemoto: number; nota: string }> = {
	it: { valuta: 'EUR', gratisDa: 50, costo: 10, costoRemoto: 15, nota: 'isole e zone remote 15 €' },
	ue: { valuta: 'EUR', gratisDa: 69, costo: 14.9, costoRemoto: 14.9, nota: 'tariffa provvisoria' },
	us: { valuta: 'USD', gratisDa: 99, costo: 19.9, costoRemoto: 19.9, nota: 'tariffa provvisoria' }
};
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
