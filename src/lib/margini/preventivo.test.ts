import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINES, type EngineConfig } from '$lib/pricing/engine';
import { listinoIniziale, listinoPubblico, prezzo, type Listino } from '$lib/pricing/listino';
import { DEFAULT_CALENDAR } from '$lib/production/types';
import { categoryFromCode } from '$lib/dashboard/orders';
import { costoRiga } from './costi';
import { analizzaPreventivo, analizzaRiga, minutiGiorno, orarioGenerale, prezzoPerMargine, prezzoPezzoPerMargine, type Contesto } from './preventivo';

/* i listini dei prodotti con il Preventivatore agganciato, come li consegna `loadEngine` */
const conListino = (L: Listino): Record<string, EngineConfig> => Object.fromEntries(Object.entries(DEFAULT_ENGINES).map(([slug, cfg]) => [slug, L.prodotti.some((p) => p.id === slug) ? { ...cfg, listino: { L: listinoPubblico(L, slug), slug } } : cfg]));
const L0 = listinoIniziale();   // costo orario 25 €/h, 2,9 secondi a pezzo, resinati: carrello da 9,2 m² in 170 minuti
const contesto = (engines: Record<string, EngineConfig>): Contesto => ({ engines, codici: {}, prodottoDi: (c) => categoryFromCode(c), machines: [], profiles: [], calendar: DEFAULT_CALENDAR });
const ctx = contesto(conListino(L0));
const sticker = { code: 'STK', description: 'Sticker sagomato "Adjusted" · 60×50 mm · vinile bianco, senza lamina', qty: 500, price: 0.4, lamination: 'nessuna' };

describe('giornata di lavoro e prezzi', () => {
	it('8:30-17:30 senza pausa sono 540 minuti; con la pausa si tolgono', () => {
		expect(minutiGiorno(DEFAULT_CALENDAR)).toBe(540);
		expect(minutiGiorno({ ...DEFAULT_CALENDAR, break_start: '13:00', break_end: '14:00' })).toBe(480);
	});
	it('margine sul prezzo: al 50% il prezzo e\' il doppio del costo', () => {
		expect(prezzoPerMargine(100, 0)).toBe(100);
		expect(prezzoPerMargine(100, 50)).toBe(200);
		expect(prezzoPerMargine(100, 30)).toBe(142.86);
		expect(prezzoPezzoPerMargine({ costo: 100, qty: 500 }, 50)).toBe(0.4);
	});
	it('il costo orario e\' quello del Preventivatore; senza Preventivatore non c\'e\'', () => {
		expect(orarioGenerale(ctx)).toBe(25);
		expect(orarioGenerale(contesto(conListino({ ...L0, comune: { ...L0.comune, costoOrario: 32 } })))).toBe(32);
		expect(orarioGenerale(contesto(DEFAULT_ENGINES))).toBeNull();
	});
});

