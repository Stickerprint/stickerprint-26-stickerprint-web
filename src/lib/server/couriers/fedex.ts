import { env } from '$env/dynamic/private';
import { COMPANY } from '../company';
import { b64ToBytes, type CourierAdapter, type ShipmentInput } from './types';

/**
 * FedEx · REST API (developer.fedex.com): OAuth client_credentials + Ship API.
 * Variabili: FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, FEDEX_ACCOUNT_NUMBER; opzionali FEDEX_SANDBOX=1, FEDEX_SERVICE (default FEDEX_REGIONAL_ECONOMY per l'Italia), FEDEX_PHONE.
 * L'etichetta 4×6 in PDF arriva nella risposta; per i servizi Express non serve chiusura giornaliera (il manifest interno viene generato comunque).
 */
const VARS = ['FEDEX_CLIENT_ID', 'FEDEX_CLIENT_SECRET', 'FEDEX_ACCOUNT_NUMBER'];
const missing = VARS.filter((v) => !env[v]);
const BASE = env.FEDEX_SANDBOX === '1' ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com';
let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
	if (token && token.exp > Date.now()) return token.value;
	const r = await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=client_credentials&client_id=${encodeURIComponent(env.FEDEX_CLIENT_ID ?? '')}&client_secret=${encodeURIComponent(env.FEDEX_CLIENT_SECRET ?? '')}` });
	const j = await r.json();
	if (!r.ok || !j.access_token) throw new Error(`FedEx OAuth: ${j.errors?.[0]?.message ?? r.status}`);
	token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
	return token.value;
}

export const fedex: CourierAdapter = {
	id: 'FedEx', configured: missing.length === 0, missing,
	async createShipment(s: ShipmentInput) {
		const t = await getToken();
		const r = s.recipient;
		const body = {
			labelResponseOptions: 'LABEL',
			accountNumber: { value: env.FEDEX_ACCOUNT_NUMBER },
			requestedShipment: {
				shipper: { contact: { personName: COMPANY.name, companyName: COMPANY.name, phoneNumber: env.FEDEX_PHONE || COMPANY.phone || '0000000000' }, address: { streetLines: [COMPANY.street], city: COMPANY.city, stateOrProvinceCode: COMPANY.province, postalCode: COMPANY.zip, countryCode: COMPANY.country } },
				recipients: [{ contact: { personName: r.contact || r.name, companyName: r.name, phoneNumber: r.phone || env.FEDEX_PHONE || '0000000000', emailAddress: r.email || undefined }, address: { streetLines: [r.street], city: r.city, stateOrProvinceCode: r.province || undefined, postalCode: r.zip, countryCode: r.country || 'IT' } }],
				shipDatestamp: new Date().toISOString().slice(0, 10),
				serviceType: env.FEDEX_SERVICE || 'FEDEX_REGIONAL_ECONOMY',
				packagingType: 'YOUR_PACKAGING',
				pickupType: 'USE_SCHEDULED_PICKUP',
				shippingChargesPayment: { paymentType: 'SENDER' },
				labelSpecification: { imageType: 'PDF', labelStockType: 'STOCK_4X6' },
				customerReferences: [{ customerReferenceType: 'CUSTOMER_REFERENCE', value: s.orderNumber }],
				requestedPackageLineItems: Array.from({ length: s.parcels }, () => ({ weight: { units: 'KG', value: Math.max(0.1, Math.round((s.weightKg / s.parcels) * 10) / 10) } }))
			}
		};
		const res = await fetch(`${BASE}/ship/v1/shipments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, 'x-locale': 'it_IT' }, body: JSON.stringify(body) });
		const j = await res.json();
		if (!res.ok) throw new Error(`FedEx: ${j.errors?.map((e: { message: string }) => e.message).join('; ') ?? res.status}`);
		const ts = j.output?.transactionShipments?.[0];
		const tracking: string = ts?.masterTrackingNumber ?? ts?.pieceResponses?.[0]?.trackingNumber ?? '';
		if (!tracking) throw new Error('FedEx: nessun numero di tracking nella risposta');
		// più colli: un PDF per collo; qui prendiamo il primo, gli altri si scaricano dal manifest interno
		const label: string | undefined = ts?.pieceResponses?.[0]?.packageDocuments?.[0]?.encodedLabel;
		return { tracking, labelPdf: label ? b64ToBytes(label) : null, raw: j };
	},
	async closeDay() { return { manifestPdf: null }; }
};
