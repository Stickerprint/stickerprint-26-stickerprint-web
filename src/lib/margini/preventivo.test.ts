import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINES } from '$lib/pricing/engine';
import { DEFAULT_CALENDAR } from '$lib/production/types';
import { categoryFromCode } from '$lib/dashboard/orders';
import { costoRiga } from './costi';
import { analizzaPreventivo, analizzaRiga, minutiGiorno, prezzoPerMargine, prezzoPezzoPerMargine, type Contesto } from './preventivo';

const ctx: Contesto = { engines: DEFAULT_ENGINES, codici: {}, prodottoDi: (c) => categoryFromCode(c), machines: [], profiles: [], calendar: DEFAULT_CALENDAR };
const sticker = { code: 'STK', description: 'Sticker sagomato "Adjusted" · 60×50 mm · vinile bianco, senza lamina', qty: 50, price: 0.4, lamination: 'nessuna' };

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
});

describe('riga a catalogo', () => {
	it('materiali dell\'Analisi margini, tempi della produzione, manodopera dal costo orario', () => {
		const r = analizzaRiga(sticker, 0, ctx, 30);
		const c = costoRiga({ product_slug: 'adesivi_personalizzati', product_code: 'STK', description: sticker.description, lamination: 'nessuna', qty: 50 }, DEFAULT_ENGINES);
		expect(r.tipo).toBe('prodotto');
		expect(r.letto).toMatchObject({ w: 60, h: 50, materiale: 'bianco', lamina: 'nessuna' });
		expect(r.materiale).toBe(c.costi.totale);
		expect(r.materiali.map((m) => m.nome)).toEqual([expect.stringContaining('bobina'), 'Stampa (inchiostro)']);
		expect(r.minuti).toBeGreaterThan(0);
		expect(r.fasi.map((f) => f.label)).toEqual(['Stampa UV', 'Taglio']);
		expect(r.manodopera).toBeCloseTo((r.minuti / 60) * 30, 2);
		expect(r.costo).toBeCloseTo(r.materiale + r.manodopera!, 2);
		expect(r.ricavo).toBe(20);
		expect(r.margine).toBeCloseTo(20 - r.costo, 2);
		/* senza macchinari configurati i tempi sono di riserva: e' una stima, e lo dice */
		expect(r.stato).toBe('stima');
		expect(r.note.join(' ')).toMatch(/Setup → Macchinari/);
	});
	it('senza costo orario la manodopera non c\'e\' e non si finge', () => {
		const r = analizzaRiga(sticker, 0, ctx, null);
		expect(r.manodopera).toBeNull();
		expect(r.costo).toBe(r.materiale);
	});
	it('resinati con plastifica: lamina, resina e la maturazione come attesa', () => {
		const r = analizzaRiga({ code: 'ADR', description: 'ovali 15×13,5 mm', qty: 400, price: 0.16, lamination: 'lucida' }, 0, ctx, 30);
		expect(r.materiali.some((m) => /Resina/.test(m.nome))).toBe(true);
		expect(r.fasi.some((f) => f.passiva && f.attesa > 0)).toBe(true);
		expect(r.attesa).toBeGreaterThan(0);
	});
	it('descrizione senza misura: manca, con il motivo; la misura scritta nel pannello la sblocca', () => {
		const senza = analizzaRiga({ code: 'STK', description: 'adesivi per la fiera', qty: 100, price: 1 }, 0, ctx, 30);
		expect(senza.stato).toBe('manca'); expect(senza.completo).toBe(false); expect(senza.note.join(' ')).toMatch(/misura/i);
		const con = analizzaRiga({ code: 'STK', description: 'adesivi per la fiera', qty: 100, price: 1, costo: { w: 80, h: 80 } }, 0, ctx, 30);
		expect(con.stato).not.toBe('manca'); expect(con.letto).toMatchObject({ w: 80, h: 80 });
	});
	it('codice che non e\' a catalogo: dice di usare il fuori catalogo; spedizione e grafica sono servizi senza costo', () => {
		expect(analizzaRiga({ code: 'XYZ', description: 'pannello forex 3 mm', qty: 10, price: 12 }, 0, ctx, 30).note.join(' ')).toMatch(/Fuori catalogo/);
		const s = analizzaRiga({ code: 'SPED', description: 'Spedizione con corriere', qty: 1, price: 9 }, 1, ctx, 30);
		expect(s.tipo).toBe('servizio'); expect(s.costo).toBe(0); expect(s.margine).toBe(9);
	});
	it('prezzi IVA inclusa: il ricavo e\' al netto', () => {
		expect(analizzaRiga({ ...sticker, price: 1.22 }, 0, ctx, 30, true).ricavo).toBe(50);
	});
});

