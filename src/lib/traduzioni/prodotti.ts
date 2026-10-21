/**
 * Area "prodotti": pagina prodotto e blocchi condivisi (ProductPage, Faq, FaqList, HowTo, FinalCta, SamplesBlock, CompareBlock, ReviewsCarousel, Stars, Breadcrumb).
 * Qui stanno SOLO i testi fissi dei blocchi: i testi del singolo prodotto (titoli, FAQ, checklist) vengono da src/lib/prodotti-testi (productFor, kitFor).
 * Forma = it; en/es/fr/de/nl devono avere le stesse chiavi (TypeScript le controlla). Regole, tono e glossario: docs/traduzioni.md.
 */
import type { Lang } from '$lib/i18n';

const it = {
	pagina: {
		suOgniOrdine: 'Su ogni ordine:',
		configura: 'Configura {cta} qui sotto ↓',
		cosaTitolo: 'Cosa stai stampando, esattamente',
		mediaRecensioni: 'Valutazione media {media} su 5.',
		faqTitolo: 'Le domande',
		faqHl: 'più frequenti.',
		faqIntro: 'Cerchi altre risposte? Guarda la nostra <a class="link" href="{href}" style="color:var(--blue)">sezione di supporto</a>.',
		materialeVinile: 'Vinile',
		materialeResina: 'Vinile con resina poliuretanica' },
	briciole: {
		home: 'Home',
		adesivi: 'Adesivi',
		etichette: 'Etichette',
		percorso: 'Percorso' },
	stelle: {
		su5: 'su 5',
		valutazione: '{voto} su 5',
		recensioniVerificate: 'recensioni verificate' },
	recensioni: {
		regione: 'Recensioni dei clienti',
		precedenti: 'Recensioni precedenti',
		successive: 'Recensioni successive',
		verificata: 'Recensione verificata',
		stelle: '{n} stelle su 5',
		nota: 'Recensioni verificate e acquisite post acquisto.',
		comeGestiamo: 'Come le gestiamo',
		vaiPagina: 'Vai alla pagina {n}',
		chiudi: 'Chiudi' },
	comeFunziona: {
		titolo: 'Te li portiamo',
		hl: 'fino alla porta.',
		uno: { titolo: 'Carica il tuo file', testo: 'PNG, PDF, JPG, SVG. Va bene anche se non è pronto per la stampa: lo sistemiamo noi.' },
		due: { titolo: 'Anteprima immediata', testo: 'Vedi subito sagoma e linea di taglio, prima di pagare. Nessun salto nel buio.' },
		tre: { titolo: 'Confermi, stampiamo', testo: 'Ti piace l’anteprima? Confermi e l’ordine entra subito in produzione.', spedizione: 'Spedizione stimata' },
		quattro: { titolo: 'Ricevi gli adesivi', testo: 'Corriere espresso tracciato. E quando arrivano, ci lasci una recensione come gli altri.' } },
	ctaFinale: {
		titolo: 'Fatti riconoscere, ovunque.',
		titolo2: 'Il tuo brand merita adesivi',
		hl: 'impossibili da ignorare.',
		prima: 'Ordina oggi: spedizione stimata',
		dopo: 'E inizia a far girare il tuo brand.',
		bottone: 'Voglio i miei adesivi' },
	campioni: {
		alt: 'Pila di adesivi campione Stickerprint',
		tag: 'Tocca con mano la qualità',
		titolo: 'Prova i',
		hl: 'nostri adesivi',
		ordina: 'Ordina il kit',
		recuperi: 'Li recuperi <strong>subito</strong><br />sul primo ordine' },
	confronto: {
		intestazione: 'Il confronto',
		home: {
			titolo: 'Perché',
			hl: 'Stickerprint?',
			sotto: 'Noi investiamo nei materiali, non nelle promozioni.',
			noi: 'Stickerprint',
			loro: 'Altri siti',
			righe: {
				cosa: { etichetta: 'Cosa ricevi?', noi: 'Adesivi personalizzati di alta qualità', loro: 'Adesivi economici sempre in promo' },
				anteprima: { etichetta: 'Anteprima del file', noi: 'Immediata, ancora prima di pagare', loro: 'A pagamento o assente' },
				esperienza: { etichetta: 'Esperienza', noi: '19 anni di esperienza nella stampa', loro: 'Non sempre dichiarata' },
				produzione: { etichetta: 'Produzione', noi: '5 giorni lavorativi', loro: '7–15 giorni lavorativi' },
				materiali: { etichetta: 'Materiali', noi: 'Materiali premium selezionati', loro: 'Materiali economici per contenere il prezzo' },
				durata: { etichetta: 'Durata della stampa', noi: 'Stampa resistente che non sbiadisce', loro: 'Sbiadiscono dopo pochi giorni' } },
			chiusura: 'Se cerchi competenza tecnica e adesivi di alta qualità, sei nel posto giusto.',
			nota: "Se cerchi l'ennesima promo che scade domenica e ricomincia lunedì, purtroppo non possiamo aiutarti :(",
			cta: 'Crea i tuoi adesivi →' } }
};
export type Prodotti = typeof it;

