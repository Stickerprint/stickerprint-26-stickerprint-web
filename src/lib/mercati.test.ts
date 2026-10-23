import { describe, it, expect } from 'vitest';
import { zonaDi, ivaDi, valutaDi, paesiPer, capValido, SPEDIZIONE, costoSpedizioneUE } from './mercati';
import { shippingForCountry, shippingGrossFor } from './shipping-rules';
import { PRICE_BOOKS, toCurrency } from './i18n';

describe('mercati', () => {
	it('zona, IVA e valuta per paese', () => {
		expect(zonaDi('IT')).toBe('it'); expect(zonaDi('DE')).toBe('ue'); expect(zonaDi('US')).toBe('us'); expect(zonaDi(null)).toBe('it');
		expect(ivaDi('it')).toBe(0.22); expect(ivaDi('ue')).toBe(0.22); expect(ivaDi('us')).toBe(0);
		expect(valutaDi('ue')).toBe('EUR'); expect(valutaDi('us')).toBe('USD');
	});
	it('paesi per lingua: Italia sola, le lingue UE tutta la UE, USA soli', () => {
		expect(paesiPer('it')[0]).toBe('IT'); expect(paesiPer('it')).not.toContain('US');
		expect(paesiPer('de')[0]).toBe('DE'); expect(paesiPer('de')).toContain('FR'); expect(paesiPer('de')).not.toContain('US');
		expect(paesiPer('us')).toEqual(['US']);
		expect(paesiPer('en')).toContain('PT'); expect(paesiPer('en')).toContain('IT'); expect(paesiPer('en')).not.toContain('US');
	});
	it('codici postali', () => {
		expect(capValido('20121', 'IT')).toBe(true); expect(capValido('2012', 'IT')).toBe(false);
		expect(capValido('1012 AB', 'NL')).toBe(true); expect(capValido('75001', 'FR')).toBe(true);
		expect(capValido('90210', 'US')).toBe(true); expect(capValido('90210-1234', 'US')).toBe(true); expect(capValido('ABCDE', 'US')).toBe(false);
	});
});

describe('spedizione per zona', () => {
	it('Italia: come prima (province remote)', () => {
		expect(shippingForCountry(30, false, 'IT', 'MI')).toEqual({ gross: shippingGrossFor(30, false, 'MI'), zona: 'it', gratisDa: 50 });
		expect(shippingForCountry(60, false, 'IT', 'MI').gross).toBe(0);
	});
	it('UE: gratis da 69 €, altrimenti la tariffa', () => {
		expect(shippingForCountry(68.99, false, 'DE').gross).toBe(11.9);
		expect(shippingForCountry(68.99, false, 'PL').gross).toBe(14.9);
		expect(shippingForCountry(68.99, false, 'MT').gross).toBe(24.9);
		expect(costoSpedizioneUE('XX')).toBe(14.9);
		expect(shippingForCountry(69, false, 'DE').gross).toBe(0);
		expect(shippingForCountry(10, true, 'FR').gross).toBe(0);
	});
	it('USA: soglia in dollari sul netto, costo reso in euro netti', () => {
		const fx = PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup;
		/* 99 $ di prodotti = 99/fx euro netti = 99/fx*1.22 euro lordi */
		const lordoSoglia = (99 / fx) * 1.22;
		expect(shippingForCountry(lordoSoglia + 0.5, false, 'US').gross).toBe(0);
		const r = shippingForCountry(lordoSoglia - 5, false, 'US');
		expect(r.zona).toBe('us'); expect(r.gratisDa).toBe(99);
		expect(Math.round(r.gross * fx * 100) / 100).toBeCloseTo(SPEDIZIONE.us.costo, 1);
		const pr = shippingForCountry(lordoSoglia - 5, false, 'US', 'PR');
		expect(Math.round(pr.gross * fx * 100) / 100).toBeCloseTo(SPEDIZIONE.us.costoRemoto, 1);
	});
	it('toCurrency toglie l’IVA italiana prima del cambio', () => {
		expect(toCurrency(12.2, 'USD')).toBeCloseTo(10 * PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup, 1);
		expect(toCurrency(12.2, 'EUR')).toBe(12.2);
	});
});
