import { describe, expect, it } from 'vitest';
import { monthKey } from './orders';
import { notaPreventivo, puoDiventareOrdine, quoteDate } from './richieste';

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

describe('preventivo → ordine', () => {
	it('si trasforma in ordine da bozza, inviato, accettato e scaduto', () => {
		for (const status of ['bozza', 'inviato', 'accettato', 'scaduto']) expect(puoDiventareOrdine({ status })).toBe(true);
	});
	it('non quello gia\' diventato ordine, rifiutato o sostituito da una revisione', () => {
		expect(puoDiventareOrdine({ status: 'ordinato', order_group: 'g1' })).toBe(false);
		expect(puoDiventareOrdine({ status: 'accettato', order_group: 'g1' })).toBe(false);
		expect(puoDiventareOrdine({ status: 'rifiutato', rejected_reason: 'Rifiutato dal cliente' })).toBe(false);
		expect(puoDiventareOrdine({ status: 'scaduto', rejected_reason: 'Sostituito dalla rev. 2' })).toBe(false);
	});
	it('la nota dell\'ordine dice a quale preventivo e\' collegato', () => {
		expect(notaPreventivo({ number: 'SPP00012', version: 1 })).toBe('Collegato al preventivo SPP00012');
		expect(notaPreventivo({ number: 'SPP00012', version: 3 })).toBe('Collegato al preventivo SPP00012 rev. 3');
	});
});
