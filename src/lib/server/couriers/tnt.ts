import { env } from '$env/dynamic/private';
import { COMPANY } from '../company';
import { xmlEsc, xmlTag, type CourierAdapter, type ShipmentInput } from './types';

/**
 * TNT Italia · ExpressConnect Shipping (XML). Variabili: TNT_COMPANY (user), TNT_PASSWORD, TNT_ACCOUNT (codice cliente), opzionale TNT_APPID (default EC).
 * Flusso: CREATE + BOOK + SHIP in un'unica chiamata, poi GET_RESULT per il numero di consignment. Le etichette TNT arrivano come XML da impaginare:
 * finché non si attiva il template ufficiale usiamo le nostre etichette 10×15; il manifest ufficiale si richiede con GET_MANIFEST.
 */
const VARS = ['TNT_COMPANY', 'TNT_PASSWORD', 'TNT_ACCOUNT'];
const missing = VARS.filter((v) => !env[v]);
const URL = env.TNT_ENDPOINT || 'https://express.tnt.com/expressconnect/shipping/ship';
const post = async (xml: string) => { const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `xml_in=${encodeURIComponent(xml)}` }); return r.text(); };

export const tnt: CourierAdapter = {
	id: 'TNT', configured: missing.length === 0, missing,
	async createShipment(s: ShipmentInput) {
		const r = s.recipient;
		const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
		const xml = `<?xml version="1.0" encoding="UTF-8"?><ESHIPPER><LOGIN><COMPANY>${xmlEsc(env.TNT_COMPANY)}</COMPANY><PASSWORD>${xmlEsc(env.TNT_PASSWORD)}</PASSWORD><APPID>${xmlEsc(env.TNT_APPID || 'EC')}</APPID><APPVERSION>3.1</APPVERSION></LOGIN><CONSIGNMENTBATCH><SENDER><COMPANYNAME>${xmlEsc(COMPANY.name)}</COMPANYNAME><STREETADDRESS1>${xmlEsc(COMPANY.street)}</STREETADDRESS1><CITY>${xmlEsc(COMPANY.city)}</CITY><PROVINCE>${COMPANY.province}</PROVINCE><POSTCODE>${COMPANY.zip}</POSTCODE><COUNTRY>${COMPANY.country}</COUNTRY><ACCOUNT>${xmlEsc(env.TNT_ACCOUNT)}</ACCOUNT><CONTACTNAME>${xmlEsc(COMPANY.name)}</CONTACTNAME><CONTACTDIALCODE>39</CONTACTDIALCODE><CONTACTTELEPHONE>${xmlEsc(COMPANY.phone || '0000000000')}</CONTACTTELEPHONE><CONTACTEMAIL>${xmlEsc(COMPANY.email)}</CONTACTEMAIL><COLLECTION><SHIPDATE>${today}</SHIPDATE></COLLECTION></SENDER><CONSIGNMENT><CONREF>${xmlEsc(s.orderNumber)}</CONREF><DETAILS><RECEIVER><COMPANYNAME>${xmlEsc(r.name)}</COMPANYNAME><STREETADDRESS1>${xmlEsc(r.street)}</STREETADDRESS1><CITY>${xmlEsc(r.city)}</CITY><PROVINCE>${xmlEsc(r.province)}</PROVINCE><POSTCODE>${xmlEsc(r.zip)}</POSTCODE><COUNTRY>${xmlEsc(r.country || 'IT')}</COUNTRY><CONTACTNAME>${xmlEsc(r.contact || r.name)}</CONTACTNAME><CONTACTDIALCODE>39</CONTACTDIALCODE><CONTACTTELEPHONE>${xmlEsc(r.phone || '0000000000')}</CONTACTTELEPHONE><CONTACTEMAIL>${xmlEsc(r.email)}</CONTACTEMAIL></RECEIVER><CUSTOMERREF>${xmlEsc(s.reference)}</CUSTOMERREF><CONTYPE>N</CONTYPE><PAYMENTIND>S</PAYMENTIND><ITEMS>${s.parcels}</ITEMS><TOTALWEIGHT>${s.weightKg.toFixed(2)}</TOTALWEIGHT><TOTALVOLUME>0.01</TOTALVOLUME><SERVICE>${xmlEsc(env.TNT_SERVICE || '48N')}</SERVICE><DESCRIPTION>${xmlEsc(s.contents.slice(0, 60))}</DESCRIPTION><PACKAGE><ITEMS>${s.parcels}</ITEMS><DESCRIPTION>${xmlEsc(s.contents.slice(0, 60))}</DESCRIPTION><LENGTH>0.3</LENGTH><HEIGHT>0.2</HEIGHT><WIDTH>0.3</WIDTH><WEIGHT>${s.weightKg.toFixed(2)}</WEIGHT></PACKAGE></DETAILS></CONSIGNMENT></CONSIGNMENTBATCH><ACTIVITY><CREATE><CONREF>${xmlEsc(s.orderNumber)}</CONREF></CREATE><BOOK ShowBookingRef="Y"><CONREF>${xmlEsc(s.orderNumber)}</CONREF></BOOK><SHIP><CONREF>${xmlEsc(s.orderNumber)}</CONREF></SHIP></ACTIVITY></ESHIPPER>`;
		const first = await post(xml);
		const access = first.startsWith('COMPLETE:') ? first.slice(9).trim() : xmlTag(first, 'ACCESSCODE');
		if (!access) throw new Error(`TNT: ${first.slice(0, 200)}`);
		const result = await post(`GET_RESULT:${access}`);
		const tracking = xmlTag(result, 'CONNUMBER');
		if (!tracking) throw new Error(`TNT: consignment non creato · ${xmlTag(result, 'ERROR') || result.slice(0, 200)}`);
		return { tracking, labelPdf: null, raw: result.slice(0, 2000) };
	},
	async closeDay() { return { manifestPdf: null }; }
};
