import { describe, expect, it } from 'vitest';
import { METODO_PREVENTIVI, metodoAnticipato } from './payments';
import { defaultQuoteEmail } from './richieste';
import { defaultConfirmEmail } from './conferme';
import { t } from '$lib/traduzioni';

/* Mattia, 25/11/2026: nei preventivi si propone «Pagamento anticipato»; il cliente deve leggere come si paga e
   che l'ordine parte da solo a saldo avvenuto */
describe('pagamento anticipato', () => {
	const bozza = (metodo: string) => ({ customer: { name: 'Azienda', first_name: 'Anna' }, items: [{ description: 'Adesivi', qty: 100 }], terms: [{ method: metodo }] }) as never;
	it('il metodo dei preventivi e\' anticipato; quelli a scadenza no', () => {
		expect(METODO_PREVENTIVI).toBe('Pagamento anticipato');
		expect(metodoAnticipato(METODO_PREVENTIVI)).toBe(true);
		expect(metodoAnticipato('Bonifico anticipato')).toBe(true);
		expect(metodoAnticipato('Bonifico bancario vista fattura')).toBe(false);
		expect(metodoAnticipato('Ricevuta bancaria 30 gg f.m.')).toBe(false);
	});
	it('l\'email del preventivo dice come si paga solo con il pagamento anticipato', () => {
		const frase = 'Puoi pagare con carta di credito, PayPal o bonifico bancario: una volta saldato, il tuo ordine entrerà automaticamente in produzione.';
		expect(defaultQuoteEmail({ number: 'SPP00001', draft: bozza('Pagamento anticipato'), total_gross: 100, valid_until: null }).body).toContain(frase);
		expect(defaultQuoteEmail({ number: 'SPP00001', draft: bozza('Ricevuta bancaria 30 gg f.m.'), total_gross: 100, valid_until: null }).body).not.toContain('Puoi pagare');
	});
	it('la conferma d\'ordine con un anticipo da pagare lo dice allo stesso modo', () => {
		const g = { number: 'SP00001', customer: 'Azienda', items: [{ qty: 100, description: 'Adesivi', product_name: 'Adesivi', billing: { first_name: 'Anna' }, shipping: {} }] as never, gross: 122, delivery_date: null };
		const anticipo = [{ seq: 1, upfront: true, status: 'da_pagare', amount: 122 }] as never;
		expect(defaultConfirmEmail(g, anticipo).body).toMatch(/Puoi pagare con carta di credito, PayPal o bonifico bancario.*una volta saldato, il tuo ordine entrerà automaticamente in produzione/);
		expect(defaultConfirmEmail(g, []).body).not.toContain('Puoi pagare');
	});
	it.each(['it', 'us', 'es', 'fr', 'de', 'nl'] as const)('bonifico: causale e avviso sull\'accredito ci sono in ogni lingua (%s)', (locale) => {
		const causale = t(locale, 'account.doc.causaleOrdine', { n: 'SP00725' });
		expect(causale).toContain('SP00725'); expect(causale).not.toContain('account.');
		const avviso = t(locale, 'account.doc.bonificoAccredito', { causale });
		expect(avviso).toContain(causale); expect(avviso).not.toContain('account.');
		expect(t(locale, 'email.ordinePreventivo.comePagare')).toMatch(/PayPal/);
	});
});
