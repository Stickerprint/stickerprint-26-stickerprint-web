import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeTerms } from './payments';

const metodo = (over: object) => ({ name: 'M', xml_code: 'MP05', days: 30, end_of_month: false, installments: 1, ...over });
const scadenze = (over: object, data: string | Date, tot = 100) => computeTerms(metodo(over), tot, data).map((t) => t.due);

/* stesse scadenze in Italia (browser dello staff) e in UTC (server): prima uscivano diverse di un giorno */
describe.each(['Europe/Rome', 'UTC', 'America/New_York'])('scadenze di pagamento con il fuso %s', (fuso) => {
	const prima = process.env.TZ;
	beforeAll(() => { process.env.TZ = fuso; });
	afterAll(() => { process.env.TZ = prima; });

	it('fine mese piu\' i giorni', () => {
		expect(scadenze({ days: 30, end_of_month: true }, '2026-11-25')).toEqual(['2026-12-30']);
		expect(scadenze({ days: 60, end_of_month: true }, '2026-11-25')).toEqual(['2027-01-29']);
		expect(scadenze({ days: 30, end_of_month: true, installments: 2 }, '2026-11-25', 100)).toEqual(['2026-12-30', '2027-01-29']);
	});
	it('giorni dalla data del documento, anche a cavallo del cambio dell\'ora', () => {
		expect(scadenze({ days: 30 }, '2026-11-25')).toEqual(['2026-12-25']);
		expect(scadenze({ days: 150 }, '2026-11-25')).toEqual(['2027-04-24']);
		expect(scadenze({ days: 60 }, '2026-09-15')).toEqual(['2026-11-14']);
	});
	it('pagamento immediato: il giorno del documento', () => {
		expect(scadenze({ days: 0 }, '2026-11-25')).toEqual(['2026-11-25']);
		expect(scadenze({ days: 0 }, new Date(2026, 10, 25, 23, 30))).toEqual(['2026-11-25']);
		expect(scadenze({ days: 0 }, new Date(2026, 10, 25, 0, 30))).toEqual(['2026-11-25']);
	});
});