describe('riga a catalogo', () => {
	it('materiali dell\'Analisi margini; manodopera e tempo dai secondi a pezzo del Preventivatore', () => {
		const r = analizzaRiga(sticker, 0, ctx);
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', product_code: 'STK', description: sticker.description, lamination: 'nessuna', qty: 500 }, ctx.engines);
		expect(r.tipo).toBe('prodotto'); expect(r.stato).toBe('ok');
		expect(r.letto).toMatchObject({ w: 60, h: 50, materiale: 'bianco', lamina: 'nessuna' });
		expect(r.materiale).toBe(c.costi.totale);
		/* 500 pezzi × 2,9 s = 1.450 s = 24 minuti; a 25 €/h = 10,07 € */
		expect(r.minuti).toBe(24);
		expect(r.orario).toBe(25);
		expect(r.manodopera).toBeCloseTo((500 * 2.9 * 25) / 3600, 2);
		expect(r.fasi.map((f) => f.label)).toEqual([expect.stringMatching(/^Lavoro a pezzo \(2,9 s/)]);
		expect(r.costo).toBeCloseTo(r.materiale + r.manodopera!, 2);
		expect(r.ricavo).toBe(200);
		expect(r.completo).toBe(true);
	});
	it('il prezzo di listino della riga e\' quello del sito', () => {
		const r = analizzaRiga(sticker, 0, ctx);
		const p = L0.prodotti.find((x) => x.id === 'adesivi_personalizzati')!;
		expect(r.listino).toBeCloseTo(prezzo(L0, p, { mat: 'bianco', fin: 'nessuna', w: 60, h: 50, q: 500 }).netto, 2);
	});
	it('il costo orario del prodotto vince su quello generale', () => {
		const L = listinoIniziale(); L.prodotti.find((p) => p.id === 'adesivi_personalizzati')!.orario = 40;
		const r = analizzaRiga(sticker, 0, contesto(conListino(L)));
		expect(r.orario).toBe(40);
		expect(r.manodopera).toBeCloseTo((500 * 2.9 * 40) / 3600, 2);
	});
	it('resinati: resina, lavoro a carrello e la maturazione come attesa', () => {
		const r = analizzaRiga({ code: 'ADR', description: 'ovali 15×13,5 mm', qty: 400, price: 0.16, lamination: 'nessuna' }, 0, ctx);
		expect(r.materiali.some((m) => /Resina/.test(m.nome))).toBe(true);
		/* 400 pezzi da 2,025 cm² = 810 cm²; un carrello da 92.000 cm² dura 170 min → 1,5 minuti */
		expect(r.minuti).toBe(Math.round((810 * 170 * 60) / 92000 / 60));
		expect(r.manodopera).toBeCloseTo(((810 * 170 * 60) / 92000) * 25 / 3600, 2);
		expect(r.fasi.some((f) => /Resinatura/.test(f.label))).toBe(true);
		expect(r.fasi.some((f) => f.passiva && f.attesa > 0)).toBe(true);
		expect(r.attesa).toBeGreaterThan(0);
	});
	it('il tempo scritto a mano vale al posto di quello del Preventivatore', () => {
		const r = analizzaRiga({ ...sticker, costo: { minuti: 120 } }, 0, ctx);
		expect(r.minuti).toBe(120); expect(r.manodopera).toBe(50);
	});
	it('senza Preventivatore la manodopera non c\'e\' e non si finge', () => {
		const r = analizzaRiga(sticker, 0, contesto(DEFAULT_ENGINES));
		expect(r.manodopera).toBeNull(); expect(r.costo).toBe(r.materiale); expect(r.completo).toBe(false); expect(r.listino).toBeNull();
	});
	it('descrizione senza misura: manca, con il motivo; la misura scritta nel pannello la sblocca', () => {
		const senza = analizzaRiga({ code: 'STK', description: 'adesivi per la fiera', qty: 100, price: 1 }, 0, ctx);
		expect(senza.stato).toBe('manca'); expect(senza.completo).toBe(false); expect(senza.note.join(' ')).toMatch(/qui sotto/);
		const con = analizzaRiga({ code: 'STK', description: 'adesivi per la fiera', qty: 100, price: 1, costo: { w: 80, h: 80 } }, 0, ctx);
		expect(con.stato).not.toBe('manca'); expect(con.letto).toMatchObject({ w: 80, h: 80 });
	});
	it('codice che non e\' a catalogo: dice di usare il fuori catalogo; spedizione e grafica sono servizi senza costo', () => {
		expect(analizzaRiga({ code: 'XYZ', description: 'pannello forex 3 mm', qty: 10, price: 12 }, 0, ctx).note.join(' ')).toMatch(/Fuori catalogo/);
		const s = analizzaRiga({ code: 'SPED', description: 'Spedizione con corriere', qty: 1, price: 9 }, 1, ctx);
		expect(s.tipo).toBe('servizio'); expect(s.costo).toBe(0); expect(s.margine).toBe(9);
	});
	it('prezzi IVA inclusa: il ricavo e\' al netto', () => {
		expect(analizzaRiga({ ...sticker, qty: 50, price: 1.22 }, 0, ctx, true).ricavo).toBe(50);
	});
});

describe('voce fuori catalogo', () => {
	it('materiale al metro quadro con lo sfrido, stampa, minuti di lavoro al costo orario generale, altri costi', () => {
		const r = analizzaRiga({ code: 'XYZ', description: 'Pannelli forex 3 mm 100×50 cm', qty: 10, price: 25, costo: { modo: 'manuale', materialeNome: 'Forex 3 mm', costoM2: 12, w: 1000, h: 500, sfrido: 20, stampa: true, minuti: 90, altri: 15 } }, 0, ctx);
		expect(r.tipo).toBe('manuale'); expect(r.stato).toBe('ok');
		/* 10 pannelli da 0,5 m² = 5 m², piu' il 20% = 6 m² a 12 € = 72 €; inchiostro su 5 m² */
		expect(r.materiali[0].valore).toBe(72);
		expect(r.materiali[1].valore).toBeCloseTo(5 * ctx.engines.adesivi_personalizzati.print.costM2, 2);
		expect(r.manodopera).toBe(37.5);   // 90 minuti a 25 €/h
		expect(r.altri).toBe(15);
		expect(r.costo).toBeCloseTo(72 + r.materiali[1].valore + 37.5 + 15, 2);
		expect(r.costoPezzo).toBeCloseTo(r.costo / 10, 3);
		expect(r.ricavo).toBe(250);
		expect(r.listino).toBeNull();
	});
	it('materiale a pezzo, senza misura', () => {
		const r = analizzaRiga({ description: 'Shopper in cotone', qty: 200, price: 3, costo: { modo: 'manuale', costoPezzo: 1.1, minuti: 60 } }, 0, ctx);
		expect(r.materiale).toBe(220); expect(r.manodopera).toBe(25); expect(r.costo).toBe(245); expect(r.marginePct).toBeCloseTo(((600 - 245) / 600) * 100, 1);
	});
	it('senza costo del materiale manca; al metro quadro senza misura manca', () => {
		expect(analizzaRiga({ description: 'x', qty: 1, price: 1, costo: { modo: 'manuale' } }, 0, ctx).stato).toBe('manca');
		expect(analizzaRiga({ description: 'x', qty: 1, price: 1, costo: { modo: 'manuale', costoM2: 10 } }, 0, ctx).stato).toBe('manca');
	});
});

describe('tutto il preventivo', () => {
	const bozza = { items: Array.from({ length: 10 }, () => ({ ...sticker, qty: 50 })), price_type: 'netti', ship_method: 'Corriere a carico del mittente', costi: { margine: 50 } };
	it('somma righe, aggiunge il nostro corriere, calcola margine e giorni', () => {
		const a = analizzaPreventivo(bozza, ctx);
		expect(a.righe).toHaveLength(10);
		expect(a.ricavo).toBe(200);
		expect(a.orario).toBe(25);
		expect(a.spedizione).toBe(7.5);
		/* 500 pezzi in tutto: gli stessi 24 minuti di una riga sola da 500 (10 righe da 2 minuti e rotti) */
		expect(a.minuti).toBeGreaterThanOrEqual(20); expect(a.minuti).toBeLessThanOrEqual(30);
		expect(a.costo).toBeCloseTo(a.materiale + a.manodopera! + a.spedizione, 2);
		expect(a.margine).toBeCloseTo(200 - a.costo, 2);
		expect(a.giorniConsegna).toBe(1);
		expect(a.completo).toBe(true);
		expect(a.consigli.map((c) => c.nome)).toEqual(['Pareggio', 'Minimo', 'Consigliato', 'Listino sito']);
		expect(a.consigli[0].prezzo).toBe(a.costo);
		expect(a.consigli[2].prezzo).toBeCloseTo(a.costo * 2, 1);
		expect(a.consigli[3].prezzo).toBe(a.listino);
		expect(a.listino).toBeCloseTo(a.righe.reduce((s, r) => s + r.listino!, 0), 2);
	});
	it('con una voce fuori catalogo non c\'e\' un listino del sito: resta il livello «Pieno»', () => {
		const a = analizzaPreventivo({ ...bozza, items: [sticker, { description: 'Shopper', qty: 10, price: 5, costo: { modo: 'manuale' as const, costoPezzo: 1, minuti: 10 } }] }, ctx);
		expect(a.listino).toBeNull();
		expect(a.consigli.map((c) => c.nome)).toEqual(['Pareggio', 'Minimo', 'Consigliato', 'Pieno']);
	});
	it('consegna diretta: niente corriere; senza Preventivatore lo dice e non e\' completo', () => {
		expect(analizzaPreventivo({ ...bozza, ship_method: 'Consegna diretta Stickerprint' }, ctx).spedizione).toBe(0);
		const a = analizzaPreventivo(bozza, contesto(DEFAULT_ENGINES));
		expect(a.manodopera).toBeNull(); expect(a.completo).toBe(false); expect(a.avvisi.join(' ')).toMatch(/Preventivatore/);
	});
	it('le righe vuote non contano; una riga senza costo viene segnalata', () => {
		const a = analizzaPreventivo({ items: [{ code: '', description: '', qty: 100, price: 0.35 }, sticker, { code: 'STK', description: 'senza misura', qty: 10, price: 1 }] }, ctx);
		expect(a.righe).toHaveLength(2);
		expect(a.completo).toBe(false);
		expect(a.avvisi.join(' ')).toMatch(/non ha ancora un costo/);
	});
});
