import { describe, expect, it } from 'vitest';
import { clienteAzienda, metodoAbituale, scadenzeFattura, type PaymentMethod, type PaymentTerm } from './payments';

const m = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod => ({ id, name: id, xml_code: 'MP05', days: 0, end_of_month: false, installments: 1, paid_upfront: false, custom: false, active: true, sort: 0, ...over });
const bonifico = m('Bonifico anticipato', { paid_upfront: true });
const riba60 = m('RiBa 30 gg', { xml_code: 'MP12', days: 30 });
const rate = m('Rate personalizzate', { custom: true });
const metodi = [bonifico, riba60, rate];

describe('metodo di pagamento abituale del cliente', () => {
	it('vale solo per le aziende', () => {
		expect(clienteAzienda({ kind: 'azienda', vat: null })).toBe(true);
		expect(clienteAzienda({ kind: 'privato', vat: '01234567897' })).toBe(true);
		expect(clienteAzienda({ kind: 'privato', vat: ' ' })).toBe(false);
		expect(clienteAzienda(null)).toBe(false);
		expect(metodoAbituale({ kind: 'azienda', vat: '01234567897', payment_method_id: riba60.id }, metodi)).toBe(riba60);
		expect(metodoAbituale({ kind: 'privato', vat: null, payment_method_id: riba60.id }, metodi)).toBeNull();
	});
	it('niente metodo se non e\' scelto, non esiste piu\' o e\' stato disattivato', () => {
		expect(metodoAbituale({ kind: 'azienda', payment_method_id: null }, metodi)).toBeNull();
		expect(metodoAbituale({ kind: 'azienda', payment_method_id: 'cancellato' }, metodi)).toBeNull();
		expect(metodoAbituale({ kind: 'azienda', payment_method_id: riba60.id }, [bonifico, { ...riba60, active: false }])).toBeNull();
		/* anagrafica letta prima della migrazione 0064: il campo non c'e' */
		expect(metodoAbituale({ kind: 'azienda', vat: '01234567897' }, metodi)).toBeNull();
	});
});

describe('scadenze della fattura creata dai DDT', () => {
	const delDdt: PaymentTerm[] = [{ due: '2026-11-25', amount: 122, method: 'Bonifico anticipato', xml_code: 'MP05' }];
	const ripiego = () => [{ due: '2026-11-25', amount: 122, method: 'Ripiego', xml_code: 'MP05' }];
	it('con il metodo abituale le scadenze si calcolano su totale e data della fattura', () => {
		const r = scadenzeFattura({ abituale: riba60, pagato: false, delDdt, ripiego, totale: 122, data: '2026-11-25' });
		expect(r.daAnagrafica).toBe(true);
		expect(r.terms).toEqual([{ due: '2026-12-25', amount: 122, method: 'RiBa 30 gg', xml_code: 'MP12' }]);
	});
	it('ordine gia\' pagato: restano le scadenze dell\'ordine', () => {
		const r = scadenzeFattura({ abituale: riba60, pagato: true, delDdt, ripiego, totale: 122, data: '2026-11-25' });
		expect(r).toEqual({ terms: delDdt, daAnagrafica: false });
	});
	it('senza metodo abituale, o con le rate personalizzate, vale la regola di prima', () => {
		expect(scadenzeFattura({ abituale: null, pagato: false, delDdt, ripiego, totale: 122, data: '2026-11-25' })).toEqual({ terms: delDdt, daAnagrafica: false });
		expect(scadenzeFattura({ abituale: rate, pagato: false, delDdt, ripiego, totale: 122, data: '2026-11-25' })).toEqual({ terms: delDdt, daAnagrafica: false });
		expect(scadenzeFattura({ abituale: null, pagato: false, delDdt: null, ripiego, totale: 122, data: '2026-11-25' }).terms[0].method).toBe('Ripiego');
	});
});
