import { describe, expect, it } from 'vitest';
import { analizzaCanale, analizzaTutto, giudica } from './analisi';
import { OBIETTIVI_DEFAULT, type Campagna, type CanaleDati } from './ads-tipi';

const o = { ...OBIETTIVI_DEFAULT }; // valore ordine 45, ROAS 3 → costo massimo per ordine 15 €
const camp = (x: Partial<Campagna>): Campagna => ({ canale: 'meta', id: 'c', nome: 'Campagna', stato: 'attiva', statoOriginale: 'ACTIVE', obiettivo: 'sales', budgetGiorno: 20, budgetTotale: null, budgetModificabile: true, spesa: 0, impressioni: 0, clic: 0, conversioni: 0, valore: null, ...x });
const dati = (campagne: Campagna[], canale: CanaleDati['canale'] = 'meta'): CanaleDati => ({ canale, account: 'x', periodo: { da: '2026-09-08', a: '2026-10-07' }, kpi: { spesa: campagne.reduce((s, c) => s + c.spesa, 0), impressioni: 0, clic: 0, conversioni: campagne.reduce((s, c) => s + c.conversioni, 0), valore: campagne.some((c) => c.valore != null) ? campagne.reduce((s, c) => s + (c.valore ?? 0), 0) : null }, prima: null, spesaMese: 0, giorni: [], campagne, aggiornato: '' });

describe('verdetti', () => {
	it('spinge chi rende sopra l\'obiettivo e propone +25% di budget', () => {
		const g = giudica(camp({ spesa: 300, conversioni: 12, valore: 1500 }), o, 30);
		expect(g.verdetto).toBe('scala'); expect(g.roas).toBe(5); expect(g.budgetProposto).toBe(25);
	});
	it('spegne chi spende tre volte il costo massimo senza ordini', () => {
		const g = giudica(camp({ spesa: 60, conversioni: 0 }), o, 30);
		expect(g.verdetto).toBe('spegni'); expect(g.budgetProposto).toBe(0);
	});
	it('osserva chi ha speso poco', () => {
		expect(giudica(camp({ spesa: 12 }), o, 30).verdetto).toBe('osserva');
	});
	it('stima il valore dove il canale non lo misura', () => {
		const g = giudica(camp({ canale: 'tiktok', spesa: 100, conversioni: 9, valore: null }), o, 30);
		expect(g.valoreStimato).toBe(true); expect(g.valore).toBe(405); expect(g.verdetto).toBe('scala');
	});
	it('continua chi è intorno all\'obiettivo, spegne chi è sotto la metà', () => {
		expect(giudica(camp({ spesa: 100, conversioni: 6, valore: 270 }), o, 30).verdetto).toBe('continua');
		expect(giudica(camp({ spesa: 100, conversioni: 2, valore: 90 }), o, 30).verdetto).toBe('spegni');
		expect(giudica(camp({ spesa: 100, conversioni: 4, valore: 180 }), o, 30).verdetto).toBe('osserva');
	});
	it('le campagne in pausa restano ferme e si segnala se andavano bene', () => {
		const g = giudica(camp({ stato: 'in_pausa', spesa: 200, conversioni: 10, valore: 800 }), o, 30);
		expect(g.verdetto).toBe('ferma'); expect(g.motivo).toContain('riattivarla');
	});
});

describe('budget', () => {
	it('per canale somma i budget proposti', () => {
		const a = analizzaCanale(dati([camp({ id: 'a', spesa: 300, conversioni: 12, valore: 1500 }), camp({ id: 'b', spesa: 60 })]), o);
		expect(a.budget.budgetGiorno).toBe(40); expect(a.budget.propostoGiorno).toBe(25); expect(a.migliori[0].id).toBe('a'); expect(a.daSpegnere[0].id).toBe('b');
	});
	it('con un tetto lo divide tra i canali in base al ritorno e la somma torna al tetto', () => {
		const meta = analizzaCanale(dati([camp({ spesa: 300, conversioni: 12, valore: 1500 })]), o);
		const google = analizzaCanale(dati([camp({ canale: 'google', spesa: 300, conversioni: 5, valore: 300 })], 'google'), o);
		const t = analizzaTutto([meta, google], { ...o, budgetMese: 1000 });
		expect(t.budget.totaleMese).toBe(1000);
		const m = t.budget.righe.find((r) => r.canale === 'meta')!, g = t.budget.righe.find((r) => r.canale === 'google')!;
		expect(m.propostoMese).toBeGreaterThan(g.propostoMese); expect(g.propostoMese).toBeGreaterThanOrEqual(100);
		expect(t.migliori[0].canale).toBe('meta');
	});
});

describe('casi visti sui dati veri di Meta (8/10/2026)', () => {
	it('una campagna di visibilità non si giudica sugli ordini', () => {
		const g = giudica(camp({ obiettivo: 'engagement', spesa: 659, clic: 8032, conversioni: 1, valore: 39 }), o, 30);
		expect(g.verdetto).toBe('continua'); expect(g.motivo).toContain('visibilità');
	});
	it('una campagna attiva senza spesa nel periodo non è "da osservare"', () => {
		const g = giudica(camp({ obiettivo: 'link clicks', spesa: 0, budgetGiorno: null }), o, 30);
		expect(g.verdetto).toBe('ferma');
	});
	it('una campagna vendite che rende 4× va spinta', () => {
		expect(giudica(camp({ obiettivo: 'sales', spesa: 606, clic: 2471, conversioni: 29, valore: 2515, budgetGiorno: null }), o, 30).verdetto).toBe('scala');
	});
});
