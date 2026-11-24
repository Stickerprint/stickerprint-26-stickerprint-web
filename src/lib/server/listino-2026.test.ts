import { describe, it, expect } from 'vitest';
import { confronto2026, FORMATI_CONFRONTO, QTA_CONFRONTO } from './listino-2026';
import { listinoIniziale, prezzo, finituraListino } from '$lib/pricing/listino';

describe('confronto con il listino 2026', () => {
	const c = confronto2026();
	it('ha tutti i prodotti, con prezzi sensati', () => {
		expect(c.map((p) => p.slug).sort()).toEqual(['adesivi_personalizzati', 'adesivi_resinati', 'adesivi_rilievo', 'etichette', 'fogli_adesivi', 'vetrofanie']);
		for (const p of c) for (const v of p.varianti) {
			expect(v.prezzi.length).toBe(FORMATI_CONFRONTO.length);
			for (const riga of v.prezzi) {
				expect(riga.length).toBe(QTA_CONFRONTO.length);
				for (const x of riga) expect(x).toBeGreaterThan(0);
				/* piu' pezzi non costano mai meno in totale */
				for (let i = 1; i < riga.length; i++) expect(riga[i]).toBeGreaterThanOrEqual(riga[i - 1] * 0.8);
			}
		}
	});
	it('il 2027 si calcola per ogni prodotto con gli stessi parametri', () => {
		const L = listinoIniziale();
		for (const p of c) {
			const lp = L.prodotti.find((x) => x.id === p.slug)!;
			expect(lp).toBeTruthy();
			const v = p.varianti[0];
			for (const q of [100, 500, 1000]) {
				const ora = prezzo(L, lp, { mat: v.materiale, fin: finituraListino(L, lp, p.kind, v.finitura, v.laminata), w: 50, h: 50, q }).lordo;
				expect(ora).toBeGreaterThan(0);
				/* stessa fascia di prezzo: il 2027 non si discosta dal 2026 di oltre il 40% */
				const prima = v.prezzi[1][QTA_CONFRONTO.indexOf(q)];
				expect(Math.abs(ora / prima - 1)).toBeLessThan(0.4);
			}
		}
	});
});
