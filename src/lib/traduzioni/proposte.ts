/**
 * Area "proposte": i testi che la dashboard PROPONE allo staff per le email scritte a mano (preventivo, conferma
 * d'ordine, fattura), nella lingua del cliente. Regola di Mattia del 26/11/2026: tutto quello che arriva al cliente e'
 * nella sua lingua; prima il testo proposto era sempre in italiano, anche per un cliente tedesco.
 * Testo semplice (niente HTML): finisce in una textarea che lo staff puo' ritoccare. Sempre al plurale, mai il nome di
 * chi segue: la firma e' {firma} = «Stickerprint-Staff». Forma = it; le altre lingue devono avere le stesse chiavi.
 */
import type { Lang } from '$lib/i18n';

const it = {
	daConfermare: 'da confermare',
	ivaInclusa: ' IVA inclusa',
	preventivo: {
		oggetto: 'Il tuo preventivo {n}: {cosa}',
		cosaDefault: 'la tua richiesta',
		corpo: 'Ciao {nome},\n\nti abbiamo finalmente preparato il preventivo richiesto: lo trovi nel link qui sotto, con tutti i dettagli.',
		anticipato: '\nPer confermarlo basta un clic dalla pagina. Puoi pagare con carta di credito, PayPal o bonifico bancario: una volta saldato, il tuo ordine entrerà automaticamente in produzione.',
		chiusura: '\nSe qualcosa non torna scrivici pure.\n\nA presto,\n{firma}'
	},
	conferma: {
		oggetto: 'La tua conferma d\'ordine {n}: {cosa}',
		articoli: '{n} articoli',
		corpo: 'Ciao {nome},\n\nti confermiamo l\'ordine {n} per {cosa}, totale {totale}{iva}{spedizione}. Dal bottone qui sotto puoi controllare tutti i dettagli (articoli, indirizzi, scadenze) e scaricare il PDF.',
		spedizione: ', spedizione prevista {data}',
		daPagare: '\n\nPer far partire la produzione manca il pagamento anticipato di {importo}. Puoi pagare con carta di credito, PayPal o bonifico bancario dalla pagina qui sotto: una volta saldato, il tuo ordine entrerà automaticamente in produzione.',
		inLavorazione: '\n\nL\'ordine è già in lavorazione.',
		chiusura: '\n\nSe qualcosa non torna, segnalacelo direttamente dalla pagina: lo sistemiamo prima di stampare.\n\nA presto,\n{firma}'
	},
	fattura: {
		oggetto: 'La tua fattura {n} di Stickerprint',
		corpo: 'Ciao {nome},\n\nti mandiamo la fattura {n} del {data}{ordine}, totale {totale}{iva}. Dal bottone qui sotto la vedi nel dettaglio e scarichi il PDF.',
		ordine: ' per l\'ordine {n}',
		saldata: 'La fattura risulta già saldata: è solo per i tuoi archivi.',
		ribaUna: 'L\'importo di {importo} verrà addebitato con ricevuta bancaria alla scadenza del {data}: non devi fare nulla.',
		ribaTante: 'Gli importi verranno addebitati con ricevuta bancaria alle scadenze indicate nella pagina: non devi fare nulla.',
		paga: 'Dalla pagina puoi pagare subito con carta o vedere i dati per il bonifico{scadenze}.',
		perScadenza: ', scadenza per scadenza',
		chiusura: 'Per qualsiasi cosa (intestazione, importi, scadenze) scrivici dalla pagina o rispondi a questa email.\n\nGrazie e a presto,\n{firma}'
	}
};
export type Proposte = typeof it;

