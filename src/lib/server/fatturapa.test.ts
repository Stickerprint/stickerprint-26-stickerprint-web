import { describe, expect, it } from 'vitest';
import { buildFatturaPaXml, spezza200 } from './fatturapa';

const causali = (xml: string) => [...xml.matchAll(/<Causale>(.*?)<\/Causale>/g)].map((m) => m[1]);

describe('spezza200', () => {
	it('lascia intatto un testo corto', () => {
		expect(spezza200('Pagamento: Bonifico')).toEqual(['Pagamento: Bonifico']);
	});
	it('spezza alle virgole senza superare 200 caratteri', () => {
		const ddt = Array.from({ length: 40 }, (_, i) => `SPD${String(i + 1).padStart(5, '0')}`);
		const pezzi = spezza200(`DDT collegati: ${ddt.join(', ')}`);
		expect(pezzi.length).toBeGreaterThan(1);
		for (const p of pezzi) expect(p.length).toBeLessThanOrEqual(200);
		expect(pezzi.join(' ').replace(/\s+/g, ' ')).toBe(`DDT collegati: ${ddt.join(', ')}`);
	});
	it('non si blocca su un testo senza spazi', () => {
		const pezzi = spezza200('x'.repeat(450));
		expect(pezzi.map((p) => p.length)).toEqual([200, 200, 50]);
	});
});

describe('buildFatturaPaXml / Causale', () => {
	const base = { issued_at: '2026-09-30', email: null, billing: { company: 'METRICA S.p.A.', vat: '00584770242', fiscal_code: '00584770242', sdi: 'KNRN57R', street: 'Via Grandi, 18', zip: '20098', city: 'San Giuliano Milanese', province: 'MI', country: 'IT' }, discount_net: 0, express_net: 0, credit_used: 0, vat_amount: 22, amount_gross: 122, payment_method: 'Ricevuta bancaria 60 gg f.m.' };
	it('con 10 DDT e 10 ordini (caso SPF00362, scartata dallo SDI) ogni Causale sta nei 200 caratteri', () => {
		const ddt = Array.from({ length: 10 }, (_, i) => `SPD000${17 + i}`);
		const ordini = Array.from({ length: 10 }, (_, i) => `SP00${364 + i}`);
		const { xml } = buildFatturaPaXml({ ...base, number: 'SPF00362', lines: ddt.map((d) => ({ description: 'Etichette', qty: 10, unit_net: 1, total_net: 10, ddt: d, ddt_date: '2026-09-30' })), ddt_numbers: ddt, order_numbers: ordini }, '00362');
		const c = causali(xml);
		expect(c.length).toBe(3);
		for (const t of c) expect(t.length).toBeLessThanOrEqual(200);
		expect(c[0]).toContain('DDT collegati: SPD00017');
		expect(c[1]).toContain('Ordine SP00364');
		expect(c[2]).toBe('Pagamento: Ricevuta bancaria 60 gg f.m.');
	});
	it('senza DDT, ordini e pagamento scrive Vendita', () => {
		const { xml } = buildFatturaPaXml({ ...base, number: 'SPF00001', payment_method: null, lines: [{ description: 'Adesivi', qty: 1, unit_net: 100, total_net: 100 }] }, '00001');
		expect(causali(xml)).toEqual(['Vendita']);
	});
});
