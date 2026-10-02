import { DEFAULT_ENGINES, type EngineConfig } from '$lib/pricing/engine';
import { loadEngine } from '$lib/server/pricing';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { costoRiga, ricavoRiga, riepilogo, slugListino, PARAMETRI, type CostoRiga, type StatoCosto } from '$lib/margini/costi';
import type { PageServerLoad } from './$types';

export interface RigaMargine {
	id: string; number: string; product_slug: string; product_name: string; qty: number;
	misura: string; materiale: string | null; finitura: string | null;
	ricavo: number; costo: CostoRiga; margine: number; marginePct: number | null;
}
export interface OrdineMargine {
	key: string; number: string; channel: string; customer: string; created_at: string; status: string; qty: number;
	ricavo: number; costo: number; margine: number; marginePct: number | null; mq: number;
	/** il peggiore fra le righe: 'manca' se anche una sola riga non si calcola */
	stato: StatoCosto;
	righe: RigaMargine[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pct = (margine: number, ricavo: number) => (ricavo > 0 ? Math.round((margine / ricavo) * 1000) / 10 : null);
const RANK: Record<StatoCosto, number> = { ok: 0, stima: 1, manca: 2 };

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	/* stessi ordini della lista Ordini (e-commerce solo se pagati), senza gli annullati: non si produce niente */
	const [{ data }, { data: first }, ...engineList] = await Promise.all([
		supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').order('created_at', { ascending: false }).limit(3000),
		supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
		...Object.keys(DEFAULT_ENGINES).map((slug) => loadEngine(supabase, slug).then((e) => [slug, e.config] as const))
	]);
	const engines: Record<string, EngineConfig> = Object.fromEntries(engineList);
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	const years = Array.from({ length: Math.max(1, new Date().getFullYear() - Math.min(firstYear, new Date().getFullYear() - 2) + 1) }, (_, i) => new Date().getFullYear() - i);

	const ordini: OrdineMargine[] = groupOrders((data ?? []) as OrderRow[]).map((g) => {
		const righe: RigaMargine[] = g.items.map((i) => {
			const ricavo = ricavoRiga(i);
			const costo = costoRiga(i, engines);
			const margine = costo.stato === 'manca' ? 0 : r2(ricavo - costo.totale);
			return {
				id: i.id, number: i.number, product_slug: slugListino(i.product_slug), product_name: i.product_name, qty: i.qty,
				misura: i.width_mm && i.height_mm ? `${Number(i.width_mm)}×${Number(i.height_mm)} mm` : i.width_mm ? `${Number(i.width_mm)} mm` : '—',
				materiale: i.materiale, finitura: i.lamination && i.lamination !== 'nessuna' ? i.lamination : i.finitura,
				ricavo, costo, margine, marginePct: costo.stato === 'manca' ? null : pct(margine, ricavo)
			};
		});
		const rp = riepilogo(righe);
		const stato = righe.reduce<StatoCosto>((s, r) => (RANK[r.costo.stato] > RANK[s] ? r.costo.stato : s), 'ok');
		return {
			key: g.key, number: g.number, channel: g.channel, customer: g.customer, created_at: g.created_at, status: g.status, qty: g.qty,
			ricavo: rp.ricavo, costo: rp.costo, margine: stato === 'manca' ? 0 : rp.margine, marginePct: stato === 'manca' ? null : pct(rp.margine, rp.ricavoConCosto), mq: rp.mq,
			stato, righe
		};
	});

	/* costi unitari del listino, per il riquadro "come calcolo" */
	const listini = Object.entries(engines).map(([slug, cfg]) => ({
		slug, name: cfg.kind === 'resina' ? 'Adesivi resinati' : (slug.replace(/_/g, ' ')),
		stampaM2: cfg.print.costM2, laminaM2: cfg.kind === 'lamina' ? cfg.laminate.costM2 : null,
		resinaCm2: cfg.kind === 'resina' ? Math.round((cfg.resin.costKg / 1000) * cfg.resin.gramsPerCm2 * 100000) / 100000 : null,
		materiali: cfg.materials.filter((m) => m.visible).map((m) => ({ id: m.id, label: m.label, costM2: m.costM2 }))
	}));

	return { year, years, ordini, listini, parametri: { bobina: PARAMETRI.bobina.width, scarto: PARAMETRI.scarto, gap: PARAMETRI.gap, gapFogli: PARAMETRI.gapFogli } };
};