const en: Prodotti = {
	pagina: {
		suOgniOrdine: 'With every order:',
		configura: 'Build {cta} below ↓',
		cosaTitolo: 'What you’re actually getting',
		mediaRecensioni: 'Average rating {media} out of 5.',
		faqTitolo: 'Frequently asked',
		faqHl: 'questions.',
		faqIntro: 'Looking for more answers? Check out our <a class="link" href="{href}" style="color:var(--blue)">support section</a>.',
		materialeVinile: 'Vinyl',
		materialeResina: 'Vinyl with polyurethane resin' },
	briciole: { home: 'Home', adesivi: 'Stickers', etichette: 'Labels', percorso: 'Breadcrumb' },
	stelle: { su5: 'out of 5', valutazione: '{voto} out of 5', recensioniVerificate: 'verified reviews' },
	recensioni: {
		regione: 'Customer reviews',
		precedenti: 'Previous reviews',
		successive: 'Next reviews',
		verificata: 'Verified review',
		stelle: '{n} out of 5 stars',
		nota: 'Verified reviews, collected after purchase.',
		comeGestiamo: 'How we handle them',
		vaiPagina: 'Go to page {n}',
		chiudi: 'Close' },
	comeFunziona: {
		titolo: 'We bring them',
		hl: 'right to your door.',
		uno: { titolo: 'Upload your file', testo: 'PNG, PDF, JPG, SVG. Not print-ready? No problem: we fix it for you.' },
		due: { titolo: 'Instant preview', testo: 'See the shape and cut line right away, before you pay. No leap in the dark.' },
		tre: { titolo: 'You approve, we print', testo: 'Happy with the preview? Approve it and your order goes straight into production.', spedizione: 'Estimated shipping' },
		quattro: { titolo: 'Get your stickers', testo: 'Tracked express courier. And when they arrive, leave us a review like everyone else.' } },
	ctaFinale: {
		titolo: 'Get noticed, everywhere.',
		titolo2: 'Your brand deserves stickers that are',
		hl: 'impossible to ignore.',
		prima: 'Order today: estimated shipping',
		dopo: 'And get your brand out there.',
		bottone: 'I want my stickers' },
	campioni: {
		alt: 'Stack of Stickerprint sample stickers',
		tag: 'Feel the quality for yourself',
		titolo: 'Try',
		hl: 'our stickers',
		ordina: 'Order the kit',
		recuperi: 'Get it <strong>right back</strong><br />on your first order' },
	confronto: {
		intestazione: 'The comparison',
		home: {
			titolo: 'Why',
			hl: 'Stickerprint?',
			sotto: 'We invest in materials, not in promotions.',
			noi: 'Stickerprint',
			loro: 'Other sites',
			righe: {
				cosa: { etichetta: 'What do you get?', noi: 'High-quality custom stickers', loro: 'Cheap stickers always on sale' },
				anteprima: { etichetta: 'File preview', noi: 'Instant, even before you pay', loro: 'Paid or not available' },
				esperienza: { etichetta: 'Experience', noi: '19 years of printing experience', loro: 'Not always stated' },
				produzione: { etichetta: 'Production', noi: '5 business days', loro: '7–15 business days' },
				materiali: { etichetta: 'Materials', noi: 'Selected premium materials', loro: 'Cheap materials to keep the price down' },
				durata: { etichetta: 'Print durability', noi: 'Durable print that doesn’t fade', loro: 'Fades after a few days' } },
			chiusura: 'If you’re after technical expertise and high-quality stickers, you’re in the right place.',
			nota: 'If you’re after yet another deal that ends Sunday and starts again Monday, sadly we can’t help you :(',
			cta: 'Create your stickers →' } }
};

