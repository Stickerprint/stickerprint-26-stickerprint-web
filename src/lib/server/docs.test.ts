import { describe, expect, it } from 'vitest';
import { buildOrderPdf, nomePaese, winAnsi } from './docs';
import { metodoTradotto, paymentLabelFor } from '$lib/dashboard/payments';

/* Documenti per i clienti esteri (26/11/2026): un nome con lettere fuori da WinAnsi non deve fermare il PDF,
   e quello che nel documento era rimasto in italiano (paese, metodo di pagamento) esce nella lingua del cliente */
describe('testo dei PDF', () => {
	it('i caratteri che Helvetica non ha diventano il piu\' vicino, mai un errore', () => {
		expect(winAnsi('Łódź Dvořák')).toBe('Lódz Dvorák');
		expect(winAnsi('Αθήνα')).toBe('?????');
		expect(winAnsi('3″ × 1.5″')).toBe('3" × 1.5"');
		expect(winAnsi('1 234,50 €')).toBe('1 234,50 €');
		expect(winAnsi('Größe · Müller – «ok» €')).toBe('Größe · Müller – «ok» €');
		expect(winAnsi('riga\nsotto')).toBe('riga sotto');
	});
	it('il paese per esteso nella lingua del documento', () => {
		expect(nomePaese('FR', 'fr-FR', 'Italie')).toBe('France');
		expect(nomePaese('DE', 'it-IT', 'Italia')).toBe('Germania');
		expect(nomePaese('IT', 'de-DE', 'Italien')).toBe('Italien');
		expect(nomePaese('', 'de-DE', 'Italien')).toBe('Italien');
		expect(nomePaese('Svizzera', 'it-IT', 'Italia')).toBe('Svizzera');
	});
	it('la conferma d\'ordine nasce anche con un nome polacco e un metodo scritto in italiano', async () => {
		const pdf = await buildOrderPdf({ number: 'SP09998', numbers: ['SP09998'], issued_at: '2026-11-26', customer: { company: 'Łódź Sp. z o.o.', street: 'ul. Żurawia 1', zip: '00-503', city: 'Warszawa', country: 'PL' }, shipping: { company: 'Łódź Sp. z o.o.', city: 'Warszawa', country: 'PL' }, email: null, lines: [{ code: 'STK', description: 'Naklejki 50 mm · ąęśćż', qty: 500, unit_net: 0.2, total_net: 100 }], subtotal_net: 100, vat_amount: 0, total_gross: 100, payment_method: 'Bonifico bancario vista fattura', payment_terms: [{ due: '2026-12-04', amount: 100, method: 'Bonifico bancario vista fattura' }], shipping_method: 'Corriere a carico del mittente', delivery_date: '2026-12-04' }, 'en');
		expect(pdf.length).toBeGreaterThan(1000);
	});
});
describe('metodi di pagamento nella lingua del cliente', () => {
	it('i nomi scritti da noi in italiano si traducono pezzo per pezzo', () => {
		expect(metodoTradotto('Bonifico bancario vista fattura', 'en')).toBe('Bank transfer on receipt of invoice');
		expect(metodoTradotto('Ricevuta bancaria 30/60 gg f.m.', 'de')).toBe('Bankeinzug (RiBa) 30/60 Tage Monatsende');
		expect(metodoTradotto('Bonifico 30 gg f.m.', 'fr')).toBe('Virement bancaire 30 jours fin de mois');
		expect(metodoTradotto('Bonifico anticipato', 'es')).toBe('Transferencia bancaria por adelantado');
		expect(metodoTradotto('Pagamento anticipato', 'nl')).toBe('Vooruitbetaling');
		expect(metodoTradotto('Bonifico 30 gg f.m.', 'it')).toBe('Bonifico 30 gg f.m.');
		/* quello che non si riconosce resta com'e' */
		expect(metodoTradotto('Accordo con Mario', 'en')).toBe('Accordo con Mario');
	});
	it('i metodi del sito restano quelli del catalogo', () => {
		expect(paymentLabelFor('stripe', 'en')).toBe('Credit card (Stripe)');
		expect(paymentLabelFor('paypal', 'de')).toBe('PayPal');
		expect(paymentLabelFor('Ricevuta bancaria 60 gg f.m.', 'en')).toBe('Bank receipt (RiBa) 60 days end of month');
	});
});
