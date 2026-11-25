import { describe, expect, it } from 'vitest';
import { chiaveCliente, chiaveClienteOrdine, fatturabile, nonFatturabile, righeDaOrdini, totaliFattura } from './fattura-ordini';

const riga = (o: Record<string, unknown>) => ({ id: 'r', number: 'SP00726', product_slug: 'adesivi_personalizzati', product_name: 'Adesivi personalizzati', product_code: 'STK', description: 'Sticker 60×50 mm', qty: 50, unit_net: 0.4, total_net: 20, status: 'in_produzione', channel: 'manuale', billing: { company: 'Reforme Srl', vat: 'IT01234567897' }, ...o });
const ordine = (key: string, number: string, items: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ key, number, customer: 'Reforme Srl', status: 'in_produzione', items: items.map((i) => riga({ number, ...i })), ...extra }) as never;

describe('fattura da ordini', () => {
	it('stesso cliente: stessa partita IVA, con o senza IT; senza partita IVA vale il nome', () => {
		expect(chiaveCliente({ vat: 'IT01234567897' }, 'A')).toBe(chiaveCliente({ vat: '0123 4567897' }, 'B'));
		expect(chiaveCliente({ vat: '01234567897' }, 'A')).not.toBe(chiaveCliente({ vat: '11308040960' }, 'A'));
		expect(chiaveCliente({ company: 'Reforme Srl' }, null)).toBe(chiaveCliente(null, 'REFORME SRL'));
		expect(chiaveClienteOrdine(ordine('a', 'SP00726', [{}]))).toBe('vat:01234567897');
	});
	it('si spuntano solo gli ordini inseriti a mano, senza fattura e non annullati', () => {
		const o = (extra: Record<string, unknown> = {}, items: Record<string, unknown>[] = [{}]) => ordine('a', 'SP00726', items, { channel: 'manuale', status: 'consegnato', ...extra });
		expect(fatturabile(o(), {})).toBe(true);
		expect(nonFatturabile(o(), { a: 'SPF00500' })).toBe('Fattura SPF00500');
		expect(fatturabile(o({ status: 'annullato' }), {})).toBe(false);
	});
	it('restano fuori gli ordini fatturati altrove: Fatture in Cloud, vecchio sito, checkout del sito', () => {
		const o = (extra: Record<string, unknown> = {}, items: Record<string, unknown>[] = [{}]) => ordine('a', 'SP00602', items, { channel: 'manuale', status: 'consegnato', ...extra });
		expect(nonFatturabile(o({}, [{ internal_notes: 'Importato da Fatture in Cloud il 31/10/2026 · Ordine FIC n. 214' }]), {})).toMatch(/Fatture in Cloud/);
		expect(nonFatturabile(o({}, [{ legacy_id: 412 }]), {})).toMatch(/vecchio sito/);
		expect(nonFatturabile(ordine('legacy-SPIT00364', 'SPIT00364', [{}], { channel: 'manuale', status: 'consegnato' }), {})).toMatch(/vecchio sito/);
		expect(nonFatturabile(o({ channel: 'ecommerce' }), {})).toMatch(/checkout/);
		/* una nota normale non blocca */
		expect(fatturabile(o({}, [{ internal_notes: 'Collegato al preventivo SPP00637' }]), {})).toBe(true);
	});
	it('un ordine solo: le righe sono quelle dell\'ordine', () => {
		const r = righeDaOrdini([ordine('a', 'SP00726', [{}, { description: 'Sticker 40×40 mm', qty: 100, unit_net: 0.3, total_net: 30 }])]);
		expect(r).toHaveLength(2);
		expect(r[0]).toMatchObject({ code: 'STK', description: 'Adesivi personalizzati · Sticker 60×50 mm', qty: 50, unit_net: 0.4, total_net: 20, ddt: null });
		expect(totaliFattura(r)).toEqual({ imponibile: 50, iva: 11, totale: 61 });
	});
	it('piu\' ordini: ogni riga dice da quale ordine arriva; con il DDT porta il DDT', () => {
		const r = righeDaOrdini([ordine('a', 'SP00726', [{}]), ordine('b', 'SP00730', [{}]), ordine('c', 'SP00731', [{}])], { b: { number: 'SPD00040', issued_at: '2026-11-20' } });
		expect(r.map((x) => x.description)).toEqual(['Adesivi personalizzati · Sticker 60×50 mm (ordine SP00726)', 'Adesivi personalizzati · Sticker 60×50 mm', 'Adesivi personalizzati · Sticker 60×50 mm (ordine SP00731)']);
		expect(r[1]).toMatchObject({ ddt: 'SPD00040', ddt_date: '2026-11-20' });
		expect(r[0].ddt).toBeNull();
	});
	it('le righe annullate restano fuori e i centesimi tornano', () => {
		const r = righeDaOrdini([ordine('a', 'SP00726', [{ qty: 3, unit_net: 0.3333, total_net: 1 }, { status: 'annullato' }])]);
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({ unit_net: 0.3333, total_net: 1 });
		expect(totaliFattura(r)).toEqual({ imponibile: 1, iva: 0.22, totale: 1.22 });
	});
});