const es: Prodotti = {
	pagina: {
		suOgniOrdine: 'En cada pedido:',
		configura: 'Configura {cta} aquí abajo ↓',
		cosaTitolo: 'Qué estás imprimiendo, exactamente',
		mediaRecensioni: 'Valoración media {media} sobre 5.',
		faqTitolo: 'Las preguntas',
		faqHl: 'más frecuentes.',
		faqIntro: '¿Buscas más respuestas? Echa un vistazo a nuestra <a class="link" href="{href}" style="color:var(--blue)">sección de ayuda</a>.',
		materialeVinile: 'Vinilo',
		materialeResina: 'Vinilo con resina de poliuretano' },
	briciole: { home: 'Inicio', adesivi: 'Pegatinas', etichette: 'Etiquetas', percorso: 'Ruta de navegación' },
	stelle: { su5: 'sobre 5', valutazione: '{voto} sobre 5', recensioniVerificate: 'reseñas verificadas' },
	recensioni: {
		regione: 'Reseñas de clientes',
		precedenti: 'Reseñas anteriores',
		successive: 'Reseñas siguientes',
		verificata: 'Reseña verificada',
		stelle: '{n} estrellas sobre 5',
		nota: 'Reseñas verificadas y recogidas después de la compra.',
		comeGestiamo: 'Cómo las gestionamos',
		vaiPagina: 'Ir a la página {n}',
		chiudi: 'Cerrar' },
	comeFunziona: {
		titolo: 'Te las llevamos',
		hl: 'hasta la puerta.',
		uno: { titolo: 'Sube tu archivo', testo: 'PNG, PDF, JPG, SVG. No pasa nada si no está listo para imprimir: lo arreglamos nosotros.' },
		due: { titolo: 'Vista previa al instante', testo: 'Ves enseguida la silueta y la línea de corte, antes de pagar. Sin saltos al vacío.' },
		tre: { titolo: 'Confirmas, imprimimos', testo: '¿Te gusta la vista previa? Confirmas y el pedido entra directamente en producción.', spedizione: 'Envío estimado' },
		quattro: { titolo: 'Recibes tus pegatinas', testo: 'Mensajería urgente con seguimiento. Y cuando lleguen, nos dejas una reseña como los demás.' } },
	ctaFinale: {
		titolo: 'Hazte notar, en todas partes.',
		titolo2: 'Tu marca se merece pegatinas',
		hl: 'imposibles de ignorar.',
		prima: 'Pide hoy: envío estimado',
		dopo: 'Y pon tu marca a rodar.',
		bottone: 'Quiero mis pegatinas' },
	campioni: {
		alt: 'Montón de pegatinas de muestra Stickerprint',
		tag: 'Toca la calidad con tus manos',
		titolo: 'Prueba',
		hl: 'nuestras pegatinas',
		ordina: 'Pedir el kit',
		recuperi: 'Lo recuperas <strong>al instante</strong><br />en tu primer pedido' },
	confronto: {
		intestazione: 'La comparación',
		home: {
			titolo: '¿Por qué',
			hl: 'Stickerprint?',
			sotto: 'Nosotros invertimos en materiales, no en promociones.',
			noi: 'Stickerprint',
			loro: 'Otras webs',
			righe: {
				cosa: { etichetta: '¿Qué recibes?', noi: 'Pegatinas personalizadas de alta calidad', loro: 'Pegatinas baratas siempre en oferta' },
				anteprima: { etichetta: 'Vista previa del archivo', noi: 'Al instante, incluso antes de pagar', loro: 'De pago o inexistente' },
				esperienza: { etichetta: 'Experiencia', noi: '19 años de experiencia en impresión', loro: 'No siempre declarada' },
				produzione: { etichetta: 'Producción', noi: '5 días laborables', loro: '7–15 días laborables' },
				materiali: { etichetta: 'Materiales', noi: 'Materiales premium seleccionados', loro: 'Materiales baratos para contener el precio' },
				durata: { etichetta: 'Duración de la impresión', noi: 'Impresión resistente que no se desvanece', loro: 'Se desvanecen en pocos días' } },
			chiusura: 'Si buscas competencia técnica y pegatinas de alta calidad, estás en el sitio adecuado.',
			nota: 'Si buscas la enésima promo que caduca el domingo y vuelve a empezar el lunes, lo sentimos, no podemos ayudarte :(',
			cta: 'Crea tus pegatinas →' } }
};

