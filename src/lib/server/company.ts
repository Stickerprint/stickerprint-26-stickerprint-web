/** Dati aziendali per fatture, DDT, etichette e XML fattura elettronica. Da completare con i dati reali. */
export const COMPANY = {
	name: 'Stickerprint Srl',
	street: 'Via Aldo Moro 18/c',
	zip: '20085',
	city: 'Locate di Triulzi',
	province: 'MI',
	country: 'IT',
	vat: '11308040960',        // P.IVA (in fattura e XML senza il prefisso IT)
	fiscalCode: '11308040960', // codice fiscale = P.IVA
	rea: '',                   // es. MI-1234567 (facoltativo)
	capital: '',               // capitale sociale (facoltativo)
	regime: 'RF01',            // regime fiscale FatturaPA (RF01 = ordinario)
	email: 'info@stickerprint.it',
	pec: '',
	iban: '',                  // stampato in fattura per bonifici e ricevute bancarie
	phone: '',
	site: 'stickerprint.it',
	vatRate: 0.22,
	get address() { return `${this.street}, ${this.zip} ${this.city} (${this.province})`; }
};
