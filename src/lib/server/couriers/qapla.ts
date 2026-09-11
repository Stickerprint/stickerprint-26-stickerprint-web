import { env } from '$env/dynamic/private';
import { PDFDocument } from 'pdf-lib';
import { b64ToBytes, type CourierAdapter, type ShipmentInput } from './types';

/**
 * Qapla' · piattaforma spedizioni (API 1.3, https://api.qapla.dev).
 * Un solo "corriere" in dashboard che in realta' li gestisce tutti: la spedizione si crea con
 * createLabel (etichetta PDF + tracking del corriere scelto), la giornata si chiude con
 * confirmLabel (borderò), gli stati arrivano dal webhook (api/qapla/webhook) e dalla
 * sincronizzazione oraria (api/qapla/sync). Le email al cliente le manda il nostro sito.
 *
 * Variabili: QAPLA_API_KEY (chiave privata del canale), QAPLA_COURIER (codice corriere Qapla',
 * default GLS-ITA), QAPLA_COURIER_SERVICE (codice servizio/contratto, default 0),
 * QAPLA_SANDBOX=1 per le prove senza costi, QAPLA_PUBLIC_KEY per la pagina di tracking pubblica.
 */
const API = 'https://api.qapla.it/1.3';
const VARS = ['QAPLA_API_KEY'];
const missing = VARS.filter((v) => !env[v]);
export const QAPLA_PUBLIC_KEY = () => env.QAPLA_PUBLIC_KEY || '51df4308';
export const trackingPageUrl = (trackingOrReference: string) => `https://tracking.qapla.it/${QAPLA_PUBLIC_KEY()}/${encodeURIComponent(trackingOrReference)}`;

type QRes<T> = { result: 'OK' | 'KO'; error: string | null } & T;
async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<QRes<T>> {
	const r = await fetch(`${API}/${endpoint}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: env.QAPLA_API_KEY, ...body }) });
	const j = (await r.json().catch(() => ({}))) as Record<string, QRes<T>>;
	const out = j[endpoint] ?? (Object.values(j)[0] as QRes<T> | undefined);
	if (!r.ok || !out) throw new Error(`Qapla ${endpoint}: HTTP ${r.status}`);
	if (out.result !== 'OK') throw new Error(`Qapla ${endpoint}: ${typeof out.error === 'string' ? out.error : JSON.stringify(out.error)}`);
	return out;
}
export async function qaplaGet<T>(endpoint: string, params: Record<string, string>, version = '1.3'): Promise<QRes<T>> {
	const q = new URLSearchParams({ apiKey: env.QAPLA_API_KEY ?? '', ...params });
	const r = await fetch(`https://api.qapla.it/${version}/${endpoint}/?${q}`);
	const j = (await r.json().catch(() => ({}))) as Record<string, QRes<T>>;
	const out = j[endpoint] ?? (Object.values(j)[0] as QRes<T> | undefined);
	if (!r.ok || !out) throw new Error(`Qapla ${endpoint}: HTTP ${r.status}`);
	if (out.result !== 'OK') throw new Error(`Qapla ${endpoint}: ${out.error}`);
	return out;
}

async function mergePdfs(b64s: string[]): Promise<Uint8Array | null> {
	const pages = b64s.filter(Boolean);
	if (!pages.length) return null;
	if (pages.length === 1) return b64ToBytes(pages[0]);
	const out = await PDFDocument.create();
	for (const b of pages) { const src = await PDFDocument.load(b64ToBytes(b)); const ps = await out.copyPages(src, src.getPageIndices()); ps.forEach((p) => out.addPage(p)); }
	return out.save();
}

export const qapla: CourierAdapter = {
	id: 'Qapla', configured: missing.length === 0, missing,
	async createShipment(s: ShipmentInput) {
		const r = s.recipient;
		const courier = env.QAPLA_COURIER || 'GLS-ITA';
		const perParcel = Math.max(0.1, Math.round((s.weightKg / Math.max(1, s.parcels)) * 100) / 100);
		const body = {
			sandbox: env.QAPLA_SANDBOX === '1',
			createLabel: {
				origin: 'public', reference: s.orderNumber, courier, courierService: env.QAPLA_COURIER_SERVICE || '0',
				name: r.name.slice(0, 60), address: r.street.slice(0, 60), city: r.city, state: r.province, postCode: r.zip, country: r.country || 'IT',
				email: r.email ?? '', telephone: r.phone ?? '', isCOD: false, currencyCode: 'EUR', notes: (s.notes ?? '').slice(0, 255),
				content: s.contents.slice(0, 100), custom1: s.group,
				parcels: Array.from({ length: Math.max(1, s.parcels) }, () => ({ weight: perParcel, length: 30, width: 20, height: 10 }))
			}
		};
		try {
			const res = await post<{ id: number; trackingNumber: string; format: string; labels: string[]; courier: string; isShipped: boolean }>('createLabel', body);
			const labelPdf = res.format === 'PDF' ? await mergePdfs(res.labels ?? []) : null;
			return { tracking: res.trackingNumber, labelPdf, labelId: res.id, trackingUrl: trackingPageUrl(res.trackingNumber), raw: { id: res.id, courier: res.courier, format: res.format, isShipped: res.isShipped } };
		} catch (e) {
			/* createLabel non abilitato sulla chiave (serve il Customer Care Qapla'): l'ordine va comunque a Qapla'
			   (sezione "Crea"), l'etichetta si stampa dal pannello Qapla' e il tracking torna qui dal webhook
			   "generazione spedizioni" (o dalla sincronizzazione con getOrder) */
			if (!/not allowed/i.test(e instanceof Error ? e.message : '')) throw e;
			const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
			const o = body.createLabel as Record<string, unknown>;
			await post('pushOrder', { origin: 'public', pushOrder: [{ reference: o.reference, courier, courierService: o.courierService, status: 'processing', createdAt: now, updatedAt: now, name: o.name, street: o.address, city: o.city, state: o.state, postCode: o.postCode, country: o.country, email: o.email, telephone: o.telephone, currencyCode: 'EUR', notes: `${s.contents}${s.notes ? ' · ' + s.notes : ''}`.slice(0, 255), custom1: s.group }] });
			return { tracking: '', labelPdf: null, pending: 'Ordine inviato a Qapla: stampa l\'etichetta dal pannello Qapla (Etichette → Crea). Tracking e stato arriveranno qui da soli.' };
		}
	},
	async closeDay() {
		/* conferma e trasmette al corriere tutte le etichette create oggi (servizio da attivare con il Customer Care Qapla) */
		const courier = env.QAPLA_COURIER || 'GLS-ITA';
		const res = await post<{ number: string; manifest: string | null; shipments: number }>('confirmLabel', { confirmLabel: { courier, labelCreationDate: new Date().toISOString().slice(0, 10) } });
		return { manifestPdf: res.manifest ? b64ToBytes(res.manifest) : null, raw: { number: res.number, shipments: res.shipments } };
	}
};
