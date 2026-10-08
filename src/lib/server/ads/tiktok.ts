/**
 * TikTok Ads · Marketing API v1.3.
 * Variabili: TIKTOK_ACCESS_TOKEN (app TikTok for Business autorizzata sull'account), TIKTOK_ADVERTISER_ID.
 * Legge campagne e risultati, cambia il budget delle campagne e le mette in pausa / le riattiva.
 */
import { env } from '$env/dynamic/private';
import type { Campagna, CanaleDati, Risultati } from '$lib/marketing/ads-tipi';
import { type Periodo, periodoPrima, giorniDi } from './periodo';

const BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const VARS = ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'];
export const tiktokMissing = () => VARS.filter((v) => !env[v]);
export const tiktokConfigured = () => tiktokMissing().length === 0;
const adv = () => env.TIKTOK_ADVERTISER_ID ?? '';

async function call<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, params: Record<string, unknown>): Promise<T> {
	const headers: Record<string, string> = { 'Access-Token': env.TIKTOK_ACCESS_TOKEN ?? '', 'Content-Type': 'application/json' };
	const url = method === 'GET' ? `${BASE}/${path}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])))}` : `${BASE}/${path}`;
	const r = await fetch(url, { method, headers, body: method === 'POST' ? JSON.stringify(params) : undefined });
	const j = await r.json();
	if (!r.ok || j.code !== 0) throw new Error(`TikTok Ads: ${j.message ?? r.status}`);
	return j.data as T;
}
type Rep = { list?: { dimensions: Record<string, string>; metrics: Record<string, string> }[] };
const METRICHE = ['spend', 'impressions', 'clicks', 'conversion', 'total_complete_payment'];
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const ris = (m: Record<string, string> | undefined): Risultati => ({ spesa: num(m?.spend), impressioni: num(m?.impressions), clic: num(m?.clicks), conversioni: num(m?.conversion), valore: m?.total_complete_payment != null && num(m.total_complete_payment) > 0 ? num(m.total_complete_payment) : null });
function report(level: string, dims: string[], p: Periodo, metrics = METRICHE) {
	return call<Rep>('GET', 'report/integrated/get/', { advertiser_id: adv(), report_type: 'BASIC', data_level: level, dimensions: dims, metrics, start_date: p.da, end_date: p.a, page_size: 500 }).then((r) => r.list ?? []);
}

let cache = new Map<string, { at: number; data: CanaleDati }>();
export async function getTiktok(periodo: Periodo, opts: { prima?: boolean } = {}): Promise<CanaleDati> {
	const k = `${periodo.da}|${periodo.a}|${opts.prima ? 1 : 0}`;
	const c = cache.get(k);
	if (c && Date.now() - c.at < 60_000) return c.data;
	const prima = periodoPrima(periodo);
	const mese = { da: periodo.a.slice(0, 8) + '01', a: periodo.a };
	const [camp, perCamp, perGiorno, primaR, meseR] = await Promise.all([
		call<{ list?: Record<string, unknown>[] }>('GET', 'campaign/get/', { advertiser_id: adv(), page_size: 100 }).then((r) => r.list ?? []),
		report('AUCTION_CAMPAIGN', ['campaign_id'], periodo),
		report('AUCTION_ADVERTISER', ['stat_time_day'], periodo),
		opts.prima === false ? Promise.resolve([]) : report('AUCTION_ADVERTISER', ['advertiser_id'], prima),
		report('AUCTION_ADVERTISER', ['advertiser_id'], mese, ['spend'])
	]);
	const byCamp = new Map(perCamp.map((r) => [String(r.dimensions.campaign_id), r.metrics]));
	const lista: Campagna[] = camp.filter((c) => c.operation_status !== 'DELETE').map((c): Campagna => {
		const mode = String(c.budget_mode ?? '');
		const budget = c.budget != null && num(c.budget) > 0 ? num(c.budget) : null;
		return {
			canale: 'tiktok', id: String(c.campaign_id), nome: String(c.campaign_name ?? ''), statoOriginale: String(c.operation_status ?? ''),
			stato: c.operation_status === 'ENABLE' ? 'attiva' : c.operation_status === 'DISABLE' ? 'in_pausa' : 'altro',
			obiettivo: String(c.objective_type ?? '').toLowerCase().replace(/_/g, ' '),
			budgetGiorno: mode === 'BUDGET_MODE_DAY' ? budget : null, budgetTotale: mode === 'BUDGET_MODE_TOTAL' ? budget : null, budgetModificabile: mode === 'BUDGET_MODE_DAY',
			...ris(byCamp.get(String(c.campaign_id)))
		};
	}).sort((x, y) => y.spesa - x.spesa);
	const kpi: Risultati = { spesa: 0, impressioni: 0, clic: 0, conversioni: 0, valore: null };
	for (const c of lista) { kpi.spesa += c.spesa; kpi.impressioni += c.impressioni; kpi.clic += c.clic; kpi.conversioni += c.conversioni; if (c.valore != null) kpi.valore = (kpi.valore ?? 0) + c.valore; }
	const giorniMap = new Map(perGiorno.map((r) => [String(r.dimensions.stat_time_day).slice(0, 10), r.metrics]));
	const data: CanaleDati = {
		canale: 'tiktok', account: adv(), periodo, kpi,
		prima: opts.prima === false ? null : ris(primaR[0]?.metrics),
		spesaMese: meseR.reduce((s, r) => s + num(r.metrics.spend), 0),
		giorni: giorniDi(periodo).map((g) => { const r = ris(giorniMap.get(g)); return { giorno: g, spesa: r.spesa, clic: r.clic, conversioni: r.conversioni, valore: r.valore }; }),
		campagne: lista, aggiornato: new Date().toISOString()
	};
	cache.set(k, { at: Date.now(), data });
	return data;
}
export async function tiktokBudget(id: string, euroGiorno: number): Promise<void> {
	await call('POST', 'campaign/update/', { advertiser_id: adv(), campaign_id: id, budget_mode: 'BUDGET_MODE_DAY', budget: euroGiorno });
	cache = new Map();
}
export async function tiktokStato(id: string, on: boolean): Promise<void> {
	await call('POST', 'campaign/status/update/', { advertiser_id: adv(), campaign_ids: [id], operation_status: on ? 'ENABLE' : 'DISABLE' });
	cache = new Map();
}
