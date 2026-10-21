/**
 * Area "comune": header, footer, menu, avviso lingua. Una sola forma (it) e cinque traduzioni: TypeScript controlla le chiavi.
 * Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
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
		lingua: 'Lingua e valuta' },
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
		principale: 'Principale' },
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
		menuFooter: 'Footer' },
	avvisoLingua: {
		testo: 'Questo sito è disponibile in {lingua}.',
		vai: 'Vai alla versione in {lingua}',
		resta: 'Resta qui' }
};
export type Comune = typeof it;
const en: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, home', menu: 'Menu', chiudiMenu: 'Close the menu', carrello: 'Cart', articoli: 'items', accedi: 'Sign in', registrati: 'Sign up', esci: 'Sign out', tuoAccount: 'Your account', lingua: 'Language and currency' },
	header: { adesivi: 'Stickers', etichette: 'Labels', promo: 'Deals', aziende: 'Business', resinati: 'Domed Stickers', personalizzati: 'Custom Stickers', rilievo: 'Raised Stickers', kit: 'Sticker Packs', vetrofanie: 'Window Decals', fogli: 'Sticker Sheets', etichetteFogli: 'Labels on Sheets', kitCampioni: 'Sample kit', supporto: 'Support', panoramica: 'Overview', mieiOrdini: 'My orders', credito: 'Stickerprint credit', dati: 'Details and addresses', pagamenti: 'Payments', recensioni: 'Reviews', principale: 'Main' },
	footer: { pagamentiSicuri: 'Secure payment methods', spedizioneGratis: 'Free shipping from {soglia}', newsletterTitolo: 'Subscribe to our newsletter', newsletterEmail: 'Your email address', newsletterPlaceholder: 'your email address', iscriviti: 'Subscribe', iscrizione: 'Subscribing…', giaIscritto: 'You are already subscribed.', benvenuto: 'Subscription confirmed, welcome!', erroreIscrizione: 'We could not subscribe you, please try again.', connessione: 'Connection failed, please try again.', chiSiamo: 'About us', blog: 'Blog', supporto: 'Support', resi: 'Returns', menuFooter: 'Footer' },
	avvisoLingua: { testo: 'This site is available in {lingua}.', vai: 'Go to the {lingua} version', resta: 'Stay here' }
};
const es: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, inicio', menu: 'Menú', chiudiMenu: 'Cerrar el menú', carrello: 'Carrito', articoli: 'artículos', accedi: 'Iniciar sesión', registrati: 'Registrarse', esci: 'Cerrar sesión', tuoAccount: 'Tu cuenta', lingua: 'Idioma y moneda' },
	header: { adesivi: 'Pegatinas', etichette: 'Etiquetas', promo: 'Ofertas', aziende: 'Empresas', resinati: 'Pegatinas Resinadas', personalizzati: 'Pegatinas Personalizadas', rilievo: 'Pegatinas en Relieve', kit: 'Packs de Pegatinas', vetrofanie: 'Vinilos para Cristal', fogli: 'Hojas de Pegatinas', etichetteFogli: 'Etiquetas en Hojas', kitCampioni: 'Kit de muestras', supporto: 'Ayuda', panoramica: 'Resumen', mieiOrdini: 'Mis pedidos', credito: 'Crédito Stickerprint', dati: 'Datos y direcciones', pagamenti: 'Pagos', recensioni: 'Reseñas', principale: 'Principal' },
	footer: { pagamentiSicuri: 'Métodos de pago seguros', spedizioneGratis: 'Envío gratis a partir de {soglia}', newsletterTitolo: 'Suscríbete a nuestra newsletter', newsletterEmail: 'Tu dirección de correo', newsletterPlaceholder: 'tu dirección de correo', iscriviti: 'Suscribirme', iscrizione: 'Suscribiendo…', giaIscritto: 'Ya estás suscrito a la newsletter.', benvenuto: 'Suscripción confirmada, ¡bienvenido!', erroreIscrizione: 'No hemos podido suscribirte, inténtalo de nuevo.', connessione: 'Error de conexión, inténtalo de nuevo.', chiSiamo: 'Quiénes somos', blog: 'Blog', supporto: 'Ayuda', resi: 'Devoluciones', menuFooter: 'Pie de página' },
	avvisoLingua: { testo: 'Este sitio está disponible en {lingua}.', vai: 'Ir a la versión en {lingua}', resta: 'Quedarme aquí' }
};
const fr: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, accueil', menu: 'Menu', chiudiMenu: 'Fermer le menu', carrello: 'Panier', articoli: 'articles', accedi: 'Se connecter', registrati: 'S’inscrire', esci: 'Se déconnecter', tuoAccount: 'Votre compte', lingua: 'Langue et devise' },
	header: { adesivi: 'Stickers', etichette: 'Étiquettes', promo: 'Promos', aziende: 'Entreprises', resinati: 'Stickers Résinés', personalizzati: 'Stickers Personnalisés', rilievo: 'Stickers en Relief', kit: 'Kits de Stickers', vetrofanie: 'Vitrophanies', fogli: 'Planches de Stickers', etichetteFogli: 'Étiquettes en Planches', kitCampioni: 'Kit d’échantillons', supporto: 'Assistance', panoramica: 'Aperçu', mieiOrdini: 'Mes commandes', credito: 'Crédit Stickerprint', dati: 'Coordonnées et adresses', pagamenti: 'Paiements', recensioni: 'Avis', principale: 'Principal' },
	footer: { pagamentiSicuri: 'Moyens de paiement sécurisés', spedizioneGratis: 'Livraison gratuite dès {soglia}', newsletterTitolo: 'Inscrivez-vous à notre newsletter', newsletterEmail: 'Votre adresse e-mail', newsletterPlaceholder: 'votre adresse e-mail', iscriviti: 'S’inscrire', iscrizione: 'Inscription…', giaIscritto: 'Vous êtes déjà inscrit à la newsletter.', benvenuto: 'Inscription confirmée, bienvenue !', erroreIscrizione: 'L’inscription a échoué, réessayez.', connessione: 'Connexion impossible, réessayez.', chiSiamo: 'Qui sommes-nous', blog: 'Blog', supporto: 'Assistance', resi: 'Retours', menuFooter: 'Pied de page' },
	avvisoLingua: { testo: 'Ce site est disponible en {lingua}.', vai: 'Voir la version en {lingua}', resta: 'Rester ici' }
};
const de: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, Startseite', menu: 'Menü', chiudiMenu: 'Menü schließen', carrello: 'Warenkorb', articoli: 'Artikel', accedi: 'Anmelden', registrati: 'Registrieren', esci: 'Abmelden', tuoAccount: 'Dein Konto', lingua: 'Sprache und Währung' },
	header: { adesivi: 'Aufkleber', etichette: 'Etiketten', promo: 'Angebote', aziende: 'Firmen', resinati: 'Doming-Aufkleber', personalizzati: 'Individuelle Aufkleber', rilievo: 'Relief-Aufkleber', kit: 'Sticker-Sets', vetrofanie: 'Fensteraufkleber', fogli: 'Stickerbögen', etichetteFogli: 'Etiketten auf Bögen', kitCampioni: 'Muster-Set', supporto: 'Hilfe', panoramica: 'Übersicht', mieiOrdini: 'Meine Bestellungen', credito: 'Stickerprint-Guthaben', dati: 'Daten und Adressen', pagamenti: 'Zahlungen', recensioni: 'Bewertungen', principale: 'Hauptmenü' },
	footer: { pagamentiSicuri: 'Sichere Zahlungsmethoden', spedizioneGratis: 'Kostenloser Versand ab {soglia}', newsletterTitolo: 'Newsletter abonnieren', newsletterEmail: 'Deine E-Mail-Adresse', newsletterPlaceholder: 'deine E-Mail-Adresse', iscriviti: 'Abonnieren', iscrizione: 'Wird angemeldet…', giaIscritto: 'Du bist bereits für den Newsletter angemeldet.', benvenuto: 'Anmeldung bestätigt, willkommen!', erroreIscrizione: 'Die Anmeldung hat nicht geklappt, bitte versuch es noch einmal.', connessione: 'Keine Verbindung, bitte versuch es noch einmal.', chiSiamo: 'Über uns', blog: 'Blog', supporto: 'Hilfe', resi: 'Rücksendungen', menuFooter: 'Fußzeile' },
	avvisoLingua: { testo: 'Diese Website gibt es auch auf {lingua}.', vai: 'Zur Version auf {lingua}', resta: 'Hier bleiben' }
};
const nl: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, home', menu: 'Menu', chiudiMenu: 'Menu sluiten', carrello: 'Winkelwagen', articoli: 'artikelen', accedi: 'Inloggen', registrati: 'Registreren', esci: 'Uitloggen', tuoAccount: 'Je account', lingua: 'Taal en valuta' },
	header: { adesivi: 'Stickers', etichette: 'Etiketten', promo: 'Aanbiedingen', aziende: 'Zakelijk', resinati: 'Doming Stickers', personalizzati: 'Stickers op Maat', rilievo: 'Reliëf Stickers', kit: 'Stickerpakketten', vetrofanie: 'Raamstickers', fogli: 'Stickervellen', etichetteFogli: 'Etiketten op Vellen', kitCampioni: 'Proefpakket', supporto: 'Klantenservice', panoramica: 'Overzicht', mieiOrdini: 'Mijn bestellingen', credito: 'Stickerprint-tegoed', dati: 'Gegevens en adressen', pagamenti: 'Betalingen', recensioni: 'Beoordelingen', principale: 'Hoofdmenu' },
	footer: { pagamentiSicuri: 'Veilige betaalmethoden', spedizioneGratis: 'Gratis verzending vanaf {soglia}', newsletterTitolo: 'Schrijf je in voor onze nieuwsbrief', newsletterEmail: 'Je e-mailadres', newsletterPlaceholder: 'je e-mailadres', iscriviti: 'Inschrijven', iscrizione: 'Bezig met inschrijven…', giaIscritto: 'Je bent al ingeschreven voor de nieuwsbrief.', benvenuto: 'Inschrijving bevestigd, welkom!', erroreIscrizione: 'Inschrijven is niet gelukt, probeer het opnieuw.', connessione: 'Geen verbinding, probeer het opnieuw.', chiSiamo: 'Over ons', blog: 'Blog', supporto: 'Klantenservice', resi: 'Retouren', menuFooter: 'Voettekst' },
	avvisoLingua: { testo: 'Deze website is ook beschikbaar in het {lingua}.', vai: 'Naar de versie in het {lingua}', resta: 'Hier blijven' }
};
export const comune: Record<Lang, Comune> = { it, en, es, fr, de, nl };