const en: Proposte = {
	daConfermare: 'to be confirmed',
	ivaInclusa: ' including VAT',
	preventivo: {
		oggetto: 'Your quote {n}: {cosa}',
		cosaDefault: 'your request',
		corpo: 'Hi {nome},\n\nyour quote is ready: you will find it at the link below, with all the details.',
		anticipato: '\nTo confirm it, just one click on the page. You can pay by credit card, PayPal or bank transfer: once paid, your order goes into production automatically.',
		chiusura: '\nIf anything looks wrong, just write to us.\n\nBest regards,\n{firma}'
	},
	conferma: {
		oggetto: 'Your order confirmation {n}: {cosa}',
		articoli: '{n} items',
		corpo: 'Hi {nome},\n\nwe confirm order {n} for {cosa}, total {totale}{iva}{spedizione}. Use the button below to check all the details (items, addresses, due dates) and download the PDF.',
		spedizione: ', expected to ship on {data}',
		daPagare: '\n\nTo start production we still need the advance payment of {importo}. You can pay by credit card, PayPal or bank transfer from the page below: once paid, your order goes into production automatically.',
		inLavorazione: '\n\nThe order is already in production.',
		chiusura: '\n\nIf anything looks wrong, tell us straight from the page: we will fix it before printing.\n\nBest regards,\n{firma}'
	},
	fattura: {
		oggetto: 'Your Stickerprint invoice {n}',
		corpo: 'Hi {nome},\n\nhere is invoice {n} dated {data}{ordine}, total {totale}{iva}. Use the button below to see it in detail and download the PDF.',
		ordine: ' for order {n}',
		saldata: 'The invoice is already paid: it is only for your records.',
		ribaUna: 'The amount of {importo} will be collected by bank receipt on the due date, {data}: there is nothing you need to do.',
		ribaTante: 'The amounts will be collected by bank receipt on the due dates shown on the page: there is nothing you need to do.',
		paga: 'From the page you can pay right away by card or see the bank transfer details{scadenze}.',
		perScadenza: ', one due date at a time',
		chiusura: 'For anything (billing details, amounts, due dates) write to us from the page or reply to this email.\n\nThank you and best regards,\n{firma}'
	}
};

const es: Proposte = {
	daConfermare: 'por confirmar',
	ivaInclusa: ' IVA incluido',
	preventivo: {
		oggetto: 'Tu presupuesto {n}: {cosa}',
		cosaDefault: 'tu solicitud',
		corpo: 'Hola {nome}:\n\nya tenemos listo el presupuesto que nos pediste: lo encuentras en el enlace de abajo, con todos los detalles.',
		anticipato: '\nPara confirmarlo basta un clic desde la página. Puedes pagar con tarjeta de crédito, PayPal o transferencia bancaria: una vez pagado, tu pedido entrará automáticamente en producción.',
		chiusura: '\nSi algo no cuadra, escríbenos.\n\nUn saludo,\n{firma}'
	},
	conferma: {
		oggetto: 'Tu confirmación de pedido {n}: {cosa}',
		articoli: '{n} artículos',
		corpo: 'Hola {nome}:\n\nte confirmamos el pedido {n} de {cosa}, total {totale}{iva}{spedizione}. Desde el botón de abajo puedes revisar todos los detalles (artículos, direcciones, vencimientos) y descargar el PDF.',
		spedizione: ', envío previsto el {data}',
		daPagare: '\n\nPara empezar la producción falta el pago por adelantado de {importo}. Puedes pagar con tarjeta de crédito, PayPal o transferencia bancaria desde la página de abajo: una vez pagado, tu pedido entrará automáticamente en producción.',
		inLavorazione: '\n\nEl pedido ya está en producción.',
		chiusura: '\n\nSi algo no cuadra, avísanos directamente desde la página: lo corregimos antes de imprimir.\n\nUn saludo,\n{firma}'
	},
	fattura: {
		oggetto: 'Tu factura {n} de Stickerprint',
		corpo: 'Hola {nome}:\n\nte enviamos la factura {n} del {data}{ordine}, total {totale}{iva}. Desde el botón de abajo la ves en detalle y descargas el PDF.',
		ordine: ' del pedido {n}',
		saldata: 'La factura ya está pagada: es solo para tu archivo.',
		ribaUna: 'El importe de {importo} se cobrará por recibo bancario al vencimiento del {data}: no tienes que hacer nada.',
		ribaTante: 'Los importes se cobrarán por recibo bancario en los vencimientos indicados en la página: no tienes que hacer nada.',
		paga: 'Desde la página puedes pagar ahora con tarjeta o ver los datos para la transferencia{scadenze}.',
		perScadenza: ', vencimiento por vencimiento',
		chiusura: 'Para cualquier cosa (datos de facturación, importes, vencimientos) escríbenos desde la página o responde a este correo.\n\nGracias y un saludo,\n{firma}'
	}
};