const fr: Prodotti = {
	pagina: {
		suOgniOrdine: 'À chaque commande :',
		configura: 'Configurez {cta} ci-dessous ↓',
		cosaTitolo: 'Ce que vous imprimez, exactement',
		mediaRecensioni: 'Note moyenne {media} sur 5.',
		faqTitolo: 'Les questions',
		faqHl: 'les plus fréquentes.',
		faqIntro: 'Vous cherchez d’autres réponses ? Consultez notre <a class="link" href="{href}" style="color:var(--blue)">rubrique d’assistance</a>.',
		materialeVinile: 'Vinyle',
		materialeResina: 'Vinyle avec résine polyuréthane' },
	briciole: { home: 'Accueil', adesivi: 'Stickers', etichette: 'Étiquettes', percorso: 'Fil d’Ariane' },
	stelle: { su5: 'sur 5', valutazione: '{voto} sur 5', recensioniVerificate: 'avis vérifiés' },
	recensioni: {
		regione: 'Avis clients',
		precedenti: 'Avis précédents',
		successive: 'Avis suivants',
		verificata: 'Avis vérifié',
		stelle: '{n} étoiles sur 5',
		nota: 'Avis vérifiés et recueillis après achat.',
		comeGestiamo: 'Comment nous les gérons',
		vaiPagina: 'Aller à la page {n}',
		chiudi: 'Fermer' },
	comeFunziona: {
		titolo: 'On vous les livre',
		hl: 'jusqu’à votre porte.',
		uno: { titolo: 'Envoyez votre fichier', testo: 'PNG, PDF, JPG, SVG. Pas prêt pour l’impression ? Pas de souci : on s’en occupe.' },
		due: { titolo: 'Aperçu immédiat', testo: 'Vous voyez tout de suite la forme et la ligne de découpe, avant de payer. Aucun saut dans l’inconnu.' },
		tre: { titolo: 'Vous validez, on imprime', testo: 'L’aperçu vous plaît ? Vous validez et la commande part aussitôt en production.', spedizione: 'Expédition estimée' },
		quattro: { titolo: 'Recevez vos stickers', testo: 'Livraison express suivie. Et à la réception, laissez-nous un avis comme les autres.' } },
	ctaFinale: {
		titolo: 'Faites-vous remarquer, partout.',
		titolo2: 'Votre marque mérite des stickers',
		hl: 'impossibles à ignorer.',
		prima: 'Commandez aujourd’hui : expédition estimée',
		dopo: 'Et faites tourner votre marque.',
		bottone: 'Je veux mes stickers' },
	campioni: {
		alt: 'Pile de stickers d’échantillon Stickerprint',
		tag: 'Touchez la qualité du doigt',
		titolo: 'Testez',
		hl: 'nos stickers',
		ordina: 'Commander le kit',
		recuperi: 'Remboursé <strong>immédiatement</strong><br />sur votre première commande' },
	confronto: {
		intestazione: 'Le comparatif',
		home: {
			titolo: 'Pourquoi',
			hl: 'Stickerprint ?',
			sotto: 'Nous investissons dans les matériaux, pas dans les promotions.',
			noi: 'Stickerprint',
			loro: 'Autres sites',
			righe: {
				cosa: { etichetta: 'Ce que vous recevez', noi: 'Des stickers personnalisés de haute qualité', loro: 'Des stickers bon marché toujours en promo' },
				anteprima: { etichetta: 'Aperçu du fichier', noi: 'Immédiat, avant même de payer', loro: 'Payant ou inexistant' },
				esperienza: { etichetta: 'Expérience', noi: '19 ans d’expérience dans l’impression', loro: 'Pas toujours précisée' },
				produzione: { etichetta: 'Production', noi: '5 jours ouvrés', loro: '7–15 jours ouvrés' },
				materiali: { etichetta: 'Matériaux', noi: 'Matériaux premium sélectionnés', loro: 'Matériaux bon marché pour tirer le prix vers le bas' },
				durata: { etichetta: 'Tenue de l’impression', noi: 'Impression résistante qui ne se décolore pas', loro: 'Se décolorent en quelques jours' } },
			chiusura: 'Si vous cherchez un vrai savoir-faire technique et des stickers de haute qualité, vous êtes au bon endroit.',
			nota: 'Si vous cherchez l’énième promo qui expire dimanche et recommence lundi, désolé, on ne peut pas vous aider :(',
			cta: 'Créez vos stickers →' } }
};

