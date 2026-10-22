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
		lingua: 'Lingua e valuta', prodottoGenerico: 'i tuoi adesivi' },
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
	popup: { sopra: 'Vuoi uno sconto sul primo ordine?', titolo: 'Ecco il 10% per te', testo: 'Inserisci la tua email e ricevi subito il codice sconto.', bottone: 'Ottieni lo sconto', no: 'No grazie, non voglio risparmiare', grazieTitolo: 'Fatto! Controlla la posta', grazieTesto: 'Il codice sconto è in arrivo nella tua casella. Buona stampa!', chiudi: 'Chiudi', privacy: 'Iscrivendoti accetti di ricevere le nostre email. Puoi disiscriverti quando vuoi.' },
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
	anteprima: {
		titolo: 'Anteprima del tuo adesivo',
		titoloRegolazioni: 'Anteprima e regolazioni del tuo adesivo',
		aggiorno: 'Aggiorno…',
		genero: 'Genero l’anteprima…',
		nonPronta: 'Anteprima non pronta',
		tempo: 'Il motore non ha risposto in tempo',
		errore: 'Errore del motore' },
	api: {
		emailNonValida: 'Inserisci un indirizzo email valido.',
		iscrizioneNonSalvata: 'Non siamo riusciti a salvare l’iscrizione.',
		ospiteNonDisponibile: 'Caricamento ospite non disponibile.',
		percorsoNonValido: 'Percorso non valido.',
		fileTroppoGrande: 'File troppo grande (massimo {mb} MB).',
		permessoNonCreato: 'Permesso di caricamento non creato.',
		recensioneDoppia: 'Hai già lasciato una recensione per questo ordine, grazie!',
		errore: 'Errore' },
	recensioni: { clienteVerificato: 'Cliente verificato', cliente: 'Cliente', titolo: 'Recensione' },
	avvisoLingua: {
		testo: 'Questo sito è disponibile in {lingua}.',
		vai: 'Vai alla versione in {lingua}',
		resta: 'Resta qui' }
};
export type Comune = typeof it;
const en: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, home', menu: 'Menu', chiudiMenu: 'Close the menu', carrello: 'Cart', articoli: 'items', accedi: 'Sign in', registrati: 'Sign up', esci: 'Sign out', tuoAccount: 'Your account', lingua: 'Language and currency', prodottoGenerico: 'your stickers' },
	header: { adesivi: 'Stickers', etichette: 'Labels', promo: 'Deals', aziende: 'Business', resinati: 'Domed Stickers', personalizzati: 'Custom Stickers', rilievo: 'Raised Stickers', kit: 'Sticker Packs', vetrofanie: 'Window Decals', fogli: 'Sticker Sheets', etichetteFogli: 'Labels on Sheets', kitCampioni: 'Sample kit', supporto: 'Support', panoramica: 'Overview', mieiOrdini: 'My orders', credito: 'Stickerprint credit', dati: 'Details and addresses', pagamenti: 'Payments', recensioni: 'Reviews', principale: 'Main' },
	popup: { sopra: 'Want a discount on your first order?', titolo: 'Here’s 10% for you', testo: 'Enter your email and get the discount code right away.', bottone: 'Get my discount', no: 'No thanks, I don’t want to save', grazieTitolo: 'Done! Check your inbox', grazieTesto: 'Your discount code is on its way. Happy printing!', chiudi: 'Close', privacy: 'By signing up you agree to receive our emails. You can unsubscribe at any time.' },
	footer: { pagamentiSicuri: 'Secure payment methods', spedizioneGratis: 'Free shipping from {soglia}', newsletterTitolo: 'Subscribe to our newsletter', newsletterEmail: 'Your email address', newsletterPlaceholder: 'your email address', iscriviti: 'Subscribe', iscrizione: 'Subscribing…', giaIscritto: 'You are already subscribed.', benvenuto: 'Subscription confirmed, welcome!', erroreIscrizione: 'We could not subscribe you, please try again.', connessione: 'Connection failed, please try again.', chiSiamo: 'About us', blog: 'Blog', supporto: 'Support', resi: 'Returns', menuFooter: 'Footer' },
	anteprima: { titolo: 'Preview of your sticker', titoloRegolazioni: 'Preview and adjustments of your sticker', aggiorno: 'Updating…', genero: 'Generating the preview…', nonPronta: 'Preview not ready', tempo: 'The engine didn’t respond in time', errore: 'Engine error' },
	api: { emailNonValida: 'Enter a valid email address.', iscrizioneNonSalvata: 'We couldn’t save your subscription.', ospiteNonDisponibile: 'Guest upload unavailable.', percorsoNonValido: 'Invalid path.', fileTroppoGrande: 'File too large (max {mb} MB).', permessoNonCreato: 'Upload permission not created.', recensioneDoppia: 'You’ve already left a review for this order, thanks!', errore: 'Error' },
	recensioni: { clienteVerificato: 'Verified customer', cliente: 'Customer', titolo: 'Review' },
	avvisoLingua: { testo: 'This site is available in {lingua}.', vai: 'Go to the {lingua} version', resta: 'Stay here' }
};
const es: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, inicio', menu: 'Menú', chiudiMenu: 'Cerrar el menú', carrello: 'Carrito', articoli: 'artículos', accedi: 'Iniciar sesión', registrati: 'Registrarse', esci: 'Cerrar sesión', tuoAccount: 'Tu cuenta', lingua: 'Idioma y moneda', prodottoGenerico: 'tus pegatinas' },
	header: { adesivi: 'Pegatinas', etichette: 'Etiquetas', promo: 'Ofertas', aziende: 'Empresas', resinati: 'Pegatinas Resinadas', personalizzati: 'Pegatinas Personalizadas', rilievo: 'Pegatinas en Relieve', kit: 'Packs de Pegatinas', vetrofanie: 'Vinilos para Cristal', fogli: 'Hojas de Pegatinas', etichetteFogli: 'Etiquetas en Hojas', kitCampioni: 'Kit de muestras', supporto: 'Ayuda', panoramica: 'Resumen', mieiOrdini: 'Mis pedidos', credito: 'Crédito Stickerprint', dati: 'Datos y direcciones', pagamenti: 'Pagos', recensioni: 'Reseñas', principale: 'Principal' },
	popup: { sopra: '¿Quieres un descuento en tu primer pedido?', titolo: 'Aquí tienes tu 10%', testo: 'Introduce tu email y recibe el código de descuento al instante.', bottone: 'Quiero mi descuento', no: 'No gracias, no quiero ahorrar', grazieTitolo: '¡Hecho! Revisa tu correo', grazieTesto: 'El código de descuento está de camino a tu bandeja. ¡Feliz impresión!', chiudi: 'Cerrar', privacy: 'Al suscribirte aceptas recibir nuestros emails. Puedes darte de baja cuando quieras.' },
	footer: { pagamentiSicuri: 'Métodos de pago seguros', spedizioneGratis: 'Envío gratis a partir de {soglia}', newsletterTitolo: 'Suscríbete a nuestra newsletter', newsletterEmail: 'Tu dirección de correo', newsletterPlaceholder: 'tu dirección de correo', iscriviti: 'Suscribirme', iscrizione: 'Suscribiendo…', giaIscritto: 'Ya estás suscrito a la newsletter.', benvenuto: 'Suscripción confirmada, ¡bienvenido!', erroreIscrizione: 'No hemos podido suscribirte, inténtalo de nuevo.', connessione: 'Error de conexión, inténtalo de nuevo.', chiSiamo: 'Quiénes somos', blog: 'Blog', supporto: 'Ayuda', resi: 'Devoluciones', menuFooter: 'Pie de página' },
	anteprima: { titolo: 'Vista previa de tu pegatina', titoloRegolazioni: 'Vista previa y ajustes de tu pegatina', aggiorno: 'Actualizando…', genero: 'Generando la vista previa…', nonPronta: 'Vista previa no lista', tempo: 'El motor no ha respondido a tiempo', errore: 'Error del motor' },
	api: { emailNonValida: 'Introduce una dirección de email válida.', iscrizioneNonSalvata: 'No hemos podido guardar la suscripción.', ospiteNonDisponibile: 'Subida como invitado no disponible.', percorsoNonValido: 'Ruta no válida.', fileTroppoGrande: 'Archivo demasiado grande (máximo {mb} MB).', permessoNonCreato: 'Permiso de subida no creado.', recensioneDoppia: '¡Ya has dejado una reseña de este pedido, gracias!', errore: 'Error' },
	recensioni: { clienteVerificato: 'Cliente verificado', cliente: 'Cliente', titolo: 'Reseña' },
	avvisoLingua: { testo: 'Este sitio está disponible en {lingua}.', vai: 'Ir a la versión en {lingua}', resta: 'Quedarme aquí' }
};
const fr: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, accueil', menu: 'Menu', chiudiMenu: 'Fermer le menu', carrello: 'Panier', articoli: 'articles', accedi: 'Se connecter', registrati: 'S’inscrire', esci: 'Se déconnecter', tuoAccount: 'Votre compte', lingua: 'Langue et devise', prodottoGenerico: 'vos stickers' },
	header: { adesivi: 'Stickers', etichette: 'Étiquettes', promo: 'Promos', aziende: 'Entreprises', resinati: 'Stickers Résinés', personalizzati: 'Stickers Personnalisés', rilievo: 'Stickers en Relief', kit: 'Kits de Stickers', vetrofanie: 'Vitrophanies', fogli: 'Planches de Stickers', etichetteFogli: 'Étiquettes en Planches', kitCampioni: 'Kit d’échantillons', supporto: 'Assistance', panoramica: 'Aperçu', mieiOrdini: 'Mes commandes', credito: 'Crédit Stickerprint', dati: 'Coordonnées et adresses', pagamenti: 'Paiements', recensioni: 'Avis', principale: 'Principal' },
	popup: { sopra: 'Envie d’une remise sur votre première commande ?', titolo: 'Voici 10 % pour vous', testo: 'Saisissez votre e-mail et recevez tout de suite le code de réduction.', bottone: 'Je veux ma remise', no: 'Non merci, je ne veux pas économiser', grazieTitolo: 'C’est fait ! Vérifiez votre boîte mail', grazieTesto: 'Votre code de réduction arrive dans votre boîte. Bonne impression !', chiudi: 'Fermer', privacy: 'En vous inscrivant, vous acceptez de recevoir nos e-mails. Désinscription possible à tout moment.' },
	footer: { pagamentiSicuri: 'Moyens de paiement sécurisés', spedizioneGratis: 'Livraison gratuite dès {soglia}', newsletterTitolo: 'Inscrivez-vous à notre newsletter', newsletterEmail: 'Votre adresse e-mail', newsletterPlaceholder: 'votre adresse e-mail', iscriviti: 'S’inscrire', iscrizione: 'Inscription…', giaIscritto: 'Vous êtes déjà inscrit à la newsletter.', benvenuto: 'Inscription confirmée, bienvenue !', erroreIscrizione: 'L’inscription a échoué, réessayez.', connessione: 'Connexion impossible, réessayez.', chiSiamo: 'Qui sommes-nous', blog: 'Blog', supporto: 'Assistance', resi: 'Retours', menuFooter: 'Pied de page' },
	anteprima: { titolo: 'Aperçu de votre sticker', titoloRegolazioni: 'Aperçu et réglages de votre sticker', aggiorno: 'Mise à jour…', genero: 'Génération de l’aperçu…', nonPronta: 'Aperçu pas encore prêt', tempo: 'Le moteur n’a pas répondu à temps', errore: 'Erreur du moteur' },
	api: { emailNonValida: 'Saisissez une adresse e-mail valide.', iscrizioneNonSalvata: 'Nous n’avons pas pu enregistrer votre inscription.', ospiteNonDisponibile: 'Envoi en tant qu’invité indisponible.', percorsoNonValido: 'Chemin non valide.', fileTroppoGrande: 'Fichier trop volumineux (maximum {mb} Mo).', permessoNonCreato: 'Autorisation d’envoi non créée.', recensioneDoppia: 'Vous avez déjà laissé un avis pour cette commande, merci !', errore: 'Erreur' },
	recensioni: { clienteVerificato: 'Client vérifié', cliente: 'Client', titolo: 'Avis' },
	avvisoLingua: { testo: 'Ce site est disponible en {lingua}.', vai: 'Voir la version en {lingua}', resta: 'Rester ici' }
};
const de: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, Startseite', menu: 'Menü', chiudiMenu: 'Menü schließen', carrello: 'Warenkorb', articoli: 'Artikel', accedi: 'Anmelden', registrati: 'Registrieren', esci: 'Abmelden', tuoAccount: 'Dein Konto', lingua: 'Sprache und Währung', prodottoGenerico: 'deine Aufkleber' },
	header: { adesivi: 'Aufkleber', etichette: 'Etiketten', promo: 'Angebote', aziende: 'Firmen', resinati: 'Doming-Aufkleber', personalizzati: 'Individuelle Aufkleber', rilievo: 'Relief-Aufkleber', kit: 'Sticker-Sets', vetrofanie: 'Fensteraufkleber', fogli: 'Stickerbögen', etichetteFogli: 'Etiketten auf Bögen', kitCampioni: 'Muster-Set', supporto: 'Hilfe', panoramica: 'Übersicht', mieiOrdini: 'Meine Bestellungen', credito: 'Stickerprint-Guthaben', dati: 'Daten und Adressen', pagamenti: 'Zahlungen', recensioni: 'Bewertungen', principale: 'Hauptmenü' },
	popup: { sopra: 'Lust auf einen Rabatt auf deine erste Bestellung?', titolo: 'Hier sind 10 % für dich', testo: 'Gib deine E-Mail-Adresse ein und bekomm den Rabattcode sofort.', bottone: 'Rabatt holen', no: 'Nein danke, ich will nicht sparen', grazieTitolo: 'Erledigt! Schau in dein Postfach', grazieTesto: 'Dein Rabattcode ist unterwegs. Viel Spaß beim Drucken!', chiudi: 'Schließen', privacy: 'Mit der Anmeldung stimmst du dem Erhalt unserer E-Mails zu. Abmelden ist jederzeit möglich.' },
	footer: { pagamentiSicuri: 'Sichere Zahlungsmethoden', spedizioneGratis: 'Kostenloser Versand ab {soglia}', newsletterTitolo: 'Newsletter abonnieren', newsletterEmail: 'Deine E-Mail-Adresse', newsletterPlaceholder: 'deine E-Mail-Adresse', iscriviti: 'Abonnieren', iscrizione: 'Wird angemeldet…', giaIscritto: 'Du bist bereits für den Newsletter angemeldet.', benvenuto: 'Anmeldung bestätigt, willkommen!', erroreIscrizione: 'Die Anmeldung hat nicht geklappt, bitte versuch es noch einmal.', connessione: 'Keine Verbindung, bitte versuch es noch einmal.', chiSiamo: 'Über uns', blog: 'Blog', supporto: 'Hilfe', resi: 'Rücksendungen', menuFooter: 'Fußzeile' },
	anteprima: { titolo: 'Vorschau deines Aufklebers', titoloRegolazioni: 'Vorschau und Einstellungen deines Aufklebers', aggiorno: 'Wird aktualisiert…', genero: 'Vorschau wird erstellt…', nonPronta: 'Vorschau nicht bereit', tempo: 'Die Engine hat nicht rechtzeitig geantwortet', errore: 'Fehler der Engine' },
	api: { emailNonValida: 'Gib eine gültige E-Mail-Adresse ein.', iscrizioneNonSalvata: 'Wir konnten die Anmeldung nicht speichern.', ospiteNonDisponibile: 'Gast-Upload nicht verfügbar.', percorsoNonValido: 'Ungültiger Pfad.', fileTroppoGrande: 'Datei zu groß (maximal {mb} MB).', permessoNonCreato: 'Upload-Berechtigung nicht erstellt.', recensioneDoppia: 'Du hast für diese Bestellung schon eine Bewertung abgegeben, danke!', errore: 'Fehler' },
	recensioni: { clienteVerificato: 'Verifizierter Kunde', cliente: 'Kunde', titolo: 'Bewertung' },
	avvisoLingua: { testo: 'Diese Website gibt es auch auf {lingua}.', vai: 'Zur Version auf {lingua}', resta: 'Hier bleiben' }
};
const nl: Comune = {
	comune: { sito: 'Stickerprint', home: 'Stickerprint, home', menu: 'Menu', chiudiMenu: 'Menu sluiten', carrello: 'Winkelwagen', articoli: 'artikelen', accedi: 'Inloggen', registrati: 'Registreren', esci: 'Uitloggen', tuoAccount: 'Je account', lingua: 'Taal en valuta', prodottoGenerico: 'je stickers' },
	header: { adesivi: 'Stickers', etichette: 'Etiketten', promo: 'Aanbiedingen', aziende: 'Zakelijk', resinati: 'Doming Stickers', personalizzati: 'Stickers op Maat', rilievo: 'Reliëf Stickers', kit: 'Stickerpakketten', vetrofanie: 'Raamstickers', fogli: 'Stickervellen', etichetteFogli: 'Etiketten op Vellen', kitCampioni: 'Proefpakket', supporto: 'Klantenservice', panoramica: 'Overzicht', mieiOrdini: 'Mijn bestellingen', credito: 'Stickerprint-tegoed', dati: 'Gegevens en adressen', pagamenti: 'Betalingen', recensioni: 'Beoordelingen', principale: 'Hoofdmenu' },
	popup: { sopra: 'Wil je korting op je eerste bestelling?', titolo: 'Hier is 10% voor jou', testo: 'Vul je e-mailadres in en ontvang meteen de kortingscode.', bottone: 'Geef mij korting', no: 'Nee bedankt, ik wil niet besparen', grazieTitolo: 'Gelukt! Check je inbox', grazieTesto: 'Je kortingscode is onderweg naar je inbox. Veel printplezier!', chiudi: 'Sluiten', privacy: 'Door je in te schrijven ga je akkoord met het ontvangen van onze e-mails. Uitschrijven kan altijd.' },
	footer: { pagamentiSicuri: 'Veilige betaalmethoden', spedizioneGratis: 'Gratis verzending vanaf {soglia}', newsletterTitolo: 'Schrijf je in voor onze nieuwsbrief', newsletterEmail: 'Je e-mailadres', newsletterPlaceholder: 'je e-mailadres', iscriviti: 'Inschrijven', iscrizione: 'Bezig met inschrijven…', giaIscritto: 'Je bent al ingeschreven voor de nieuwsbrief.', benvenuto: 'Inschrijving bevestigd, welkom!', erroreIscrizione: 'Inschrijven is niet gelukt, probeer het opnieuw.', connessione: 'Geen verbinding, probeer het opnieuw.', chiSiamo: 'Over ons', blog: 'Blog', supporto: 'Klantenservice', resi: 'Retouren', menuFooter: 'Voettekst' },
	anteprima: { titolo: 'Voorbeeld van je sticker', titoloRegolazioni: 'Voorbeeld en instellingen van je sticker', aggiorno: 'Bijwerken…', genero: 'Voorbeeld wordt gemaakt…', nonPronta: 'Voorbeeld nog niet klaar', tempo: 'De engine heeft niet op tijd geantwoord', errore: 'Fout in de engine' },
	api: { emailNonValida: 'Vul een geldig e-mailadres in.', iscrizioneNonSalvata: 'We konden je inschrijving niet opslaan.', ospiteNonDisponibile: 'Uploaden als gast niet beschikbaar.', percorsoNonValido: 'Ongeldig pad.', fileTroppoGrande: 'Bestand te groot (maximaal {mb} MB).', permessoNonCreato: 'Uploadtoestemming niet aangemaakt.', recensioneDoppia: 'Je hebt al een beoordeling achtergelaten voor deze bestelling, bedankt!', errore: 'Fout' },
	recensioni: { clienteVerificato: 'Geverifieerde klant', cliente: 'Klant', titolo: 'Beoordeling' },
	avvisoLingua: { testo: 'Deze website is ook beschikbaar in het {lingua}.', vai: 'Naar de versie in het {lingua}', resta: 'Hier blijven' }
};
export const comune: Record<Lang, Comune> = { it, en, es, fr, de, nl };
