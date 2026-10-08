/**
 * Google Ads · API REST (GAQL).
 * Variabili: GOOGLE_ADS_DEVELOPER_TOKEN (dal Centro API dell'account amministratore), GOOGLE_ADS_CLIENT_ID e
 * GOOGLE_ADS_CLIENT_SECRET (app OAuth su Google Cloud), GOOGLE_ADS_REFRESH_TOKEN (consenso dato una volta con quell'app),
 * GOOGLE_ADS_CUSTOMER_ID (numero dell'account, senza trattini), GOOGLE_ADS_LOGIN_CUSTOMER_ID (facoltativa: l'account
 * amministratore che gestisce quello di Stickerprint), GOOGLE_ADS_API_VERSION (facoltativa, v25).
 * Legge campagne e risultati, cambia il budget giornaliero e mette in pausa / riattiva le campagne.
 */
import { env } from '$env/dynamic/private';
import type { Campagna, CanaleDati, Risultati } from '$lib/marketing/ads-tipi';
import { type Periodo, periodoPrima, giorniDi } from './periodo';

const VARS = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'];
export const googleAdsMissing = () => VARS.filter((v) => !env[v]);
export const googleAdsConfigured = () => googleAdsMissing().length === 0;
const V = () => env.GOOGLE_ADS_API_VERSION || 'v25';
const cid = () => (env.GOOGLE_ADS_CUSTOMER_ID ?? '').replace(/-/g, '');

