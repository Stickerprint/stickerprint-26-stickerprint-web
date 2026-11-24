import { describe, expect, it } from 'vitest';
import { monthKey } from './orders';
import { quoteDate } from './richieste';

describe('quoteDate', () => {
	it('usa la data scritta sul preventivo, non il giorno di inserimento', () => {
		// preventivo di gennaio importato da Fatture in Cloud il 31 ottobre
		const q = { draft: { date: '2026-01-09' }, created_at: '2026-10-31T15:20:11.000Z' };
		expect(quoteDate(q)).toBe('2026-01-09');
		expect(monthKey(quoteDate(q), 2026)).toBe('0');
	});
	it('senza data nella bozza torna al giorno di inserimento', () => {
		expect(quoteDate({ draft: { date: '' }, created_at: '2026-11-03T09:00:00.000Z' })).toBe('2026-11-03T09:00:00.000Z');
		expect(quoteDate({ draft: null, created_at: '2026-11-03T09:00:00.000Z' })).toBe('2026-11-03T09:00:00.000Z');
		expect(quoteDate({ draft: { date: 'ieri' }, created_at: '2026-11-03T09:00:00.000Z' })).toBe('2026-11-03T09:00:00.000Z');
	});
	it('un preventivo datato in un altro anno finisce in Preced. o Succ.', () => {
		expect(monthKey(quoteDate({ draft: { date: '2025-12-20' }, created_at: '2026-10-31T15:20:11.000Z' }), 2026)).toBe('prev');
	});
});
