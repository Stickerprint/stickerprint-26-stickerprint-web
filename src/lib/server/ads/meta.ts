/**
 * Meta Ads (Instagram e Facebook) · Marketing API.
 * Variabili: META_ADS_ACCESS_TOKEN (token di un utente di sistema del Business Manager con ads_read e ads_management),
 *            META_ADS_ACCOUNT_ID (l'ID dell'account pubblicitario, con o senza "act_"), META_API_VERSION (facoltativa, v25.0).
 * Legge campagne e risultati divisi per piattaforma, cambia il budget giornaliero delle campagne CBO e le mette in pausa.
 */
import { env } from '$env/dynamic/private';
import type { Campagna, CanaleDati, Risultati } from '$lib/marketing/ads-tipi';
import { type Periodo, periodoPrima, giorniDi } from './periodo';

const VARS = ['META_ADS_ACCESS_TOKEN', 'META_ADS_ACCOUNT_ID'];
export const metaMissing = () => VARS.filter((v) => !env[v]);
export const metaConfigured = () => metaMissing().length === 0;
const G = () => `https://graph.facebook.com/${env.META_API_VERSION || 'v25.0'}`;
const act = () => { const id = (env.META_ADS_ACCOUNT_ID ?? '').trim(); return id.startsWith('act_') ? id : `act_${id}`; };

type Azione = { action_type: string; value: string };
type Insight = { campaign_id?: string; publisher_platform?: string; date_start?: string; spend?: string; impressions?: string; clicks?: string; actions?: Azione[]; action_values?: Azione[] };

