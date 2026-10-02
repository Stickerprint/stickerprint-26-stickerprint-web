import { DEFAULT_ENGINES, type EngineConfig } from '$lib/pricing/engine';
import { loadEngine } from '$lib/server/pricing';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { costoRiga, costoSpedizione, ricavoRiga, riepilogo, slugListino, PARAMETRI, COSTO_SPEDIZIONE_NETTO, type CostoRiga, type StatoCosto } from '$lib/margini/costi';
import type { PageServerLoad } from './$types';

export interface RigaMargine {
	id: string; number: string; product_slug: string; product_name: string; qty: number;
	misura: string; materiale: string | null; finitura: string | null;
	ricavo: number; costo: CostoRiga; margine: number; marginePct: number | null;
}
export interface OrdineMargine {
	key: string; number: string; channel: string; customer: string; created_at: string; status: string; qty: number;
	/** ricavo = prodotti (listino meno sconto) + spedizione addebitata + express; costo = righe + corriere */
	ricavo: number; costo: number; margine: number; marginePct: number | null; mq: number;
	/** voci dell'ordine intero, fuori dalle righe prodotto */
	extra: { spedizioneRicavo: number; expressRicavo: number; spedizioneCosto: number; fattura: string | null };
	/** il peggiore fra le righe: 'manca' se anche una sola riga non si calcola */
	stato: StatoCosto;
	righe: RigaMargine[];
}
interface FatturaRiga { number: string; checkout_group: string | null; order_numbers: string[] | null; express_net: number | string | null; lines: { description?: string; total_net?: number | string }[] | null }

const r2 = (v: number) => Math.round(v * 100) / 100;
const pct = (margine: number, ricavo: number) => (ricavo > 0 ? Math.round((margine / ricavo) * 1000) / 10 : null);
const RANK: Record<StatoCosto, number> = { ok: 0, stima: 1, manca: 2 };

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	/* stessi ordini della lista Ordini (e-commerce solo se pagati), senza gli annullati: non si produce niente */
	const [{ data }, { data: first }, { data: fatture }, ...engineList] = await Promise.all([
		supabase.from('orders').select('*').gte('created_at', `${year}-01-01`).lt('created_at', `${year + 1}-01-01`).or('channel.neq.ecommerce,status.neq.attesa_pagamento').neq('status', 'annullato').order('created_at', { ascending: false }).limit(3000),
		supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
		/* la spedizione addebitata al cliente e il supplemento express stanno solo in fattura (riga "Spedizione", express_net) */
		supabase.from('invoices').select('number, checkout_group, order_numbers, express_net, lines').gte('issued_at', `${year - 1}-12-01`).lt('issued_at', `${year + 1}-02-01`).limit(5000),
		...Object.keys(DEFAULT_ENGINES).map((slug) => loadEngine(supabase, slug).then((e) => [slug, e.config] as const))
	]);
	const engines: Record<string, EngineConfig> = Object.fromEntries(engineList);
	const firstYear = first ? new Date(first.created_at).getFullYear() : year;
	const years = Array.from({ length: Math.max(1, new Date().getFullYear() - Math.min(firstYear, new Date().getFullYear() - 2) + 1) }, (_, i) => new Date().getFullYear() - i);

	/* fattura dell'ordine: per checkout_group, altrimenti per numero d'ordine (ordini manuali e vecchi) */
	const perGruppo = new Map<string, FatturaRiga>(), perNumero = new Map<string, FatturaRiga>();
	for (const f of (fatture ?? []) as FatturaRiga[]) {
		if (f.checkout_group && !perGruppo.has(f.checkout_group)) perGruppo.set(f.checkout_group, f);
		for (const n of f.order_numbers ?? []) if (!perNumero.has(n)) perNumero.set(n, f);
	}
	const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

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
		const f = perGruppo.get(g.key) ?? g.numbers.map((n) => perNumero.get(n)).find(Boolean) ?? null;
		const spedizioneRicavo = r2((f?.lines ?? []).filter((l) => /^spedizione/i.test(String(l.description ?? ''))).reduce((s, l) => s + num(l.total_net), 0));
		const expressRicavo = r2(num(f?.express_net));
		const spedizioneCosto = costoSpedizione(g);
		const ricavo = r2(rp.ricavo + spedizioneRicavo + expressRicavo);
		const costo = r2(rp.costo + spedizioneCosto);
		const margine = r2(rp.ricavoConCosto + spedizioneRicavo + expressRicavo - costo);
		return {
			key: g.key, number: g.number, channel: g.channel, customer: g.customer, created_at: g.created_at, status: g.status, qty: g.qty,
			ricavo, costo, margine: stato === 'manca' ? 0 : margine, marginePct: stato === 'manca' ? null : pct(margine, rp.ricavoConCosto + spedizioneRicavo + expressRicavo), mq: rp.mq,
			extra: { spedizioneRicavo, expressRicavo, spedizioneCosto, fattura: f?.number ?? null },
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

	return { year, years, ordini, listini, parametri: { bobina: PARAMETRI.bobina.width, scarto: PARAMETRI.scarto, gap: PARAMETRI.gap, gapFogli: PARAMETRI.gapFogli, spedizione: COSTO_SPEDIZIONE_NETTO } };
};
