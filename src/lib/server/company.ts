/** Dati aziendali per fatture, DDT, etichette e XML fattura elettronica. Da completare con i dati reali. */
export const COMPANY = {
	name: 'Stickerprint Srl',
	street: 'Via Aldo Moro 18/c',
	zip: '20085',
	city: 'Locate di Triulzi',
	province: 'MI',
	country: 'IT',
	vat: '00000000000',        // P.IVA (11 cifre) — DA INSERIRE
	fiscalCode: '00000000000', // codice fiscale — DA INSERIRE
	rea: '',                   // es. MI-1234567 (facoltativo)
	capital: '',               // capitale sociale (facoltativo)
	regime: 'RF01',            // regime fiscale FatturaPA (RF01 = ordinario)
	email: 'info@stickerprint.it',
	pec: '',
	phone: '',
	site: 'stickerprint.it',
	vatRate: 0.22,
	get address() { return `${this.street}, ${this.zip} ${this.city} (${this.province})`; }
};