const fr: Proposte = {
	daConfermare: 'à confirmer',
	ivaInclusa: ' TTC',
	preventivo: {
		oggetto: 'Votre devis {n} : {cosa}',
		cosaDefault: 'votre demande',
		corpo: 'Bonjour {nome},\n\nnous avons préparé le devis demandé : vous le trouverez via le lien ci-dessous, avec tous les détails.',
		anticipato: '\nPour le confirmer, un clic suffit depuis la page. Vous pouvez payer par carte bancaire, PayPal ou virement : une fois le paiement reçu, votre commande part automatiquement en production.',
		chiusura: '\nSi quelque chose ne convient pas, écrivez-nous.\n\nÀ bientôt,\n{firma}'
	},
	conferma: {
		oggetto: 'Votre confirmation de commande {n} : {cosa}',
		articoli: '{n} articles',
		corpo: 'Bonjour {nome},\n\nnous vous confirmons la commande {n} pour {cosa}, total {totale}{iva}{spedizione}. Avec le bouton ci-dessous, vous pouvez vérifier tous les détails (articles, adresses, échéances) et télécharger le PDF.',
		spedizione: ', expédition prévue le {data}',
		daPagare: '\n\nPour lancer la production, il manque le paiement anticipé de {importo}. Vous pouvez payer par carte bancaire, PayPal ou virement depuis la page ci-dessous : une fois le paiement reçu, votre commande part automatiquement en production.',
		inLavorazione: '\n\nLa commande est déjà en production.',
		chiusura: '\n\nSi quelque chose ne convient pas, signalez-le directement depuis la page : nous corrigeons avant d\'imprimer.\n\nÀ bientôt,\n{firma}'
	},
	fattura: {
		oggetto: 'Votre facture {n} de Stickerprint',
		corpo: 'Bonjour {nome},\n\nvoici la facture {n} du {data}{ordine}, total {totale}{iva}. Avec le bouton ci-dessous, vous la consultez en détail et téléchargez le PDF.',
		ordine: ' pour la commande {n}',
		saldata: 'La facture est déjà réglée : elle est uniquement pour vos archives.',
		ribaUna: 'Le montant de {importo} sera prélevé par effet bancaire à l\'échéance du {data} : vous n\'avez rien à faire.',
		ribaTante: 'Les montants seront prélevés par effet bancaire aux échéances indiquées sur la page : vous n\'avez rien à faire.',
		paga: 'Depuis la page, vous pouvez payer tout de suite par carte ou voir les coordonnées pour le virement{scadenze}.',
		perScadenza: ', échéance par échéance',
		chiusura: 'Pour toute question (coordonnées de facturation, montants, échéances), écrivez-nous depuis la page ou répondez à cet e-mail.\n\nMerci et à bientôt,\n{firma}'
	}
};

const de: Proposte = {
	daConfermare: 'wird noch bestätigt',
	ivaInclusa: ' inkl. MwSt.',
	preventivo: {
		oggetto: 'Dein Angebot {n}: {cosa}',
		cosaDefault: 'deine Anfrage',
		corpo: 'Hallo {nome},\n\nwir haben das gewünschte Angebot für dich vorbereitet: Du findest es über den Link unten, mit allen Details.',
		anticipato: '\nZum Bestätigen genügt ein Klick auf der Seite. Du kannst mit Kreditkarte, PayPal oder Banküberweisung zahlen: Sobald die Zahlung eingegangen ist, geht deine Bestellung automatisch in Produktion.',
		chiusura: '\nWenn etwas nicht passt, schreib uns einfach.\n\nBis bald,\n{firma}'
	},
	conferma: {
		oggetto: 'Deine Auftragsbestätigung {n}: {cosa}',
		articoli: '{n} Artikel',
		corpo: 'Hallo {nome},\n\nwir bestätigen die Bestellung {n} über {cosa}, Gesamtbetrag {totale}{iva}{spedizione}. Über den Button unten kannst du alle Details prüfen (Artikel, Adressen, Fälligkeiten) und das PDF herunterladen.',
		spedizione: ', voraussichtlicher Versand am {data}',
		daPagare: '\n\nFür den Produktionsstart fehlt noch die Vorauszahlung von {importo}. Du kannst mit Kreditkarte, PayPal oder Banküberweisung über die Seite unten zahlen: Sobald die Zahlung eingegangen ist, geht deine Bestellung automatisch in Produktion.',
		inLavorazione: '\n\nDie Bestellung ist bereits in Produktion.',
		chiusura: '\n\nWenn etwas nicht passt, melde es uns direkt über die Seite: Wir korrigieren es vor dem Druck.\n\nBis bald,\n{firma}'
	},
	fattura: {
		oggetto: 'Deine Rechnung {n} von Stickerprint',
		corpo: 'Hallo {nome},\n\nanbei die Rechnung {n} vom {data}{ordine}, Gesamtbetrag {totale}{iva}. Über den Button unten siehst du sie im Detail und lädst das PDF herunter.',
		ordine: ' zur Bestellung {n}',
		saldata: 'Die Rechnung ist bereits bezahlt: Sie ist nur für deine Unterlagen.',
		ribaUna: 'Der Betrag von {importo} wird zur Fälligkeit am {data} per Bankeinzug abgebucht: Du musst nichts tun.',
		ribaTante: 'Die Beträge werden zu den auf der Seite angegebenen Fälligkeiten per Bankeinzug abgebucht: Du musst nichts tun.',
		paga: 'Über die Seite kannst du sofort mit Karte zahlen oder die Daten für die Überweisung sehen{scadenze}.',
		perScadenza: ', Fälligkeit für Fälligkeit',
		chiusura: 'Bei Fragen (Rechnungsdaten, Beträge, Fälligkeiten) schreib uns über die Seite oder antworte auf diese E-Mail.\n\nDanke und bis bald,\n{firma}'
	}
};

