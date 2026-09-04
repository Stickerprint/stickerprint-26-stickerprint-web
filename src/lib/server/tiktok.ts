/**
 * TikTok Ads · Marketing API v1.3. Variabili: TIKTOK_ACCESS_TOKEN (app TikTok for Business autorizzata sull'account), TIKTOK_ADVERTISER_ID.
 * Legge campagne e risultati, cambia il budget delle campagne e le mette in pausa / le riattiva.
 */
import { env } from '$env/dynamic/private';

export interface TtCampagna { id: string; nome: string; stato: string; attiva: boolean; obiettivo: string; budget: number | null; budgetTipo: 'giornaliero' | 'totale' | 'illimitato'; spesa: number; impressioni: number; clic: number; conversioni: number; cpc: number | null; costoPerConversione: number | null }
export interface TtData { advertiser: string; periodo: { da: string; a: string }; kpi: { spesa: number; impressioni: number; clic: number; conversioni: number; cpc: number | null; ctr: number | null; costoPerConversione: number | null }; spesaMese: number; giorni: { giorno: string; spesa: number; clic: number; conversioni: number }[]; campagne: TtCampagna[]; aggiornato: string }
const BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const VARS = ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'];
export const tiktokMissing = () => VARS.filter((v) => !env[v]);
export const tiktokConfigured = () => tiktokMissing().length === 0;
const iso = (x: Date) => x.toISOString().slice(0, 10);

async function call<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, params: Record<string, unknown>): Promise<T> {
	const headers: Record<string, string> = { 'Access-Token': env.TIKTOK_ACCESS_TOKEN ?? '', 'Content-Type': 'application/json' };
	const url = method === 'GET' ? `${BASE}/${path}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])))}` : `${BASE}/${path}`;
	const r = await fetch(url, { method, headers, body: method === 'POST' ? JSON.stringify(params) : undefined });
	const j = await r.json();
	if (!r.ok || j.code !== 0) throw new Error(`TikTok Ads: ${j.message ?? r.status}`);
	return j.data as T;
}

let cache: { at: number; data: TtData } | null = null;
export async function getTiktok(days = 30): Promise<TtData> {
	if (cache && Date.now() - cache.at < 60_000) return cache.data;
	const adv = env.TIKTOK_ADVERTISER_ID ?? '';
	const a = new Date(); const da = new Date(); da.setDate(a.getDate() - days + 1);
	const mese = new Date(a.getFullYear(), a.getMonth(), 1);
	const metrics = ['spend', 'impressions', 'clicks', 'conversion', 'cpc', 'ctr', 'cost_per_conversion'];
	type Rep = { list?: { dimensions: Record<string, string>; metrics: Record<string, string> }[] };
	const [camp, perCamp, perGiorno, meseRep] = await Promise.all([
		call<{ list?: Record<string, unknown>[] }>('GET', 'campaign/get/', { advertiser_id: adv, page_size: 100 }),
		call<Rep>('GET', 'report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN', dimensions: ['campaign_id'], metrics, start_date: iso(da), end_date: iso(a), page_size: 200 }),
		call<Rep>('GET', 'report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_ADVERTISER', dimensions: ['stat_time_day'], metrics: ['spend', 'clicks', 'conversion'], start_date: iso(da), end_date: iso(a), page_size: 100 }),
		call<Rep>('GET', 'report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_ADVERTISER', dimensions: ['advertiser_id'], metrics: ['spend'], start_date: iso(mese), end_date: iso(a), page_size: 10 })
	]);
	const byCamp = new Map((perCamp.list ?? []).map((r) => [String(r.dimensions.campaign_id), r.metrics]));
	const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
	const campagne: TtCampagna[] = (camp.list ?? []).map((c) => {
		const m = byCamp.get(String(c.campaign_id)) ?? {};
		const mode = String(c.budget_mode ?? '');
		return { id: String(c.campaign_id), nome: String(c.campaign_name ?? ''), stato: String(c.operation_status ?? ''), attiva: c.operation_status === 'ENABLE', obiettivo: String(c.objective_type ?? ''), budget: c.budget != null ? num(c.budget) : null, budgetTipo: mode === 'BUDGET_MODE_DAY' ? 'giornaliero' : mode === 'BUDGET_MODE_TOTAL' ? 'totale' : 'illimitato', spesa: num(m.spend), impressioni: num(m.impressions), clic: num(m.clicks), conversioni: num(m.conversion), cpc: m.cpc != null ? num(m.cpc) : null, costoPerConversione: m.cost_per_conversion != null ? num(m.cost_per_conversion) : null };
	});
	const giorni = (perGiorno.list ?? []).map((r) => ({ giorno: String(r.dimensions.stat_time_day).slice(0, 10), spesa: num(r.metrics.spend), clic: num(r.metrics.clicks), conversioni: num(r.metrics.conversion) })).sort((x, y) => x.giorno.localeCompare(y.giorno));
	const spesa = campagne.reduce((s, c) => s + c.spesa, 0); const clic = campagne.reduce((s, c) => s + c.clic, 0); const imp = campagne.reduce((s, c) => s + c.impressioni, 0); const conv = campagne.reduce((s, c) => s + c.conversioni, 0);
	const data: TtData = { advertiser: adv, periodo: { da: iso(da), a: iso(a) }, kpi: { spesa, impressioni: imp, clic, conversioni: conv, cpc: clic ? spesa / clic : null, ctr: imp ? (clic / imp) * 100 : null, costoPerConversione: conv ? spesa / conv : null }, spesaMese: (meseRep.list ?? []).reduce((s, r) => s + num(r.metrics.spend), 0), giorni, campagne: campagne.sort((x, y) => y.spesa - x.spesa), aggiornato: new Date().toISOString() };
	cache = { at: Date.now(), data };
	return data;
}
/** Nuovo budget (giornaliero o totale, secondo la campagna) */
export async function setCampaignBudget(id: string, budget: number, mode: 'giornaliero' | 'totale'): Promise<void> {
	await call('POST', 'campaign/update/', { advertiser_id: env.TIKTOK_ADVERTISER_ID, campaign_id: id, budget_mode: mode === 'giornaliero' ? 'BUDGET_MODE_DAY' : 'BUDGET_MODE_TOTAL', budget });
	cache = null;
}
/** Pausa (DISABLE) o riattiva (ENABLE) */
export async function setCampaignStatus(id: string, on: boolean): Promise<void> {
	await call('POST', 'campaign/status/update/', { advertiser_id: env.TIKTOK_ADVERTISER_ID, campaign_ids: [id], operation_status: on ? 'ENABLE' : 'DISABLE' });
	cache = null;
}
