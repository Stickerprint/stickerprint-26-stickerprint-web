/**
 * Analisi margini: somme per periodo, per materiale, per prodotto e per mese.
 * Funzioni pure sugli ordini gia' calcolati dal server: le usano le pagine (anche sul telefono) e i test.
 */
import type { OrdineMargine } from './tipi';

const r2 = (v: number) => Math.round(v * 100) / 100;
const pct = (m: number, ric: number) => (ric > 0 ? Math.round((m / ric) * 1000) / 10 : null);

export interface Totali {
	ordini: number; sito: number; manuali: number;
	/** fatturato di tutti gli ordini; `calcolato` solo di quelli con il costo completo (base del margine) */
	fatturato: number; calcolato: number;
	ricavo: { prodotti: number; servizi: number; spedizione: number; express: number };
	costo: { vinile: number; stampa: number; lamina: number; resina: number; corriere: number; totale: number };
	margine: number; marginePct: number | null;
	daCompletare: number; stime: number; lette: number;
}
export function totali(ordini: OrdineMargine[]): Totali {
	const t: Totali = { ordini: ordini.length, sito: 0, manuali: 0, fatturato: 0, calcolato: 0, ricavo: { prodotti: 0, servizi: 0, spedizione: 0, express: 0 }, costo: { vinile: 0, stampa: 0, lamina: 0, resina: 0, corriere: 0, totale: 0 }, margine: 0, marginePct: null, daCompletare: 0, stime: 0, lette: 0 };
	for (const o of ordini) {
		o.channel === 'manuale' ? t.manuali++ : t.sito++;
		t.fatturato += o.ricavo.totale;
		if (o.lette) t.lette++;
		if (o.margine == null) { t.daCompletare++; continue; }
		if (o.stato === 'stima') t.stime++;
		t.calcolato += o.ricavo.totale;
		for (const k of ['prodotti', 'servizi', 'spedizione', 'express'] as const) t.ricavo[k] += o.ricavo[k];
		for (const k of ['vinile', 'stampa', 'lamina', 'resina', 'corriere', 'totale'] as const) t.costo[k] += o.costo[k];
	}
	t.fatturato = r2(t.fatturato); t.calcolato = r2(t.calcolato);
	for (const k of Object.keys(t.ricavo) as (keyof Totali['ricavo'])[]) t.ricavo[k] = r2(t.ricavo[k]);
	for (const k of Object.keys(t.costo) as (keyof Totali['costo'])[]) t.costo[k] = r2(t.costo[k]);
	t.margine = r2(t.calcolato - t.costo.totale);
	t.marginePct = pct(t.margine, t.calcolato);
	return t;
}

export interface VoceMateriale { id: string; label: string; bobinaMm: number; m2: number; pezzi: number; righe: number }
export interface Materiali {
	righe: number; senzaConsumo: number;
	bobinaMm: number; bobinaM2: number; utileM2: number; stampaM2: number; sfridoM2: number; resaPct: number | null;
	pezzi: number; pezziDaFare: number; strisce: number; fogli: number;
	vinili: VoceMateriale[];
	lamine: VoceMateriale[];
	resina: { g: number; cm2: number; pezzi: number; righe: number };
	prodotti: VoceMateriale[];
}
/** tutto il materiale consumato dalle righe prodotto degli ordini */
export function materiali(ordini: OrdineMargine[], nomeProdotto: (slug: string) => string = (s) => s): Materiali {
	const m: Materiali = { righe: 0, senzaConsumo: 0, bobinaMm: 0, bobinaM2: 0, utileM2: 0, stampaM2: 0, sfridoM2: 0, resaPct: null, pezzi: 0, pezziDaFare: 0, strisce: 0, fogli: 0, vinili: [], lamine: [], resina: { g: 0, cm2: 0, pezzi: 0, righe: 0 }, prodotti: [] };
	const vin = new Map<string, VoceMateriale>(), lam = new Map<string, VoceMateriale>(), prod = new Map<string, VoceMateriale>();
	const add = (map: Map<string, VoceMateriale>, id: string, label: string, mm: number, m2: number, pezzi: number) => {
		const v = map.get(id) ?? { id, label, bobinaMm: 0, m2: 0, pezzi: 0, righe: 0 };
		v.bobinaMm += mm; v.m2 += m2; v.pezzi += pezzi; v.righe++;
		map.set(id, v);
	};
	for (const o of ordini) for (const r of o.righe) {
		if (r.costo.tipo !== 'prodotto') continue;
		const c = r.costo.consumo;
		if (!c) { m.senzaConsumo++; continue; }
		m.righe++;
		m.bobinaMm += c.bobinaMm; m.bobinaM2 += c.bobinaM2; m.utileM2 += c.utileM2; m.stampaM2 += c.stampaM2;
		m.pezzi += c.pezzi; m.pezziDaFare += c.pezziDaFare; m.strisce += c.strisce; m.fogli += c.fogli;
		add(vin, c.vinileId, c.vinileLabel, c.bobinaMm, c.bobinaM2, c.pezziDaFare);
		if (c.laminaTipo) add(lam, c.laminaTipo, `Lamina ${c.laminaTipo}`, c.bobinaMm, c.laminaM2, c.pezziDaFare);
		if (c.resinaG) { m.resina.g += c.resinaG; m.resina.cm2 += c.resinaCm2; m.resina.pezzi += c.pezziDaFare; m.resina.righe++; }
		add(prod, r.product_slug, nomeProdotto(r.product_slug), c.bobinaMm, c.bobinaM2, c.pezziDaFare);
	}
	const ord = (map: Map<string, VoceMateriale>) => [...map.values()].map((v) => ({ ...v, m2: Math.round(v.m2 * 1000) / 1000 })).sort((a, b) => b.m2 - a.m2);
	m.vinili = ord(vin); m.lamine = ord(lam); m.prodotti = ord(prod);
	m.bobinaM2 = Math.round(m.bobinaM2 * 1000) / 1000; m.utileM2 = Math.round(m.utileM2 * 1000) / 1000; m.stampaM2 = Math.round(m.stampaM2 * 1000) / 1000;
	m.sfridoM2 = Math.round(Math.max(0, m.bobinaM2 - m.utileM2) * 1000) / 1000;
	m.resaPct = m.bobinaM2 > 0 ? Math.round((m.utileM2 / m.bobinaM2) * 1000) / 10 : null;
	return m;
}

