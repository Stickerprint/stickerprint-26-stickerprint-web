import { describe, expect, it } from 'vitest';
import * as T from './email-templates';
import { defaultQuoteEmail } from '$lib/dashboard/richieste';
import { defaultConfirmEmail } from '$lib/dashboard/conferme';
import { defaultInvoiceEmail } from '$lib/dashboard/fatture';

/* Mattia, 25/11/2026: al cliente non arriva mai il nome di chi segue l'ordine; si firma «Stickerprint-Staff» e si parla al plurale */
const CHI = 'Mario Bianchi';
const LINGUE = ['it', 'en', 'es', 'fr', 'de', 'nl'] as const;

describe('firma delle email al cliente', () => {
	it.each(LINGUE)('nessuna email porta il nome di chi segue (%s)', (lang) => {
		const email = [
			T.quoteEmail({ subject: 'Preventivo', message: 'Testo', senderName: CHI, number: 'SPP00001', validUntil: null, href: 'https://x/p' }, lang),
			T.quoteReminderEmail({ name: 'Anna', number: 'SPP00001', validUntil: null, href: 'https://x/p', senderName: CHI }, lang),
			T.quoteReplyEmail({ name: 'Anna', number: 'SPP00001', body: 'Risposta', author: CHI, href: 'https://x/p' }, lang),
			T.orderConfirmEmail({ subject: 'Conferma', message: 'Testo', senderName: CHI, number: 'SP00001', href: 'https://x/c', toPay: null }, lang),
			T.orderReplyEmail({ name: 'Anna', number: 'SP00001', body: 'Risposta', author: CHI, href: 'https://x/c' }, lang),
			T.orderPaymentReminderEmail({ name: 'Anna', number: 'SP00001', amount: '10,00 €', href: 'https://x/c', senderName: CHI }, lang),
			T.invoiceEmail({ subject: 'Fattura', message: 'Testo', senderName: CHI, number: 'SPF00001', href: 'https://x/f', toPay: null }, lang),
			T.invoiceReplyEmail({ name: 'Anna', number: 'SPF00001', body: 'Risposta', author: CHI, href: 'https://x/f' }, lang),
			T.ticketReplyEmail({ name: 'Anna', number: 'HD00001', body: 'Risposta', author: CHI, href: 'https://x/a' }, lang),
			T.requestReplyEmail({ name: 'Anna', body: 'Risposta', author: CHI }, lang)
		];
		for (const e of email) { expect(e.html).not.toContain(CHI); expect(e.html).toContain(T.FIRMA_STAFF); }
	});
	it('si firma anche quando il nome di chi scrive non c\'e\'', () => {
		expect(T.quoteEmail({ subject: 'Preventivo', message: 'Testo', senderName: null, number: 'SPP00001', validUntil: null, href: 'https://x/p' }).html).toContain('Stickerprint-Staff');
	});
});

describe('testi proposti allo staff: plurale e firma unica', () => {
	const cliente = { name: 'Azienda', first_name: 'Anna' };
	it('preventivo, conferma d\'ordine e fattura', () => {
		const p = defaultQuoteEmail({ number: 'SPP00001', draft: { customer: cliente, items: [{ description: 'Adesivi', qty: 100 }] } as never, total_gross: 100, valid_until: null }, CHI).body;
		const c = defaultConfirmEmail({ number: 'SP00001', customer: 'Azienda', items: [{ qty: 100, description: 'Adesivi', product_name: 'Adesivi', billing: { first_name: 'Anna' }, shipping: {} }] as never, gross: 122, delivery_date: null }, [], CHI).body;
		const f = defaultInvoiceEmail({ number: 'SPF00001', issued_at: '2026-11-25', amount_gross: 122, billing: { first_name: 'Anna' } }, [], CHI).body;
		for (const t of [p, c, f]) {
			expect(t).not.toContain(CHI);
			expect(t.trimEnd().endsWith('Stickerprint-Staff')).toBe(true);
			expect(t).not.toMatch(/scrivimi|segnalamelo|ti confermo\b|ti mando\b|ti seguo/);
		}
		expect(p).toContain('scrivici'); expect(c).toContain('ti confermiamo'); expect(f).toContain('ti mandiamo');
	});
});
