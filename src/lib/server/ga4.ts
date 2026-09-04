/**
 * Google Analytics 4 · Data API con account di servizio.
 * Variabili: GA4_PROPERTY_ID (numero della proprietà), GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (chiave PEM del service account, con \n).
 * L'account di servizio va aggiunto come "Lettore" nella proprietà GA4 (Amministrazione → Gestione accessi alla proprietà).
 */
import { env } from '$env/dynamic/private';

export interface Ga4Data {
	property: string; periodo: { da: string; a: string };
	kpi: { sessioni: number; utenti: number; nuoviUtenti: number; pagine: number; conversioni: number; ricavi: number; durata: number; engagement: number };
	prima: { sessioni: number; utenti: number; conversioni: number; ricavi: number };
	attivi: number | null;
	giorni: { giorno: string; sessioni: number; utenti: number }[];
	canali: { nome: string; sessioni: number; conversioni: number }[];
	pagine: { path: string; viste: number }[];
	dispositivi: { nome: string; sessioni: number }[];
	sorgenti: { nome: string; sessioni: number }[];
	aggiornato: string;
}
const VARS = ['GA4_PROPERTY_ID', 'GOOGLE_SA_EMAIL', 'GOOGLE_SA_PRIVATE_KEY'];
export const ga4Missing = () => VARS.filter((v) => !env[v]);
export const ga4Configured = () => ga4Missing().length === 0;

let token: { value: string; exp: number } | null = null;
const b64u = (s: string | Uint8Array) => { const bin = typeof s === 'string' ? unescape(encodeURIComponent(s)) : String.fromCharCode(...s); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function importKey(): Promise<CryptoKey> {
	const pem = (env.GOOGLE_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').replace(/^"|"$/g, '');
	const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
	const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
async function accessToken(): Promise<string> {
	if (token && token.exp > Date.now()) return token.value;
	const now = Math.floor(Date.now() / 1000);
	const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = b64u(JSON.stringify({ iss: env.GOOGLE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
	const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importKey(), new TextEncoder().encode(`${header}.${claims}`)));
	const jwt = `${header}.${claims}.${b64u(sig)}`;
	const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}` });
	const j = await r.json();
	if (!r.ok || !j.access_token) throw new Error(`Google OAuth: ${j.error_description ?? j.error ?? r.status}`);
	token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
	return token.value;
}
type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
async function report(kind: 'runReport' | 'runRealtimeReport', body: Record<string, unknown>): Promise<Row[]> {
	const t = await accessToken();
	const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	const j = await r.json();
	if (!r.ok) throw new Error(`GA4: ${j.error?.message ?? r.status}`);
	return (j.rows ?? []) as Row[];
}
const n = (row: Row, i: number) => Number(row.metricValues?.[i]?.value ?? 0);
const d = (row: Row, i = 0) => row.dimensionValues?.[i]?.value ?? '';
const iso = (x: Date) => x.toISOString().slice(0, 10);

let cache: { at: number; data: Ga4Data } | null = null;
export async function getGa4(days = 30): Promise<Ga4Data> {
	if (cache && Date.now() - cache.at < 60_000) return cache.data;
	const a = new Date(); const da = new Date(); da.setDate(a.getDate() - days + 1);
	const primaA = new Date(da); primaA.setDate(da.getDate() - 1); const primaDa = new Date(primaA); primaDa.setDate(primaA.getDate() - days + 1);
	const metrics = ['sessions', 'totalUsers', 'newUsers', 'screenPageViews', 'conversions', 'purchaseRevenue', 'averageSessionDuration', 'engagementRate'].map((name) => ({ name }));
	const [tot, giorni, canali, pagine, disp, sorg, live] = await Promise.all([
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }, { startDate: iso(primaDa), endDate: iso(primaA) }], metrics, dimensions: [{ name: 'dateRange' }] }),
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensions: [{ name: 'date' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }], metrics: [{ name: 'screenPageViews' }], dimensions: [{ name: 'pagePath' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 }),
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }], metrics: [{ name: 'sessions' }], dimensions: [{ name: 'deviceCategory' }] }),
		report('runReport', { dateRanges: [{ startDate: iso(da), endDate: iso(a) }], metrics: [{ name: 'sessions' }], dimensions: [{ name: 'sessionSource' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
		report('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }).catch(() => null)
	]);
	const cur = tot.find((r) => d(r) === 'date_range_0') ?? tot[0]; const prev = tot.find((r) => d(r) === 'date_range_1');
	const data: Ga4Data = {
		property: env.GA4_PROPERTY_ID ?? '', periodo: { da: iso(da), a: iso(a) },
		kpi: cur ? { sessioni: n(cur, 0), utenti: n(cur, 1), nuoviUtenti: n(cur, 2), pagine: n(cur, 3), conversioni: n(cur, 4), ricavi: n(cur, 5), durata: n(cur, 6), engagement: n(cur, 7) } : { sessioni: 0, utenti: 0, nuoviUtenti: 0, pagine: 0, conversioni: 0, ricavi: 0, durata: 0, engagement: 0 },
		prima: prev ? { sessioni: n(prev, 0), utenti: n(prev, 1), conversioni: n(prev, 4), ricavi: n(prev, 5) } : { sessioni: 0, utenti: 0, conversioni: 0, ricavi: 0 },
		attivi: live ? live.reduce((s, r) => s + n(r, 0), 0) : null,
		giorni: giorni.map((r) => ({ giorno: d(r), sessioni: n(r, 0), utenti: n(r, 1) })),
		canali: canali.map((r) => ({ nome: d(r), sessioni: n(r, 0), conversioni: n(r, 1) })),
		pagine: pagine.map((r) => ({ path: d(r), viste: n(r, 0) })),
		dispositivi: disp.map((r) => ({ nome: d(r), sessioni: n(r, 0) })),
		sorgenti: sorg.map((r) => ({ nome: d(r), sessioni: n(r, 0) })),
		aggiornato: new Date().toISOString()
	};
	cache = { at: Date.now(), data };
	return data;
}
