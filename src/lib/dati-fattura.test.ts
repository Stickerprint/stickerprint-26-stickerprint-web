import { describe, expect, it } from 'vitest';
import { cfValido, datiFatturaMancanti, leggiDatiFattura, pivaValida } from './dati-fattura';

describe('partita IVA e codice fiscale', () => {
	it('partita IVA: 11 cifre con la cifra di controllo', () => {
		expect(pivaValida('11308040960')).toBe(true);
		expect(pivaValida('IT 00584770242')).toBe(true);
		expect(pivaValida('11308040961')).toBe(false);
		expect(pivaValida('1130804096')).toBe(false);
		expect(pivaValida('00000000000')).toBe(false);
		expect(pivaValida('')).toBe(false);
	});
	it('codice fiscale: 16 caratteri con la lettera di controllo, o le 11 cifre di un ente', () => {
		expect(cfValido('RSSMRA80A01H501U')).toBe(true);
		expect(cfValido('rss mra 80a01 h501u')).toBe(true);
		expect(cfValido('RSSMRA80A01H501X')).toBe(false);
		expect(cfValido('RSSMRA80A01H501')).toBe(false);
		expect(cfValido('00584770242')).toBe(true);
		expect(cfValido('00000000000')).toBe(false);
	});
});

describe('cosa manca per la fattura', () => {
	const azienda = { company: 'Azienda di Prova S.r.l.', vat: '11308040960', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'MI', country: 'IT' };
	it('azienda e privato completi: non manca niente', () => {
		expect(datiFatturaMancanti(azienda)).toEqual([]);
		expect(datiFatturaMancanti({ first_name: 'Mario', last_name: 'Rossi', fiscal_code: 'RSSMRA80A01H501U', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'mi' })).toEqual([]);
	});
	it('ordine nato con il solo nome: manca tutto il resto', () => {
		expect(datiFatturaMancanti({ company: 'Europrint snc', country: 'IT' })).toEqual(['fiscale', 'indirizzo', 'cap', 'citta', 'provincia']);
		expect(datiFatturaMancanti(null)).toEqual(['nome', 'fiscale', 'indirizzo', 'cap', 'citta', 'provincia']);
	});
	it('partita IVA o codice fiscale sbagliati contano come mancanti', () => {
		expect(datiFatturaMancanti({ ...azienda, vat: '11308040961' })).toEqual(['fiscale']);
		expect(datiFatturaMancanti({ ...azienda, vat: '', fiscal_code: 'RSSMRA80A01H501X' })).toEqual(['fiscale']);
		expect(datiFatturaMancanti({ ...azienda, zip: '2010' })).toEqual(['cap']);
	});
	it('estero: bastano nome, via e citta\'', () => {
		expect(datiFatturaMancanti({ company: 'Acme GmbH', street: 'Hauptstr. 1', city: 'Berlin', zip: '10115', country: 'DE' })).toEqual([]);
		expect(datiFatturaMancanti({ company: 'Acme Inc', country: 'US' })).toEqual(['indirizzo', 'citta']);
	});
});

describe('modulo compilato dal cliente', () => {
	const modulo = (o: Record<string, string>) => leggiDatiFattura((k) => o[k]);
	it('azienda: pulisce partita IVA, SDI e provincia', () => {
		const r = modulo({ tipo: 'azienda', company: ' Azienda di Prova S.r.l. ', vat: 'it 113 080 409 60', sdi: 'abcdefg', pec: 'PEC@Example.IT', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'mi', country: 'IT' });
		expect(r.mancanti).toEqual([]);
		expect(r.dati).toMatchObject({ company: 'Azienda di Prova S.r.l.', vat: '11308040960', sdi: 'ABCDEFG', pec: 'pec@example.it', province: 'MI', country: 'IT' });
	});
	it('azienda italiana senza partita IVA: non basta il codice fiscale', () => {
		expect(modulo({ tipo: 'azienda', company: 'Ditta', fiscal_code: 'RSSMRA80A01H501U', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'MI' }).mancanti).toEqual(['fiscale']);
	});
	it('privato: nome, cognome e codice fiscale; la ragione sociale diventa il nome completo', () => {
		const r = modulo({ tipo: 'privato', first_name: 'Mario', last_name: 'Rossi', fiscal_code: 'rssmra80a01h501u', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'MI' });
		expect(r.mancanti).toEqual([]);
		expect(r.dati).toMatchObject({ company: 'Mario Rossi', vat: '', fiscal_code: 'RSSMRA80A01H501U', sdi: '' });
		expect(modulo({ tipo: 'privato', first_name: 'Mario', fiscal_code: 'RSSMRA80A01H501U', street: 'Via Roma 1', zip: '20100', city: 'Milano', province: 'MI' }).mancanti).toEqual(['nome']);
	});
	it('azienda estera: la partita IVA resta com\'e\' scritta, niente codice fiscale italiano', () => {
		const r = modulo({ tipo: 'azienda', company: 'Acme GmbH', vat: 'de 123456789', fiscal_code: 'x', street: 'Hauptstr. 1', zip: '10115', city: 'Berlin', country: 'de' });
		expect(r.mancanti).toEqual([]);
		expect(r.dati).toMatchObject({ vat: 'DE123456789', fiscal_code: '', country: 'DE' });
	});
});
