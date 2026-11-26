import { describe, expect, it } from 'vitest';
import { convertitore, dataCliente, formatoValuta, linguaDaPaese, linguaOrdine, linguaPreventivo, pagatoInValuta, ripartisci } from './lingua-cliente';
import { defaultQuoteEmail } from './dashboard/richieste';
import { defaultConfirmEmail } from './dashboard/conferme';
import { defaultInvoiceEmail } from './dashboard/fatture';

/* Regola di Mattia del 26/11/2026: tutto quello che riceve il cliente e' nella sua lingua (e in dollari se ha pagato in dollari) */
describe('lingua del cliente', () => {
	it('dal paese: lingua del sito di quel paese, inglese per gli altri, italiano per Italia e paesi del sito italiano', () => {
		expect(linguaDaPaese('IT')).toBe('it');
		expect(linguaDaPaese('')).toBe('it');
		expect(linguaDaPaese(null)).toBe('it');
		expect(linguaDaPaese('CH')).toBe('it');
		expect(linguaDaPaese('de')).toBe('de');
		expect(linguaDaPaese('AT')).toBe('de');
		expect(linguaDaPaese('BE')).toBe('fr');
		expect(linguaDaPaese('US')).toBe('en');
		expect(linguaDaPaese('PT')).toBe('en');
	});
	it('il paese scritto per esteso in un\'anagrafica inserita a mano', () => {
		expect(linguaDaPaese('Germania')).toBe('de');
		expect(linguaDaPaese('Italia')).toBe('it');
		expect(linguaDaPaese('France')).toBe('fr');
		expect(linguaDaPaese('Paesi Bassi')).toBe('nl');
		/* un nome che non conosciamo resta italiano: meglio che scrivere in inglese a un italiano */
		expect(linguaDaPaese('Lombardia')).toBe('it');
	});
	it('ordine del sito: la lingua del sito da cui ha ordinato', () => {
		expect(linguaOrdine({ channel: 'ecommerce', locale: 'us', billing: { country: 'US' } })).toEqual({ lang: 'en', locale: 'us' });
		expect(linguaOrdine({ channel: 'ecommerce', locale: 'de', billing: { country: 'AT' } })).toEqual({ lang: 'de', locale: 'de' });
		/* chi ha scelto il sito italiano resta in italiano anche con un indirizzo estero */
		expect(linguaOrdine({ channel: 'ecommerce', locale: 'it', billing: { country: 'DE' } })).toEqual({ lang: 'it', locale: 'it' });
	});
	it('ordine inserito da noi: la colonna locale vale «it» di default, decide il paese di fatturazione', () => {
		expect(linguaOrdine({ channel: 'manuale', locale: 'it', billing: { country: 'DE' } })).toEqual({ lang: 'de', locale: 'de' });
		expect(linguaOrdine({ channel: 'manuale', locale: 'it', billing: { country: 'IT' } })).toEqual({ lang: 'it', locale: 'it' });
		expect(linguaOrdine({ channel: 'manuale', locale: 'it', billing: {}, shipping: { country: 'FR' } })).toEqual({ lang: 'fr', locale: 'fr' });
		/* un inglese nato da noi e' quello in euro, mai i dollari */
		expect(linguaOrdine({ channel: 'manuale', locale: 'it', billing: { country: 'SE' } })).toEqual({ lang: 'en', locale: 'en' });
		/* ordine nato da un preventivo confermato dalla pagina in tedesco: la lingua scritta sull'ordine vale */
		expect(linguaOrdine({ channel: 'manuale', locale: 'de', billing: { country: 'IT' } })).toEqual({ lang: 'de', locale: 'de' });
		expect(linguaOrdine(null)).toEqual({ lang: 'it', locale: 'it' });
	});
	it('preventivo: il paese dell\'anagrafica, o la lingua indicata nella bozza', () => {
		expect(linguaPreventivo({ customer: { country: 'ES' } }).lang).toBe('es');
		expect(linguaPreventivo({ customer: { country: 'IT' } }).lang).toBe('it');
		expect(linguaPreventivo({ lang: 'fr', customer: { country: 'IT' } }).lang).toBe('fr');
	});
});

describe('valuta del cliente', () => {
	it('pagato in dollari: somma delle righe dell\'ordine; in euro niente', () => {
		expect(pagatoInValuta([{ currency: 'USD', total_paid_currency: 50.1 }, { currency: 'USD', total_paid_currency: 43.96 }])).toEqual({ currency: 'USD', amount: 94.06 });
		expect(pagatoInValuta([{ currency: 'EUR', total_paid_currency: 87.09 }])).toBeNull();
		expect(pagatoInValuta([{ currency: 'USD', total_paid_currency: null }])).toBeNull();
	});
	it('la ripartizione torna sempre al centesimo', () => {
		for (const [importi, totale] of [[[10, 20, 33.33], 77.77], [[1, 1, 1], 10], [[0.01, 99.99], 123.45], [[87.09], 94.06]] as [number[], number][]) {
			const r = ripartisci(importi, totale);
			expect(Math.round(r.reduce((s, v) => s + v, 0) * 100) / 100).toBe(totale);
		}
	});
	it('convertitore: senza valuta estera lascia gli euro', () => {
		expect(convertitore(null, 100).currency).toBe('EUR');
		expect(convertitore(null, 100).conv(12.345)).toBe(12.35);
		const V = convertitore({ currency: 'USD', amount: 123.2 }, 100);
		expect(V.currency).toBe('USD');
		expect(V.conv(50)).toBe(61.6);
	});
	it('formati: i dollari all\'americana, gli euro nel formato della lingua, le date col mese scritto', () => {
		expect(formatoValuta(94.06, 'USD', 'en')).toBe('$94.06');
		expect(formatoValuta(1234.5, 'EUR', 'de').replace(/\s/g, ' ')).toBe('1.234,50 €');
		expect(dataCliente('2026-11-08', 'en', 'breve')).toBe('8 Nov 2026');
		expect(dataCliente('2026-11-08', 'de')).toBe('8. November 2026');
		expect(dataCliente(null, 'de')).toBeNull();
	});
});

