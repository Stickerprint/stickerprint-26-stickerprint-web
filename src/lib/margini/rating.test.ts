import { describe, expect, it } from 'vitest';
import { calcolaRating, commentoRegole, gradoDa, grado, SCALA, type InputRating } from './rating';

const base: InputRating = { mese: '2026-09', giorniTrascorsi: 30, giorniMese: 30, ordini: 40, ordiniSito: 30, daCompletare: 0, fatturato: 5000, calcolato: 5000, costoProduzione: 1500, ads: 500, fatturatoSito: 4000, prima: { calcolato: 4000, fatturato: 4000, giorni: 31, margineNettoPct: 50 } };

describe('scala', () => {
	it('soglie dalla AAA alla D, dieci gradi in ordine', () => {
		expect(SCALA.map((g) => g.lettera)).toEqual(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D']);
		expect(gradoDa(95).lettera).toBe('AAA');
		expect(gradoDa(90).lettera).toBe('AAA');
		expect(gradoDa(89.9).lettera).toBe('AA');
		expect(gradoDa(60).lettera).toBe('BBB');
		expect(gradoDa(9.9).lettera).toBe('D');
		expect(gradoDa(-5).lettera).toBe('D');
		expect(grado('XYZ').lettera).toBe('D');
	});
});

describe('calcolaRating', () => {
	it('mese sano: punti di ogni voce e lettera', () => {
		const r = calcolaRating(base);
		// margine dopo pubblicita' = (5000-1500-500)/5000 = 60% → 50 punti
		expect(r.metriche.margineNettoPct).toBe(60);
		expect(r.componenti.find((c) => c.id === 'margine')?.punti).toBe(50);
		// 4000/500 = 8 € per euro → pieno
		expect(r.componenti.find((c) => c.id === 'pubblicita')?.punti).toBe(20);
		// +10 punti di margine → (10+15)/30*15 = 12,5
		expect(r.componenti.find((c) => c.id === 'andamento_margine')?.punti).toBe(12.5);
		// fatturato al giorno 166,7 vs 129 → +29% → quasi pieno
		expect(r.componenti.find((c) => c.id === 'andamento_fatturato')!.punti).toBeGreaterThan(14);
		expect(r.lettera).toBe('AAA');
		expect(r.affidabilita).toBe('alta');
	});

	it('margine in perdita: D', () => {
		const r = calcolaRating({ ...base, costoProduzione: 3500, ads: 2500, fatturatoSito: 2000, prima: { ...base.prima!, margineNettoPct: 30 } });
		expect(r.metriche.margineNetto).toBe(-1000);
		expect(r.componenti.find((c) => c.id === 'margine')?.punti).toBe(0);
		expect(r.componenti.find((c) => c.id === 'pubblicita')?.punti).toBe(0);
		expect(['C', 'D']).toContain(r.lettera);
	});

	it('dati mancanti: la voce vale meta\' e lo dice', () => {
		const r = calcolaRating({ ...base, ads: null, prima: null });
		const pub = r.componenti.find((c) => c.id === 'pubblicita')!;
		expect(pub.punti).toBe(10);
		expect(pub.nota).toMatch(/metà/);
		expect(r.componenti.find((c) => c.id === 'andamento_margine')?.punti).toBe(7.5);
		expect(r.componenti.find((c) => c.id === 'andamento_fatturato')?.punti).toBe(7.5);
		expect(r.affidabilita).toBe('media');
		expect(r.motivoAffidabilita).toMatch(/pubblicità non leggibile/);
	});

	it('nessuna spesa pubblicitaria: rendimento pieno', () => {
		expect(calcolaRating({ ...base, ads: 0 }).componenti.find((c) => c.id === 'pubblicita')?.punti).toBe(20);
	});

	it('mese in corso: confronto al giorno e affidabilita\' bassa nei primi giorni', () => {
		const r = calcolaRating({ ...base, giorniTrascorsi: 5, fatturato: 1000, calcolato: 1000, costoProduzione: 300, ads: 100, fatturatoSito: 800 });
		expect(r.affidabilita).toBe('bassa');
		expect(r.motivoAffidabilita).toMatch(/5 giorni su 30/);
		// 200 €/giorno contro 129 €/giorno del mese prima: fatturato in crescita
		expect(r.metriche.deltaFatturatoPct!).toBeGreaterThan(0);
	});

	it('molto fatturato senza costo: affidabilita\' bassa', () => {
		const r = calcolaRating({ ...base, calcolato: 2500, daCompletare: 8 });
		expect(r.affidabilita).toBe('bassa');
		expect(r.motivoAffidabilita).toMatch(/50% del fatturato senza costo/);
	});
});

describe('commentoRegole', () => {
	it('pro, contro e considerazioni dai punti, con gli ordini da completare', () => {
		const x = { ...base, daCompletare: 2, ads: 2000, fatturatoSito: 2400 };
		const r = calcolaRating(x);
		const c = commentoRegole(r, x);
		expect(c.contro.join(' ')).toMatch(/Rendimento della pubblicità/);
		expect(c.contro.join(' ')).toMatch(/2 ordini sono senza misura/);
		expect(c.considerazioni).toMatch(new RegExp(`Rating ${r.lettera}`));
		expect(c.considerazioni).toMatch(/manodopera/);
	});
});
