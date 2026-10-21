/**
 * Testi del sito pubblico, lingua di partenza. Le altre lingue (es, fr, de, nl, en) hanno la stessa forma:
 * TypeScript segnala le chiavi mancanti. {nome} e' un segnaposto riempito da t().
 * Si aggiunge un blocco per pagina man mano che la si traduce; la dashboard non passa di qui.
 */
export const it = {
	comune: {
		sito: 'Stickerprint',
		home: 'Stickerprint, home',
		menu: 'Menu',
		chiudiMenu: 'Chiudi il menu',
		carrello: 'Carrello',
		articoli: 'articoli',
		accedi: 'Accedi',
		registrati: 'Registrati',
		esci: 'Esci dall’account',
		tuoAccount: 'Il tuo account',
		lingua: 'Lingua e valuta'
	},
	header: {
		adesivi: 'Adesivi',
		etichette: 'Etichette',
		promo: 'Promo',
		aziende: 'Aziende',
		resinati: 'Adesivi Resinati',
		personalizzati: 'Adesivi Personalizzati',
		rilievo: 'Adesivi in Rilievo',
		kit: 'Kit di Adesivi',
		vetrofanie: 'Vetrofanie',
		fogli: 'Fogli di Adesivi',
		etichetteFogli: 'Etichette in Fogli',
		kitCampioni: 'Kit campioni',
		supporto: 'Supporto',
		panoramica: 'Panoramica',
		mieiOrdini: 'I miei ordini',
		credito: 'Credito Stickerprint',
		dati: 'Dati e indirizzi',
		pagamenti: 'Pagamenti',
		recensioni: 'Recensioni',
		principale: 'Principale'
	},
	footer: {
		pagamentiSicuri: 'Metodi di pagamento sicuri',
		spedizioneGratis: 'Spedizione gratuita da {soglia}',
		newsletterTitolo: 'Iscriviti alla Nostra Newsletter',
		newsletterEmail: 'Il tuo indirizzo email',
		newsletterPlaceholder: 'il tuo indirizzo mail',
		iscriviti: 'Iscriviti',
		iscrizione: 'Iscrizione…',
		giaIscritto: 'Sei già iscritto alla newsletter.',
		benvenuto: 'Iscrizione confermata, benvenuto!',
		erroreIscrizione: 'Non siamo riusciti a iscriverti, riprova.',
		connessione: 'Connessione non riuscita, riprova.',
		chiSiamo: 'Chi Siamo',
		blog: 'Blog',
		supporto: 'Supporto',
		resi: 'Resi',
		menuFooter: 'Footer'
	},
	avvisoLingua: {
		testo: 'Questo sito è disponibile in {lingua}.',
		vai: 'Vai alla versione in {lingua}',
		resta: 'Resta qui'
	}
};
export type Traduzioni = typeof it;