/* Intl mette spazi non separabili fra numero e simbolo: nei confronti si leggono come spazi normali */
const sp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
describe('testi proposti allo staff, nella lingua del cliente', () => {
	const bozza = (country: string, metodo = 'Pagamento anticipato') => ({ customer: { name: 'Muster GmbH', first_name: 'Anna', country }, items: [{ description: 'Aufkleber 50×50', qty: 100, price: 1 }], terms: [{ method: metodo, due: '2026-12-01', amount: 122 }] }) as never;
	it('preventivo per un cliente tedesco: in tedesco, con la firma di sempre', () => {
		const p = defaultQuoteEmail({ number: 'SPP00001', draft: bozza('DE'), total_gross: 122, valid_until: null });
		expect(p.subject).toBe('Dein Angebot SPP00001: Aufkleber 50×50');
		expect(p.body).toContain('Hallo Anna,');
		expect(p.body).toContain('Kreditkarte, PayPal oder Banküberweisung');
		expect(p.body).toContain('Stickerprint-Staff');
		expect(p.body).not.toMatch(/Ciao|preventivo/);
	});
	it('preventivo per un cliente italiano: identico a prima', () => {
		const p = defaultQuoteEmail({ number: 'SPP00001', draft: bozza('IT'), total_gross: 122, valid_until: null });
		expect(p.subject).toBe('Il tuo preventivo SPP00001: Aufkleber 50×50');
		expect(p.body).toBe('Ciao Anna,\n\nti abbiamo finalmente preparato il preventivo richiesto: lo trovi nel link qui sotto, con tutti i dettagli.\nPer confermarlo basta un clic dalla pagina. Puoi pagare con carta di credito, PayPal o bonifico bancario: una volta saldato, il tuo ordine entrerà automaticamente in produzione.\nSe qualcosa non torna scrivici pure.\n\nA presto,\nStickerprint-Staff');
	});
	it('conferma d\'ordine: francese per un ordine inserito da noi con fatturazione in Francia, senza «TTC» se e\' senza IVA', () => {
		const g = { number: 'SP00001', customer: 'Exemple SARL', gross: 100, delivery_date: '2026-12-04', items: [{ qty: 500, description: 'Stickers ronds', product_name: 'Adesivi', channel: 'manuale', locale: 'it', vat_rate: 0, billing: { first_name: 'Luc', country: 'FR' }, shipping: {} }] } as never;
		const c = defaultConfirmEmail(g, []);
		expect(c.subject).toBe('Votre confirmation de commande SP00001 : Stickers ronds');
		expect(c.body).toContain('Bonjour Luc,');
		expect(sp(c.body)).toContain('total 100,00 €, expédition prévue le 4 décembre 2026');
		expect(c.body).not.toContain('TTC');
		expect(c.body).toContain('La commande est déjà en production.');
	});
	it('conferma d\'ordine italiana: identica a prima', () => {
		const g = { number: 'SP00001', customer: 'Azienda', gross: 122, delivery_date: null, items: [{ qty: 100, description: 'Adesivi', product_name: 'Adesivi', channel: 'manuale', locale: 'it', billing: { first_name: 'Anna', country: 'IT' }, shipping: {} }] } as never;
		expect(sp(defaultConfirmEmail(g, []).body)).toBe('Ciao Anna,\n\nti confermiamo l\'ordine SP00001 per 100 Adesivi, totale 122,00 € IVA inclusa. Dal bottone qui sotto puoi controllare tutti i dettagli (articoli, indirizzi, scadenze) e scaricare il PDF.\n\nL\'ordine è già in lavorazione.\n\nSe qualcosa non torna, segnalacelo direttamente dalla pagina: lo sistemiamo prima di stampare.\n\nA presto,\nStickerprint-Staff');
	});
	it('fattura pagata in dollari: in inglese e col totale in dollari', () => {
		const f = defaultInvoiceEmail({ number: 'SPF00476', issued_at: '2026-11-08', amount_gross: 87.09, vat_rate: 0, billing: { first_name: 'John', country: 'US' }, order_numbers: ['SP00500'] }, [], null, { lang: 'en', valuta: 'USD', importo: 94.06 });
		expect(f.subject).toBe('Your Stickerprint invoice SPF00476');
		expect(f.body).toContain('Hi John,');
		expect(f.body).toContain('invoice SPF00476 dated 8 November 2026 for order SP00500, total $94.06.');
		expect(f.body).not.toContain('87');
		expect(f.body).not.toContain('VAT');
		expect(f.body).toContain('already paid');
	});
	it('fattura italiana: identica a prima', () => {
		const f = defaultInvoiceEmail({ number: 'SPF00001', issued_at: '2026-11-25', amount_gross: 122, billing: { first_name: 'Anna' } }, []);
		expect(sp(f.body)).toBe('Ciao Anna,\n\nti mandiamo la fattura SPF00001 del 25 novembre, totale 122,00 € IVA inclusa. Dal bottone qui sotto la vedi nel dettaglio e scarichi il PDF.\n\nLa fattura risulta già saldata: è solo per i tuoi archivi.\n\nPer qualsiasi cosa (intestazione, importi, scadenze) scrivici dalla pagina o rispondi a questa email.\n\nGrazie e a presto,\nStickerprint-Staff');
	});
});