let token: { value: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
	if (token && token.exp > Date.now()) return token.value;
	const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GOOGLE_ADS_CLIENT_ID ?? '', client_secret: env.GOOGLE_ADS_CLIENT_SECRET ?? '', refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN ?? '' }) });
	const j = await r.json();
	if (!r.ok || !j.access_token) throw new Error(`Google Ads: accesso rifiutato (${j.error_description ?? j.error ?? r.status})`);
	token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
	return token.value;
}
async function chiama<T>(path: string, body: unknown): Promise<T> {
	const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '', 'Content-Type': 'application/json' };
	if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
	const r = await fetch(`https://googleads.googleapis.com/${V()}/customers/${cid()}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
	const j = await r.json();
	if (!r.ok) {
		const e = Array.isArray(j) ? j[0]?.error : j.error;
		throw new Error(`Google Ads: ${e?.details?.[0]?.errors?.[0]?.message ?? e?.message ?? r.status}`);
	}
	return j as T;
}
type Riga = { campaign?: { resourceName: string; id: string; name: string; status: string; advertisingChannelType?: string }; campaignBudget?: { resourceName: string; amountMicros?: string; explicitlyShared?: boolean; totalAmountMicros?: string }; metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number }; segments?: { date?: string } };
async function query(q: string): Promise<Riga[]> {
	const chunks = await chiama<{ results?: Riga[] }[]>('googleAds:searchStream', { query: q });
	return chunks.flatMap((c) => c.results ?? []);
}
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const eur = (micros: unknown) => num(micros) / 1_000_000;
const ris = (m: Riga['metrics'] | undefined): Risultati => ({ spesa: eur(m?.costMicros), impressioni: num(m?.impressions), clic: num(m?.clicks), conversioni: num(m?.conversions), valore: m?.conversionsValue != null ? num(m.conversionsValue) : null });
const somma = (xs: Riga[]): Risultati => xs.reduce((s, r) => { const x = ris(r.metrics); return { spesa: s.spesa + x.spesa, impressioni: s.impressioni + x.impressioni, clic: s.clic + x.clic, conversioni: s.conversioni + x.conversioni, valore: (s.valore ?? 0) + (x.valore ?? 0) }; }, { spesa: 0, impressioni: 0, clic: 0, conversioni: 0, valore: 0 } as Risultati);
const tra = (p: Periodo) => `segments.date BETWEEN '${p.da}' AND '${p.a}'`;
const METRICHE = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value';

const budgetRes = new Map<string, { res: string; condiviso: boolean }>();
let cache = new Map<string, { at: number; data: CanaleDati }>();
export async function getGoogleAds(periodo: Periodo, opts: { prima?: boolean } = {}): Promise<CanaleDati> {
	const k = `${periodo.da}|${periodo.a}|${opts.prima ? 1 : 0}`;
	const c = cache.get(k);
	if (c && Date.now() - c.at < 60_000) return c.data;
	const prima = periodoPrima(periodo);
	const mese = { da: periodo.a.slice(0, 8) + '01', a: periodo.a };
	const [campagne, perCamp, perGiorno, primaR, meseR] = await Promise.all([
		query(`SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.total_amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.status != 'REMOVED'`),
		query(`SELECT campaign.id, ${METRICHE} FROM campaign WHERE ${tra(periodo)}`),
		query(`SELECT segments.date, ${METRICHE} FROM customer WHERE ${tra(periodo)}`),
		opts.prima === false ? Promise.resolve([] as Riga[]) : query(`SELECT ${METRICHE} FROM customer WHERE ${tra(prima)}`),
		query(`SELECT metrics.cost_micros FROM customer WHERE ${tra(mese)}`)
	]);
	const byCamp = new Map(perCamp.map((r) => [String(r.campaign?.id), r.metrics]));
	const lista: Campagna[] = campagne.map((r): Campagna => {
		const cmp = r.campaign!; const b = r.campaignBudget;
		if (b?.resourceName) budgetRes.set(cmp.id, { res: b.resourceName, condiviso: Boolean(b.explicitlyShared) });
		const giornaliero = b?.amountMicros && eur(b.amountMicros) > 0 ? eur(b.amountMicros) : null;
		return {
			canale: 'google', id: cmp.id, nome: cmp.name, statoOriginale: cmp.status,
			stato: cmp.status === 'ENABLED' ? 'attiva' : cmp.status === 'PAUSED' ? 'in_pausa' : 'altro',
			obiettivo: (cmp.advertisingChannelType ?? '').toLowerCase().replace(/_/g, ' '),
			budgetGiorno: giornaliero, budgetTotale: b?.totalAmountMicros ? eur(b.totalAmountMicros) : null, budgetModificabile: giornaliero != null && !b?.explicitlyShared,
			...ris(byCamp.get(cmp.id))
		};
	}).sort((x, y) => y.spesa - x.spesa);
	const giorniMap = new Map(perGiorno.map((r) => [String(r.segments?.date), r.metrics]));
	const data: CanaleDati = {
		canale: 'google', account: cid(), periodo, kpi: somma(perCamp),
		prima: opts.prima === false ? null : somma(primaR),
		spesaMese: somma(meseR).spesa,
		giorni: giorniDi(periodo).map((g) => { const r = ris(giorniMap.get(g)); return { giorno: g, spesa: r.spesa, clic: r.clic, conversioni: r.conversioni, valore: r.valore }; }),
		campagne: lista, aggiornato: new Date().toISOString()
	};
	cache.set(k, { at: Date.now(), data });
	return data;
}
export async function googleBudget(id: string, euroGiorno: number): Promise<void> {
	let b = budgetRes.get(id);
	if (!b) { const rows = await query(`SELECT campaign.id, campaign_budget.resource_name, campaign_budget.explicitly_shared FROM campaign WHERE campaign.id = ${Number(id)}`); const r = rows[0]?.campaignBudget; if (r?.resourceName) b = { res: r.resourceName, condiviso: Boolean(r.explicitlyShared) }; }
	if (!b) throw new Error('Google Ads: budget della campagna non trovato.');
	if (b.condiviso) throw new Error('Google Ads: questa campagna usa un budget condiviso, va cambiato da Google Ads.');
	await chiama('campaignBudgets:mutate', { operations: [{ update: { resourceName: b.res, amountMicros: String(Math.round(euroGiorno * 1_000_000)) }, updateMask: 'amount_micros' }] });
	cache = new Map();
}
export async function googleStato(id: string, on: boolean): Promise<void> {
	await chiama('campaigns:mutate', { operations: [{ update: { resourceName: `customers/${cid()}/campaigns/${id}`, status: on ? 'ENABLED' : 'PAUSED' }, updateMask: 'status' }] });
	cache = new Map();
}
