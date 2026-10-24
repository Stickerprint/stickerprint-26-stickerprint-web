import { describe, expect, it } from 'vitest';
import { LOCALES, paypalLocale } from './i18n';

describe('paypalLocale', () => {
	it('tiene il formato BCP-47 con il trattino', () => {
		expect(paypalLocale('it-IT')).toBe('it-IT');
		expect(paypalLocale('en-US')).toBe('en-US');
	});
	it('corregge l\'underscore (il formato di Stripe, che PayPal rifiuta: ticket HD00026)', () => {
		expect(paypalLocale('it_IT')).toBe('it-IT');
		expect(paypalLocale('en_IE')).toBe('en-IE');
	});
	it('fuori regola o vuoto ripiega su it-IT', () => {
		expect(paypalLocale('')).toBe('it-IT');
		expect(paypalLocale(undefined)).toBe('it-IT');
		expect(paypalLocale('italiano')).toBe('it-IT');
		expect(paypalLocale('IT-it')).toBe('it-IT');
	});
	it('tutte le lingue del sito passano la regola di PayPal', () => {
		for (const l of Object.values(LOCALES)) expect(paypalLocale(l.intl)).toBe(l.intl);
	});
});