const nl: Proposte = {
	daConfermare: 'nog te bevestigen',
	ivaInclusa: ' incl. btw',
	preventivo: {
		oggetto: 'Je offerte {n}: {cosa}',
		cosaDefault: 'je aanvraag',
		corpo: 'Hallo {nome},\n\nwe hebben de gevraagde offerte voor je klaargezet: je vindt hem via de link hieronder, met alle details.',
		anticipato: '\nBevestigen kan met één klik op de pagina. Je kunt betalen met creditcard, PayPal of bankoverschrijving: zodra de betaling binnen is, gaat je bestelling automatisch in productie.',
		chiusura: '\nKlopt er iets niet, laat het ons gerust weten.\n\nTot snel,\n{firma}'
	},
	conferma: {
		oggetto: 'Je orderbevestiging {n}: {cosa}',
		articoli: '{n} artikelen',
		corpo: 'Hallo {nome},\n\nwe bevestigen bestelling {n} voor {cosa}, totaal {totale}{iva}{spedizione}. Via de knop hieronder kun je alle details controleren (artikelen, adressen, vervaldata) en de pdf downloaden.',
		spedizione: ', verwachte verzending op {data}',
		daPagare: '\n\nOm de productie te starten ontbreekt nog de vooruitbetaling van {importo}. Je kunt betalen met creditcard, PayPal of bankoverschrijving via de pagina hieronder: zodra de betaling binnen is, gaat je bestelling automatisch in productie.',
		inLavorazione: '\n\nDe bestelling is al in productie.',
		chiusura: '\n\nKlopt er iets niet, meld het direct via de pagina: we passen het aan voordat we drukken.\n\nTot snel,\n{firma}'
	},
	fattura: {
		oggetto: 'Je factuur {n} van Stickerprint',
		corpo: 'Hallo {nome},\n\nhierbij factuur {n} van {data}{ordine}, totaal {totale}{iva}. Via de knop hieronder bekijk je hem in detail en download je de pdf.',
		ordine: ' voor bestelling {n}',
		saldata: 'De factuur is al betaald: hij is alleen voor je administratie.',
		ribaUna: 'Het bedrag van {importo} wordt op de vervaldatum, {data}, via bankincasso afgeschreven: je hoeft niets te doen.',
		ribaTante: 'De bedragen worden op de vervaldata op de pagina via bankincasso afgeschreven: je hoeft niets te doen.',
		paga: 'Via de pagina kun je direct met kaart betalen of de gegevens voor de overschrijving bekijken{scadenze}.',
		perScadenza: ', per vervaldatum',
		chiusura: 'Voor alles (factuurgegevens, bedragen, vervaldata) kun je ons schrijven via de pagina of op deze e-mail antwoorden.\n\nBedankt en tot snel,\n{firma}'
	}
};

export const proposte: Record<Lang, Proposte> = { it, en, es, fr, de, nl };
