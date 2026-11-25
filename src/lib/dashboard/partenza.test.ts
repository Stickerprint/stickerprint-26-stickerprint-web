import { describe, expect, it } from 'vitest';
import { giornoFra, partenzaDi, partonoIl } from './orders';

describe('filtro data partenza', () => {
	it('oggi, domani e dopodomani sono giorni di calendario, anche a cavallo di mese e anno', () => {
		const sera = new Date(2026, 10, 25, 23, 30);
		expect(giornoFra(0, sera)).toBe('2026-11-25');
		expect(giornoFra(1, sera)).toBe('2026-11-26');
		expect(giornoFra(2, sera)).toBe('2026-11-27');
		expect(giornoFra(1, new Date(2026, 10, 30, 8, 0))).toBe('2026-12-01');
		expect(giornoFra(2, new Date(2026, 11, 30, 0, 5))).toBe('2027-01-01');
	});

	it('la partenza e\' la data promessa, altrimenti la spedizione prevista dell\'ordine manuale', () => {
		expect(partenzaDi({ shipBy: '2026-11-25', delivery_date: '2026-11-28' })).toBe('2026-11-25');
		expect(partenzaDi({ shipBy: null, delivery_date: '2026-11-28' })).toBe('2026-11-28');
		expect(partenzaDi({ shipBy: null, delivery_date: '2026-11-28T00:00:00+00:00' })).toBe('2026-11-28');
		expect(partenzaDi({ shipBy: null, delivery_date: null })).toBeNull();
	});

	it('nel giorno entrano gli ordini con quella data, di qualsiasi stato tranne gli annullati', () => {
		const g = [
			{ n: 'a', shipBy: '2026-11-25', delivery_date: null, status: 'in_produzione' },
			{ n: 'b', shipBy: '2026-11-25', delivery_date: null, status: 'spedito' },
			{ n: 'c', shipBy: '2026-11-25', delivery_date: null, status: 'annullato' },
			{ n: 'd', shipBy: '2026-11-26', delivery_date: null, status: 'in_produzione' },
			{ n: 'e', shipBy: null, delivery_date: '2026-11-25', status: 'in_attesa' },
			{ n: 'f', shipBy: null, delivery_date: null, status: 'in_produzione' },
			{ n: 'g', shipBy: '2026-11-24', delivery_date: null, status: 'in_produzione' }
		];
		expect(partonoIl(g, '2026-11-25').map((x) => x.n)).toEqual(['a', 'b', 'e']);
		expect(partonoIl(g, '2026-11-26').map((x) => x.n)).toEqual(['d']);
		expect(partonoIl(g, '2026-11-27')).toEqual([]);
	});
});
