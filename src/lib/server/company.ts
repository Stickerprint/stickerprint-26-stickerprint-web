/** Dati aziendali per fatture, DDT, etichette e XML fattura elettronica. Da completare con i dati reali. */
export const COMPANY = {
	name: 'Stickerprint Srl',
	street: 'Via Staffora 20/3',
	zip: '20073',
	city: 'Opera',
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
	get address() { return `${this.street} - ${this.zip} ${this.city} (${this.province})`; },
	/** Le tre righe dell'intestazione dei documenti */
	get headerLines() { return [this.name, this.address, `P.IVA Cod. Fisc: ${this.vat} - ${this.email} - ${this.site}`]; }
};
