/** Analisi margini: listini, codici prodotto e fatture per calcolare consumo e margine degli ordini. */
import { DEFAULT_ENGINES, type EngineConfig } from '$lib/pricing/engine';
import { loadEngine } from '$lib/server/pricing';
import { deliveryMode, type OrderGroup } from '$lib/dashboard/orders';
import { costoRiga, costoSpedizione, ricavoRiga, type StatoCosto } from '$lib/margini/costi';
import type { OrdineMargine, RigaMargine } from '$lib/margini/tipi';
export type { OrdineMargine, RigaMargine };

type DB = App.Locals['supabase'];

export interface Contesto { engines: Record<string, EngineConfig>; codici: Map<string, string> }
export interface FatturaMargine { number: string; checkout_group: string | null; order_numbers: string[] | null; express_net: number | string | null; lines: { description?: string; total_net?: number | string }[] | null }

export async function contestoMargini(supabase: DB): Promise<Contesto> {
	const [codes, ...list] = await Promise.all([
		supabase.from('product_codes').select('code, description'),
		...Object.keys(DEFAULT_ENGINES).map((slug) => loadEngine(supabase, slug).then((e) => [slug, e.config] as const))
	]);
	const codici = new Map<string, string>();
	for (const c of (codes.data ?? []) as { code: string; description: string | null }[]) if (c.description) codici.set(c.code.toUpperCase(), c.description);
	return { engines: Object.fromEntries(list), codici };
}

/** fatture per gruppo e per numero d'ordine (gli ordini manuali e vecchi si trovano dal numero) */
export function indiceFatture(fatture: FatturaMargine[]) {
	const perGruppo = new Map<string, FatturaMargine>(), perNumero = new Map<string, FatturaMargine>();
	for (const f of fatture) {
		if (f.checkout_group && !perGruppo.has(f.checkout_group)) perGruppo.set(f.checkout_group, f);
		for (const n of f.order_numbers ?? []) if (!perNumero.has(n)) perNumero.set(n, f);
	}
	return (g: OrderGroup) => perGruppo.get(g.key) ?? g.numbers.map((n) => perNumero.get(n)).find(Boolean) ?? null;
}
export const COLONNE_FATTURA = 'number, checkout_group, order_numbers, express_net, lines';

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (m: number, ric: number) => (ric > 0 ? Math.round((m / ric) * 1000) / 10 : null);
const RANK: Record<StatoCosto, number> = { ok: 0, stima: 1, manca: 2 };

export function margineOrdine(g: OrderGroup, ctx: Contesto, f: FatturaMargine | null): OrdineMargine {
	const righe: RigaMargine[] = g.items.map((i) => {
		const ricavo = ricavoRiga(i);
		const costo = costoRiga(i, ctx.engines, i.product_code ? ctx.codici.get(i.product_code.toUpperCase()) : null);
		const margine = costo.stato === 'manca' ? null : r2(ricavo - costo.costi.totale);
		return {
			id: i.id, number: i.number, product_slug: costo.listino, product_name: i.product_name, product_code: i.product_code, description: i.description, qty: i.qty,
			ricavo, costo, margine, marginePct: margine == null ? null : pct(margine, ricavo)
		};
	});
	const prodotti = righe.filter((r) => r.costo.tipo === 'prodotto');
	const servizi = righe.filter((r) => r.costo.tipo === 'servizio');
	/* la spedizione addebitata e l'express stanno in fattura; se l'ordine manuale ha gia' una riga "spedizione" non si conta due volte */
	const spedizione = servizi.some((r) => r.costo.spedizione) ? 0 : r2((f?.lines ?? []).filter((l) => /^spedizione/i.test(String(l.description ?? ''))).reduce((s, l) => s + num(l.total_net), 0));
	const express = r2(num(f?.express_net));
	const ricavo = {
		prodotti: r2(prodotti.reduce((s, r) => s + r.ricavo, 0)), servizi: r2(servizi.reduce((s, r) => s + r.ricavo, 0)), spedizione, express, totale: 0
	};
	ricavo.totale = r2(ricavo.prodotti + ricavo.servizi + ricavo.spedizione + ricavo.express);
	const somma = (k: 'vinile' | 'stampa' | 'lamina' | 'resina') => r2(prodotti.reduce((s, r) => s + r.costo.costi[k], 0));
	const costo = { vinile: somma('vinile'), stampa: somma('stampa'), lamina: somma('lamina'), resina: somma('resina'), corriere: costoSpedizione(g), totale: 0 };
	costo.totale = r2(costo.vinile + costo.stampa + costo.lamina + costo.resina + costo.corriere);
	const stato = righe.reduce<StatoCosto>((s, r) => (RANK[r.costo.stato] > RANK[s] ? r.costo.stato : s), 'ok');
	const margine = stato === 'manca' ? null : r2(ricavo.totale - costo.totale);
	return {
		key: g.key, number: g.number, channel: g.channel, customer: g.customer, created_at: g.created_at, status: g.status, qty: g.qty,
		consegna: deliveryMode(g), fattura: f?.number ?? null, ricavo, costo, margine, marginePct: margine == null ? null : pct(margine, ricavo.totale), stato,
		lette: righe.filter((r) => r.costo.lettura && Object.values(r.costo.lettura.fonti).some((x) => x === 'descrizione' || x === 'codice')).length,
		righe
	};
}
