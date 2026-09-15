import * as T from '$lib/server/email-templates';
import { sendEmail } from '$lib/server/email';
import { adminClient } from '$lib/server/admin';
import { createReviewRequest } from '$lib/server/recensioni';
import type { RequestHandler } from './$types';

/**
 * Anteprima di tutte le email del sito con dati di esempio: /dashboard/setup/email-anteprima?kind=<nome>
 * ?invia=1 la manda all'indirizzo dello staff loggato; ?kind=tutte&invia=1 le manda tutte, una dopo l'altra.
 */
export const GET: RequestHandler = async ({ url, locals: { user } }) => {
	const o = url.origin;
	const items = [{ name: 'Adesivi personalizzati sagomato', meta: 'bianco · 40×40 mm', qty: 15, preview: `${o}/images/prodotti/rilievo/1.webp` }, { name: 'Kit di adesivi (4 adesivi)', qty: 10, preview: `${o}/images/prodotti/rilievo/2.webp` }];
	const ship = { name: 'Mattia', number: 'SP00037', trackingUrl: 'https://tracking.qapla.it/51df4308/SP00037', courier: 'GLS-ITA', items, accountUrl: `${o}/account/ordini` };
	const staffMsg = (cosa: string) => `Ciao Mattia,\n\nti ho preparato ${cosa}: la trovi nel link qui sotto, con tutti i dettagli.\nSe qualcosa non torna scrivimi pure rispondendo a questa email.\n\nA presto,\nMattia`;
	const ALL: Record<string, () => { subject: string; html: string; tag?: string }> = {
		benvenuto: () => T.welcomeEmail({ name: 'Mattia', email: 'mattia@stickerprint.it' }),
		password_cambiata: () => T.passwordChangedEmail({ email: 'mattia@stickerprint.it' }),
		contatto_ricevuto: () => T.contactAutoReplyEmail({ name: 'Mattia' }),
		conferma: () => T.orderConfirmationEmail({ name: 'Mattia', numbers: ['SP00037'], invoiceNumber: 'SPF00015', total: '67,25 €', lines: items, shipDate: 'martedì 22 settembre', accountUrl: null }),
		conferma_account: () => T.orderConfirmationEmail({ name: 'Mattia', numbers: ['SP00037'], invoiceNumber: 'SPF00015', total: '67,25 €', lines: items, shipDate: 'martedì 22 settembre', accountUrl: `${o}/account/ordini` }),
		ordine_manuale: () => T.manualOrderEmail({ name: 'Mattia', number: 'SP00030', total: '290,36 €', lines: items, shipDate: 'mercoledì 30 settembre', terms: ['Bonifico anticipato 50% · 145,18 € · 16/09/2026', 'Bonifico a 30 gg · 145,18 € · 16/10/2026'] }),
		affidato: () => T.shippingUpdateEmail({ ...ship, kind: 'affidato' }),
		spedito: () => T.shippingUpdateEmail({ ...ship, kind: 'spedito' }),
		in_consegna: () => T.shippingUpdateEmail({ ...ship, kind: 'in_consegna', place: 'Milano' }),
		problema: () => T.shippingUpdateEmail({ ...ship, kind: 'problema', detail: 'GIACENZA', place: 'Milano' }),
		punto_ritiro: () => T.shippingUpdateEmail({ ...ship, kind: 'punto_ritiro', place: 'Tabaccheria Rossi, via Roma 12, Milano' }),
		ritardo_corriere: () => T.shippingUpdateEmail({ ...ship, kind: 'ritardo_corriere', detail: 'In ritardo', place: 'Hub di Bologna', shippedAt: '12/09/2026' }),
		ritardo_nostro: () => T.shippingUpdateEmail({ ...ship, kind: 'ritardo_nostro', newDate: 'mercoledì 17 settembre' }),
		recensione: () => T.reviewRequestEmail({ name: 'Mattia', number: 'SP00037', items, href: `${o}/account/recensioni` }),
		recensione_grazie: () => T.reviewThanksEmail({ name: 'Mattia', number: 'SP00037', code: 'GRAZIE-7K3P2Q', validUntil: '15 marzo 2027', href: `${o}/` }),
		preventivo: () => T.quoteEmail({ subject: 'Il tuo preventivo SPP00001 è pronto', message: 'Ciao Mattia,\n\nti abbiamo finalmente preparato il preventivo richiesto: lo trovi nel link qui sotto, con tutti i dettagli.\nSe qualcosa non torna scrivimi pure.\n\nA presto,\nMattia', senderName: 'Mattia', number: 'SPP00001', validUntil: '30 settembre 2026', href: `${o}/preventivo/esempio` }),
		preventivo_sollecito: () => T.quoteReminderEmail({ name: 'Mattia', number: 'SPP00001', validUntil: '30 settembre 2026', href: `${o}/preventivo/esempio`, senderName: 'Mattia' }),
		preventivo_risposta: () => T.quoteReplyEmail({ name: 'Mattia', number: 'SPP00001', body: 'Sì, possiamo fare anche la versione opaca: stesso prezzo, stessi tempi.', author: 'Mattia', href: `${o}/preventivo/esempio` }),
		ticket_ricevuto: () => T.ticketReceivedEmail({ name: 'Mattia', number: 'HD00001', href: `${o}/assistenza/esempio` }),
		ticket_risposta: () => T.ticketReplyEmail({ name: 'Mattia', number: 'HD00001', body: 'Ho controllato la spedizione: il corriere passa domani mattina. Ti mando il tracking aggiornato.', author: 'Mattia', href: `${o}/assistenza/esempio` }),
		conferma_manuale: () => T.orderConfirmEmail({ subject: "Conferma d'ordine SP00030", message: staffMsg("la conferma d'ordine per le vetrofanie"), senderName: 'Mattia', number: 'SP00030', href: `${o}/conferma/esempio`, toPay: '145,18 €' }),
		ordine_risposta: () => T.orderReplyEmail({ name: 'Mattia', number: 'SP00030', body: 'Ho corretto l’indirizzo di consegna come mi hai chiesto: la conferma aggiornata è nella pagina.', author: 'Mattia', href: `${o}/conferma/esempio` }),
		pagamento_sollecito: () => T.orderPaymentReminderEmail({ name: 'Mattia', number: 'SP00030', amount: '145,18 €', href: `${o}/conferma/esempio`, senderName: 'Mattia' }),
		fattura: () => T.invoiceEmail({ subject: 'Fattura SPF00012', message: staffMsg('la fattura SPF00012 del tuo ordine SP00030'), senderName: 'Mattia', number: 'SPF00012', href: `${o}/fattura/esempio`, toPay: '170,80 €' }),
		fattura_risposta: () => T.invoiceReplyEmail({ name: 'Mattia', number: 'SPF00012', body: 'Ti confermo che il bonifico è arrivato: la fattura risulta saldata.', author: 'Mattia', href: `${o}/fattura/esempio` })
	};
	const kind = url.searchParams.get('kind') ?? 'conferma';
	const send = url.searchParams.get('invia') === '1' && !!user?.email;
	const kinds = kind === 'tutte' ? Object.keys(ALL) : [kind];
	if (!ALL[kinds[0]]) return new Response(`Email non trovata. Disponibili: ${Object.keys(ALL).join(', ')}, tutte`, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
	if (!send) return new Response(ALL[kinds[0]]().html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
	const out: string[] = [];
	for (const k of kinds) {
		const mail = ALL[k]();
		let html = mail.html;
		/* la prova della richiesta di recensione viene tracciata come una vera (compare in Recensioni › Inviate come "PROVA") */
		const a = adminClient();
		if (k === 'recensione' && a) {
			const reqId = await createReviewRequest(a, { orderId: null, checkoutGroup: null, number: 'PROVA', email: user!.email!, name: 'Mattia' });
			if (reqId) html = T.reviewRequestEmail({ name: 'Mattia', number: 'PROVA', items, href: `${o}/account/recensioni?r=${reqId}` }).html.replace('</body>', `<img src="${o}/api/track/open/${reqId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;"></body>`);
		}
		const r = await sendEmail({ to: user!.email!, ...mail, html, metadata: { anteprima: k } });
		out.push(`${r.ok ? '✓' : '✗'} ${k}: ${mail.subject}${r.ok ? '' : ` (${r.error})`}`);
	}
	return new Response(`Inviate a ${user!.email}:\n\n${out.join('\n')}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