const de: Prodotti = {
	pagina: {
		suOgniOrdine: 'Bei jeder Bestellung:',
		configura: 'Konfiguriere {cta} hier unten ↓',
		cosaTitolo: 'Was du hier genau druckst',
		mediaRecensioni: 'Durchschnittliche Bewertung {media} von 5.',
		faqTitolo: 'Die häufigsten',
		faqHl: 'Fragen.',
		faqIntro: 'Suchst du weitere Antworten? Schau in unseren <a class="link" href="{href}" style="color:var(--blue)">Hilfebereich</a>.',
		materialeVinile: 'Vinyl',
		materialeResina: 'Vinyl mit Polyurethan-Harz' },
	briciole: { home: 'Startseite', adesivi: 'Aufkleber', etichette: 'Etiketten', percorso: 'Navigationspfad' },
	stelle: { su5: 'von 5', valutazione: '{voto} von 5', recensioniVerificate: 'verifizierte Bewertungen' },
	recensioni: {
		regione: 'Kundenbewertungen',
		precedenti: 'Vorherige Bewertungen',
		successive: 'Nächste Bewertungen',
		verificata: 'Verifizierte Bewertung',
		stelle: '{n} von 5 Sternen',
		nota: 'Verifizierte Bewertungen, nach dem Kauf eingeholt.',
		comeGestiamo: 'So gehen wir damit um',
		vaiPagina: 'Zu Seite {n}',
		chiudi: 'Schließen' },
	comeFunziona: {
		titolo: 'Wir bringen sie dir',
		hl: 'bis an die Haustür.',
		uno: { titolo: 'Lade deine Datei hoch', testo: 'PNG, PDF, JPG, SVG. Auch wenn sie noch nicht druckfertig ist: Das richten wir für dich.' },
		due: { titolo: 'Sofortige Vorschau', testo: 'Du siehst sofort Kontur und Schnittlinie, bevor du bezahlst. Kein Sprung ins Ungewisse.' },
		tre: { titolo: 'Du bestätigst, wir drucken', testo: 'Gefällt dir die Vorschau? Du bestätigst und die Bestellung geht direkt in die Produktion.', spedizione: 'Voraussichtlicher Versand' },
		quattro: { titolo: 'Du bekommst deine Aufkleber', testo: 'Express-Versand mit Sendungsverfolgung. Und wenn sie da sind, hinterlässt du uns eine Bewertung wie die anderen.' } },
	ctaFinale: {
		titolo: 'Fall auf, überall.',
		titolo2: 'Deine Marke verdient Aufkleber, die man',
		hl: 'nicht übersehen kann.',
		prima: 'Bestell heute: voraussichtlicher Versand',
		dopo: 'Und bring deine Marke unter die Leute.',
		bottone: 'Ich will meine Aufkleber' },
	campioni: {
		alt: 'Stapel Muster-Aufkleber von Stickerprint',
		tag: 'Fühl die Qualität selbst',
		titolo: 'Teste',
		hl: 'unsere Aufkleber',
		ordina: 'Set bestellen',
		recuperi: 'Bekommst du <strong>sofort</strong><br />mit der ersten Bestellung zurück' },
	confronto: {
		intestazione: 'Der Vergleich',
		home: {
			titolo: 'Warum',
			hl: 'Stickerprint?',
			sotto: 'Wir investieren in Materialien, nicht in Rabattaktionen.',
			noi: 'Stickerprint',
			loro: 'Andere Shops',
			righe: {
				cosa: { etichetta: 'Was bekommst du?', noi: 'Individuelle Aufkleber in hoher Qualität', loro: 'Billige Aufkleber, immer im Angebot' },
				anteprima: { etichetta: 'Dateivorschau', noi: 'Sofort, noch vor dem Bezahlen', loro: 'Kostenpflichtig oder gar nicht' },
				esperienza: { etichetta: 'Erfahrung', noi: '19 Jahre Erfahrung im Druck', loro: 'Nicht immer angegeben' },
				produzione: { etichetta: 'Produktion', noi: '5 Werktage', loro: '7–15 Werktage' },
				materiali: { etichetta: 'Materialien', noi: 'Ausgewählte Premium-Materialien', loro: 'Billige Materialien, um den Preis zu drücken' },
				durata: { etichetta: 'Haltbarkeit des Drucks', noi: 'Widerstandsfähiger Druck, der nicht verblasst', loro: 'Verblassen nach wenigen Tagen' } },
			chiusura: 'Wenn du technisches Know-how und hochwertige Aufkleber suchst, bist du hier richtig.',
			nota: 'Wenn du die x-te Aktion suchst, die Sonntag endet und Montag wieder anfängt, können wir dir leider nicht helfen :(',
			cta: 'Erstelle deine Aufkleber →' } }
};