export interface VoceProdotto { slug: string; ordini: number; righe: number; pezzi: number; ricavo: number; calcolato: number; costo: number; margine: number; marginePct: number | null; bobinaM2: number; senzaCosto: number }
/** margine delle sole righe prodotto (corriere, spedizione addebitata ed express restano sull'ordine) */
export function perProdotto(ordini: OrdineMargine[]): VoceProdotto[] {
	const map = new Map<string, VoceProdotto & { set: Set<string> }>();
	for (const o of ordini) for (const r of o.righe) {
		if (r.costo.tipo !== 'prodotto') continue;
		const p = map.get(r.product_slug) ?? { slug: r.product_slug, ordini: 0, righe: 0, pezzi: 0, ricavo: 0, calcolato: 0, costo: 0, margine: 0, marginePct: null, bobinaM2: 0, senzaCosto: 0, set: new Set<string>() };
		p.set.add(o.key); p.righe++; p.pezzi += r.qty; p.ricavo += r.ricavo;
		if (r.margine == null) p.senzaCosto++;
		else { p.calcolato += r.ricavo; p.costo += r.costo.costi.totale; p.bobinaM2 += r.costo.consumo?.bobinaM2 ?? 0; }
		map.set(r.product_slug, p);
	}
	return [...map.values()].map(({ set, ...p }) => {
		const margine = r2(p.calcolato - p.costo);
		return { ...p, ordini: set.size, ricavo: r2(p.ricavo), calcolato: r2(p.calcolato), costo: r2(p.costo), margine, marginePct: pct(margine, p.calcolato), bobinaM2: Math.round(p.bobinaM2 * 100) / 100 };
	}).sort((a, b) => b.ricavo - a.ricavo);
}

/** fatturato e margine di ogni mese dell'anno (0 = gennaio) */
/** `calcolato` = fatturato degli ordini con il costo completo (base della percentuale) */
export function perMese(ordini: OrdineMargine[], anno: number): { mese: number; ordini: number; fatturato: number; calcolato: number; margine: number; marginePct: number | null }[] {
	const out = Array.from({ length: 12 }, (_, mese) => ({ mese, ordini: 0, fatturato: 0, calcolato: 0, costo: 0 }));
	for (const o of ordini) {
		const d = new Date(o.created_at);
		if (d.getFullYear() !== anno) continue;
		const b = out[d.getMonth()];
		b.ordini++; b.fatturato += o.ricavo.totale;
		if (o.margine != null) { b.calcolato += o.ricavo.totale; b.costo += o.costo.totale; }
	}
	return out.map((b) => ({ mese: b.mese, ordini: b.ordini, fatturato: r2(b.fatturato), calcolato: r2(b.calcolato), margine: r2(b.calcolato - b.costo), marginePct: pct(b.calcolato - b.costo, b.calcolato) }));
}
