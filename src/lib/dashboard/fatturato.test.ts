import { describe, expect, it } from 'vitest';
import { canaleFattura, fatturatoOrdiniPerMese, fatturatoPerMese, mediaOrdineEcommerce, nettoFattura, sommaMesi, type FatturaRiga } from './fatturato';
import { ultimiMesi, piuGiorni, inizioGiornoRoma, offsetRomaMinuti } from './tempo';

const f = (p: Partial<FatturaRiga>): FatturaRiga => ({ number: 'SPF00001', issued_at: '2026-10-01', subtotal_net: 100, discount_net: 0, express_net: 0, amount_gross: 122, payment_method: 'stripe', ...p });

describe('canaleFattura', () => {
	it('stripe/paypal e il credito del sito sono e-commerce', () => {
		expect(canaleFattura(f({ payment_method: 'stripe' }))).toBe('ecommerce');
		expect(canaleFattura(f({ payment_method: 'PayPal' }))).toBe('ecommerce');
		expect(canaleFattura(f({ payment_method: 'credito' }))).toBe('ecommerce');
	});
	it('con un DDT o un pagamento manuale e\' manuale', () => {
		expect(canaleFattura(f({ payment_method: 'Ricevuta bancaria 60 gg f.m.' }))).toBe('manuale');
		expect(canaleFattura(f({ payment_method: 'stripe', ddt_numbers: ['SPD00017'] }))).toBe('manuale');
		expect(canaleFattura(f({ payment_method: null, ddt_number: 'SPD00001' }))).toBe('manuale');
	});
	it('il gruppo di checkout vince sul metodo sconosciuto', () => {
		expect(canaleFattura(f({ payment_method: 'Bonifico', checkout_group: 'abc' }))).toBe('ecommerce');
	});
});

describe('fatturatoPerMese', () => {
	it('somma il netto per mese e canale, lascia a zero i mesi vuoti', () => {
		const mesi = ultimiMesi('2026-10', 3);
		expect(mesi).toEqual(['2026-08', '2026-09', '2026-10']);
		const out = fatturatoPerMese([
			f({ issued_at: '2026-09-30', subtotal_net: 4692.7, payment_method: 'Ricevuta bancaria 60 gg f.m.', ddt_numbers: ['SPD00017'] }),
			f({ issued_at: '2026-10-01', subtotal_net: 60, discount_net: 6, express_net: 2 }),
			f({ issued_at: '2026-10-02', subtotal_net: 40 }),
			f({ issued_at: '2026-07-15', subtotal_net: 999 })
		], mesi);
		expect(out[0]).toMatchObject({ mese: '2026-08', totale: 0, fatture: 0 });
		expect(out[1]).toMatchObject({ mese: '2026-09', manuale: 4692.7, ecommerce: 0, fattureManuali: 1 });
		expect(out[2]).toMatchObject({ mese: '2026-10', ecommerce: 96, manuale: 0, fatture: 2, fattureEcommerce: 2 });
		expect(sommaMesi(out)).toMatchObject({ totale: 4788.7, fatture: 3 });
	});
	it('nettoFattura = imponibile - sconto + express', () => {
		expect(nettoFattura(f({ subtotal_net: 60, discount_net: 6, express_net: 2 }))).toBe(56);
	});
});

describe('tempo', () => {
	it('ultimiMesi attraversa l\'anno', () => { expect(ultimiMesi('2026-01', 3)).toEqual(['2025-11', '2025-12', '2026-01']); });
	it('piuGiorni', () => { expect(piuGiorni('2026-10-31', 1)).toBe('2026-11-01'); expect(piuGiorni('2026-03-01', -1)).toBe('2026-02-28'); });
	it('la mezzanotte italiana e\' alle 22 o 23 UTC del giorno prima', () => {
		expect(inizioGiornoRoma('2026-10-14').toISOString()).toBe('2026-10-13T22:00:00.000Z');
		expect(inizioGiornoRoma('2026-12-14').toISOString()).toBe('2026-12-13T23:00:00.000Z');
		expect(offsetRomaMinuti(new Date('2026-07-01T12:00:00Z'))).toBe(120);
	});
});

describe('mediaOrdineEcommerce', () => {
	it('divide il netto e-commerce per le sue fatture, le manuali non contano', () => {
		const [m] = fatturatoPerMese([f({ subtotal_net: 40, discount_net: 5, express_net: 0 }), f({ subtotal_net: 60, express_net: 10 }), f({ subtotal_net: 500, payment_method: 'Bonifico' })], ['2026-10']);
		expect(mediaOrdineEcommerce(m)).toBe(52.5);
	});
	it('senza ordini e-commerce non inventa un numero', () => {
		const [m] = fatturatoPerMese([f({ payment_method: 'Bonifico' })], ['2026-10']);
		expect(mediaOrdineEcommerce(m)).toBeNull();
	});
});

describe('fatturatoOrdiniPerMese', () => {
	it('somma il netto degli ordini per mese e canale, gli annullati non contano', () => {
		const out = fatturatoOrdiniPerMese([
			{ mese: '2026-01', channel: 'manuale', status: 'consegnato', net: 2135.1 },
			{ mese: '2026-01', channel: 'manuale', status: 'consegnato', net: 6270 },
			{ mese: '2026-02', channel: 'ecommerce', status: 'in_produzione', net: 76.23 },
			{ mese: '2026-02', channel: 'manuale', status: 'annullato', net: 999 },
			{ mese: '2025-12', channel: 'manuale', status: 'consegnato', net: 5 }
		], ['2026-01', '2026-02', '2026-03']);
		expect(out[0]).toMatchObject({ mese: '2026-01', manuale: 8405.1, ecommerce: 0, totale: 8405.1, fatture: 2, fattureManuali: 2 });
		expect(out[1]).toMatchObject({ mese: '2026-02', ecommerce: 76.23, manuale: 0, fatture: 1, fattureEcommerce: 1 });
		expect(out[2]).toMatchObject({ mese: '2026-03', totale: 0, fatture: 0 });
		expect(sommaMesi(out)).toMatchObject({ totale: 8481.33, fatture: 3 });
	});
});