async function get<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
	const qs = new URLSearchParams({ ...params, access_token: env.META_ADS_ACCESS_TOKEN ?? '' });
	const r = await fetch(`${G()}/${path}?${qs}`);
	const j = await r.json();
	if (!r.ok || j.error) throw new Error(`Meta Ads: ${j.error?.message ?? r.status}`);
	return j as T;
}
async function post(path: string, params: Record<string, string>): Promise<void> {
	const r = await fetch(`${G()}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, access_token: env.META_ADS_ACCESS_TOKEN ?? '' }) });
	const j = await r.json();
	if (!r.ok || j.error) throw new Error(`Meta Ads: ${j.error?.message ?? r.status}`);
}
async function tutte<T>(path: string, params: Record<string, string>): Promise<T[]> {
	const out: T[] = [];
	let next: string | null = null;
	let page = await get<{ data: T[]; paging?: { next?: string } }>(path, { ...params, limit: '200' });
	for (;;) {
		out.push(...(page.data ?? []));
		next = page.paging?.next ?? null;
		if (!next || out.length > 2000) break;
		const r = await fetch(next); page = await r.json();
		if (page && 'error' in page) break;
	}
	return out;
}

/* gli ordini: acquisti dal pixel/CAPI; se la campagna non ha acquisti si guardano i contatti */
const ACQUISTI = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
function conv(az: Azione[] | undefined): number { for (const k of ACQUISTI) { const a = az?.find((x) => x.action_type === k); if (a) return num(a.value); } return 0; }
function valore(az: Azione[] | undefined): number | null { for (const k of ACQUISTI) { const a = az?.find((x) => x.action_type === k); if (a) return num(a.value); } return null; }
const ris = (i: Insight | undefined): Risultati => ({ spesa: num(i?.spend), impressioni: num(i?.impressions), clic: num(i?.clicks), conversioni: conv(i?.actions), valore: valore(i?.action_values) });
const range = (p: Periodo) => JSON.stringify({ since: p.da, until: p.a });
const CAMPI = 'spend,impressions,clicks,actions,action_values';

let cache = new Map<string, { at: number; data: CanaleDati }>();
export async function getMeta(periodo: Periodo, opts: { prima?: boolean } = {}): Promise<CanaleDati> {
	const k = `${periodo.da}|${periodo.a}|${opts.prima ? 1 : 0}`;
	const c = cache.get(k);
	if (c && Date.now() - c.at < 60_000) return c.data;
	const prima = periodoPrima(periodo);
	const mese = { da: periodo.a.slice(0, 8) + '01', a: periodo.a };
	const [campagne, perCamp, perPiattCamp, perGiorno, perPiatt, primaIns, meseIns] = await Promise.all([
		tutte<{ id: string; name: string; status: string; effective_status: string; objective: string; daily_budget?: string; lifetime_budget?: string }>(`${act()}/campaigns`, { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget' }),
		tutte<Insight>(`${act()}/insights`, { level: 'campaign', fields: `campaign_id,${CAMPI}`, time_range: range(periodo) }),
		tutte<Insight>(`${act()}/insights`, { level: 'campaign', fields: `campaign_id,${CAMPI}`, breakdowns: 'publisher_platform', time_range: range(periodo) }),
		tutte<Insight>(`${act()}/insights`, { level: 'account', fields: CAMPI, time_increment: '1', time_range: range(periodo) }),
		tutte<Insight>(`${act()}/insights`, { level: 'account', fields: CAMPI, breakdowns: 'publisher_platform', time_range: range(periodo) }),
		opts.prima === false ? Promise.resolve([] as Insight[]) : tutte<Insight>(`${act()}/insights`, { level: 'account', fields: CAMPI, time_range: range(prima) }),
		tutte<Insight>(`${act()}/insights`, { level: 'account', fields: 'spend', time_range: range(mese) })
	]);
	const byCamp = new Map(perCamp.map((i) => [String(i.campaign_id), i]));
	const piattDi = (xs: Insight[]) => { const o: Record<string, Risultati> = {}; for (const i of xs) { const r = ris(i); if (r.spesa > 0 || r.conversioni > 0) o[String(i.publisher_platform ?? 'altro')] = r; } return o; };
	const piattPerCamp = new Map<string, Insight[]>();
	for (const i of perPiattCamp) { const id = String(i.campaign_id); if (!piattPerCamp.has(id)) piattPerCamp.set(id, []); piattPerCamp.get(id)!.push(i); }
	const lista: Campagna[] = campagne.filter((c) => c.effective_status !== 'DELETED' && c.effective_status !== 'ARCHIVED').map((c): Campagna => {
		const r = ris(byCamp.get(c.id));
		const giornaliero = c.daily_budget && num(c.daily_budget) > 0 ? num(c.daily_budget) / 100 : null;
		return {
			canale: 'meta', id: c.id, nome: c.name, statoOriginale: c.effective_status,
			stato: c.effective_status === 'ACTIVE' ? 'attiva' : c.effective_status === 'PAUSED' || c.effective_status === 'CAMPAIGN_PAUSED' ? 'in_pausa' : 'altro',
			obiettivo: c.objective.replace(/^OUTCOME_/, '').toLowerCase().replace(/_/g, ' '),
			budgetGiorno: giornaliero, budgetTotale: c.lifetime_budget && num(c.lifetime_budget) > 0 ? num(c.lifetime_budget) / 100 : null, budgetModificabile: giornaliero != null,
			...r, piattaforme: piattDi(piattPerCamp.get(c.id) ?? [])
		};
	}).sort((x, y) => y.spesa - x.spesa);
	const kpi = ris(perCamp.length ? { spend: String(lista.reduce((s, c) => s + c.spesa, 0)), impressions: String(lista.reduce((s, c) => s + c.impressioni, 0)), clicks: String(lista.reduce((s, c) => s + c.clic, 0)) } : undefined);
	kpi.conversioni = lista.reduce((s, c) => s + c.conversioni, 0);
	kpi.valore = lista.some((c) => c.valore != null) ? lista.reduce((s, c) => s + (c.valore ?? 0), 0) : null;
	const giorniMap = new Map(perGiorno.map((i) => [String(i.date_start), i]));
	const data: CanaleDati = {
		canale: 'meta', account: act(), periodo, kpi,
		prima: opts.prima === false ? null : ris(primaIns[0]),
		spesaMese: num(meseIns[0]?.spend),
		giorni: giorniDi(periodo).map((g) => { const r = ris(giorniMap.get(g)); return { giorno: g, spesa: r.spesa, clic: r.clic, conversioni: r.conversioni, valore: r.valore }; }),
		campagne: lista, piattaforme: piattDi(perPiatt), aggiornato: new Date().toISOString()
	};
	cache.set(k, { at: Date.now(), data });
	return data;
}
/** Nuovo budget giornaliero (solo campagne con budget a livello di campagna) */
export async function metaBudget(id: string, euroGiorno: number): Promise<void> {
	await post(id, { daily_budget: String(Math.round(euroGiorno * 100)) });
	cache = new Map();
}
export async function metaStato(id: string, on: boolean): Promise<void> {
	await post(id, { status: on ? 'ACTIVE' : 'PAUSED' });
	cache = new Map();
}

/** Spesa mese per mese (yyyy-mm → euro) fra due date: una chiamata sola, per l'Analisi margini */
export async function metaSpesaMesi(p: Periodo): Promise<Record<string, number>> {
	const righe = await tutte<Insight>(`${act()}/insights`, { level: 'account', fields: 'spend', time_increment: 'monthly', time_range: range(p) });
	const out: Record<string, number> = {};
	for (const i of righe) { const k = String(i.date_start ?? '').slice(0, 7); if (k) out[k] = (out[k] ?? 0) + num(i.spend); }
	return out;
}