const nl: Prodotti = {
	pagina: {
		suOgniOrdine: 'Bij elke bestelling:',
		configura: 'Stel {cta} hieronder samen ↓',
		cosaTitolo: 'Wat je precies laat drukken',
		mediaRecensioni: 'Gemiddelde beoordeling {media} van 5.',
		faqTitolo: 'De meestgestelde',
		faqHl: 'vragen.',
		faqIntro: 'Zoek je meer antwoorden? Kijk bij onze <a class="link" href="{href}" style="color:var(--blue)">klantenservice</a>.',
		materialeVinile: 'Vinyl',
		materialeResina: 'Vinyl met polyurethaanhars' },
	briciole: { home: 'Home', adesivi: 'Stickers', etichette: 'Etiketten', percorso: 'Kruimelpad' },
	stelle: { su5: 'van 5', valutazione: '{voto} van 5', recensioniVerificate: 'geverifieerde beoordelingen' },
	recensioni: {
		regione: 'Klantbeoordelingen',
		precedenti: 'Vorige beoordelingen',
		successive: 'Volgende beoordelingen',
		verificata: 'Geverifieerde beoordeling',
		stelle: '{n} van 5 sterren',
		nota: 'Geverifieerde beoordelingen, verzameld na aankoop.',
		comeGestiamo: 'Zo gaan we ermee om',
		vaiPagina: 'Ga naar pagina {n}',
		chiudi: 'Sluiten' },
	comeFunziona: {
		titolo: 'We brengen ze',
		hl: 'tot aan je deur.',
		uno: { titolo: 'Upload je bestand', testo: 'PNG, PDF, JPG, SVG. Nog niet drukklaar? Geen probleem: dat regelen wij.' },
		due: { titolo: 'Direct een voorbeeld', testo: 'Je ziet meteen de vorm en de snijlijn, nog voor je betaalt. Geen sprong in het duister.' },
		tre: { titolo: 'Jij bevestigt, wij drukken', testo: 'Blij met het voorbeeld? Bevestig en je bestelling gaat meteen in productie.', spedizione: 'Verwachte verzending' },
		quattro: { titolo: 'Je ontvangt je stickers', testo: 'Expreskoerier met track & trace. En als ze binnen zijn, laat je net als de anderen een beoordeling achter.' } },
	ctaFinale: {
		titolo: 'Val op, overal.',
		titolo2: 'Jouw merk verdient stickers die',
		hl: 'niemand over het hoofd ziet.',
		prima: 'Bestel vandaag: verwachte verzending',
		dopo: 'En laat je merk rondgaan.',
		bottone: 'Ik wil mijn stickers' },
	campioni: {
		alt: 'Stapel proefstickers van Stickerprint',
		tag: 'Voel de kwaliteit zelf',
		titolo: 'Probeer',
		hl: 'onze stickers',
		ordina: 'Bestel het pakket',
		recuperi: 'Krijg je <strong>meteen</strong><br />terug bij je eerste bestelling' },
	confronto: {
		intestazione: 'De vergelijking',
		home: {
			titolo: 'Waarom',
			hl: 'Stickerprint?',
			sotto: 'Wij investeren in materialen, niet in acties.',
			noi: 'Stickerprint',
			loro: 'Andere sites',
			righe: {
				cosa: { etichetta: 'Wat krijg je?', noi: 'Stickers op maat van hoge kwaliteit', loro: 'Goedkope stickers, altijd in de aanbieding' },
				anteprima: { etichetta: 'Voorbeeld van je bestand', noi: 'Direct, nog voor je betaalt', loro: 'Tegen betaling of helemaal niet' },
				esperienza: { etichetta: 'Ervaring', noi: '19 jaar ervaring in drukwerk', loro: 'Niet altijd vermeld' },
				produzione: { etichetta: 'Productie', noi: '5 werkdagen', loro: '7–15 werkdagen' },
				materiali: { etichetta: 'Materialen', noi: 'Geselecteerde premium materialen', loro: 'Goedkope materialen om de prijs laag te houden' },
				durata: { etichetta: 'Levensduur van de print', noi: 'Sterke print die niet vervaagt', loro: 'Vervagen na een paar dagen' } },
			chiusura: 'Zoek je technische kennis en stickers van hoge kwaliteit? Dan zit je hier goed.',
			nota: 'Zoek je de zoveelste actie die zondag afloopt en maandag weer begint? Dan kunnen we je helaas niet helpen :(',
			cta: 'Maak je stickers →' } }
};
export const prodotti: Record<Lang, Prodotti> = { it, en, es, fr, de, nl };