describe('voce fuori catalogo', () => {
	it('materiale al metro quadro con lo sfrido, stampa, minuti di lavoro e altri costi', () => {
		const r = analizzaRiga({ code: 'XYZ', description: 'Pannelli forex 3 mm 100×50 cm', qty: 10, price: 25, costo: { modo: 'manuale', materialeNome: 'Forex 3 mm', costoM2: 12, w: 1000, h: 500, sfrido: 20, stampa: true, minuti: 90, altri: 15 } }, 0, ctx, 30);
		expect(r.tipo).toBe('manuale'); expect(r.stato).toBe('ok');
		/* 10 pannelli da 0,5 m² = 5 m², piu' il 20% = 6 m² a 12 € = 72 €; inchiostro su 5 m² */
		expect(r.materiali[0].valore).toBe(72);
		expect(r.materiali[1].valore).toBeCloseTo(5 * DEFAULT_ENGINES.adesivi_personalizzati.print.costM2, 2);
		expect(r.manodopera).toBe(45);
		expect(r.altri).toBe(15);
		expect(r.costo).toBeCloseTo(72 + r.materiali[1].valore + 45 + 15, 2);
		expect(r.costoPezzo).toBeCloseTo(r.costo / 10, 3);
		expect(r.ricavo).toBe(250);
	});
	it('materiale a pezzo, senza misura', () => {
		const r = analizzaRiga({ description: 'Shopper in cotone', qty: 200, price: 3, costo: { modo: 'manuale', costoPezzo: 1.1, minuti: 60 } }, 0, ctx, 24);
		expect(r.materiale).toBe(220); expect(r.manodopera).toBe(24); expect(r.costo).toBe(244); expect(r.marginePct).toBeCloseTo((600 - 244) / 600 * 100, 1);
	});
	it('senza costo del materiale manca; al metro quadro senza misura manca', () => {
		expect(analizzaRiga({ description: 'x', qty: 1, price: 1, costo: { modo: 'manuale' } }, 0, ctx, 30).stato).toBe('manca');
		expect(analizzaRiga({ description: 'x', qty: 1, price: 1, costo: { modo: 'manuale', costoM2: 10 } }, 0, ctx, 30).stato).toBe('manca');
	});
});

describe('tutto il preventivo', () => {
	const bozza = { items: Array.from({ length: 10 }, () => ({ ...sticker })), price_type: 'netti', ship_method: 'Corriere a carico del mittente', costi: { orario: 30, margine: 50 } };
	it('somma righe, aggiunge il nostro corriere, calcola margine e giorni', () => {
		const a = analizzaPreventivo(bozza, ctx);
		expect(a.righe).toHaveLength(10);
		expect(a.ricavo).toBe(200);
		expect(a.spedizione).toBe(7.5);
		expect(a.costo).toBeCloseTo(a.materiale + a.manodopera! + a.spedizione, 2);
		expect(a.margine).toBeCloseTo(200 - a.costo, 2);
		expect(a.giorniConsegna).toBeGreaterThanOrEqual(1);
		expect(a.completo).toBe(true);
		expect(a.consigli.map((c) => c.nome)).toEqual(['Pareggio', 'Minimo', 'Consigliato', 'Pieno']);
		expect(a.consigli[0].prezzo).toBe(a.costo);
		expect(a.consigli[2].prezzo).toBeCloseTo(a.costo * 2, 1);
	});
	it('consegna diretta: niente corriere; senza costo orario lo dice e non e\' completo', () => {
		expect(analizzaPreventivo({ ...bozza, ship_method: 'Consegna diretta Stickerprint' }, ctx).spedizione).toBe(0);
		const a = analizzaPreventivo({ ...bozza, costi: {} }, ctx);
		expect(a.manodopera).toBeNull(); expect(a.completo).toBe(false); expect(a.avvisi.join(' ')).toMatch(/costo orario/);
	});
	it('le righe vuote non contano; una riga senza costo viene segnalata', () => {
		const a = analizzaPreventivo({ items: [{ code: '', description: '', qty: 100, price: 0.35 }, sticker, { code: 'STK', description: 'senza misura', qty: 10, price: 1 }], costi: { orario: 30 } }, ctx);
		expect(a.righe).toHaveLength(2);
		expect(a.completo).toBe(false);
		expect(a.avvisi.join(' ')).toMatch(/non ha ancora un costo/);
	});
});
