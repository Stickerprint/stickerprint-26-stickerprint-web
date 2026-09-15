import { env } from '$env/dynamic/private';
import { PUBLIC_SITE_URL } from '$env/static/public';

/**
 * Template email transazionali. Tutti condividono lo stesso layout brand.
 * Ogni funzione restituisce { subject, html, tag }.
 */

const SITE = PUBLIC_SITE_URL || 'https://stickerprint.it';

function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}


/** riga prodotto nelle email: mockup generato dal sito, nome, quantita' e (opzionale) bottone a destra */
export interface EmailItem { name: string; qty?: number | null; preview?: string | null; meta?: string | null; cta?: { label: string; href: string } | null }
export function itemsBlock(items: (string | EmailItem)[]): string {
	if (!items.length) return '';
	const rows = items.map((raw) => {
		const i: EmailItem = typeof raw === 'string' ? { name: raw } : raw;
		const img = i.preview ? `<img src="${i.preview}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;object-fit:contain;border-radius:12px;background:#f4f5fa;">` : `<div style="width:96px;height:96px;border-radius:12px;background:#f4f5fa;"></div>`;
		const qty = i.qty ? `<span style="color:#8e92b0;">${Number(i.qty).toLocaleString('it-IT')} pz</span>` : '';
		const cta = i.cta ? `<td align="right" valign="middle" style="padding-left:12px;white-space:nowrap;"><a href="${i.cta.href}" style="display:inline-block;background:#f4b400;color:#0b0b3b;text-decoration:none;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.02em;padding:11px 16px;border-radius:8px;">${esc(i.cta.label)}</a></td>` : '';
		return `<tr><td style="padding:10px 0;border-top:1px solid #eceef5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="96" valign="middle">${img}</td><td valign="middle" style="padding-left:14px;font-size:15px;line-height:1.4;color:#0b0b3b;"><b>${esc(i.name)}</b>${i.meta ? `<br><span style="color:#8e92b0;font-size:13px;">${esc(i.meta)}</span>` : ''}${qty ? `<br>${qty}` : ''}</td>${cta}</tr></table></td></tr>`;
	}).join('');
	return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;border-bottom:1px solid #eceef5;">${rows}</table>`;
}

function layout(title: string, body: string, cta?: { label: string; href: string }): string {
	return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&family=Montserrat:wght@400;600;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#f4f5fa;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#0b0b3b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5fa;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;overflow:hidden;">
  <tr><td style="background:#050538;padding:26px 32px;text-align:center;">
    <img src="${SITE}/images/splogo-400.png" width="120" alt="Stickerprint" style="display:inline-block;transform:rotate(-5deg);">
  </td></tr>
  <tr><td style="padding:34px 32px 10px;">
    <h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:28px;line-height:1.2;letter-spacing:-0.02em;color:#0b0b3b;">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3d3f63;">${body}</div>
    ${cta ? `<p style="margin:28px 0 8px;text-align:center;"><a href="${cta.href}" style="display:inline-block;background:#0e8bff;color:#fff;text-decoration:none;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;text-transform:uppercase;font-size:14px;letter-spacing:.02em;padding:14px 28px;border-radius:8px;">${esc(cta.label)}</a></p>` : ''}
  </td></tr>
  <tr><td style="padding:18px 32px 30px;font-size:12px;color:#8e92b0;line-height:1.5;">
    Stickerprint Srl · Adesivi personalizzati stampati in Italia<br>
    Hai bisogno di aiuto? Rispondi a questa email o scrivi a <a href="mailto:info@stickerprint.it" style="color:#0e8bff;">info@stickerprint.it</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function welcomeEmail(opts: { name?: string | null; email: string }) {
	const name = opts.name?.trim() || 'benvenuto';
	return {
		subject: 'Benvenuto su Stickerprint 🎉',
		tag: 'welcome',
		html: layout(
			`Ciao ${esc(name)}, il tuo account è pronto.`,
			`<p>Da oggi ogni ordine ti lascia qualcosa: <strong>fino al 6% in Credito Stickerprint</strong> finisce automaticamente nel tuo portafoglio e puoi usarlo sul prossimo ordine.</p>
			 <p>Carica il tuo file, guarda subito l’anteprima automatica e conferma solo quando sei soddisfatto. Un umano controlla ogni file prima della stampa.</p>`,
			{ label: 'Inizia a stampare', href: `${SITE}/adesivi-personalizzati` }
		)
	};
}

export function passwordChangedEmail(opts: { email: string }) {
	return {
		subject: 'La tua password Stickerprint è stata aggiornata',
		tag: 'security',
		html: layout(
			'Password aggiornata',
			`<p>La password dell’account <strong>${esc(opts.email)}</strong> è stata modificata correttamente.</p>
			 <p>Se non sei stato tu, reimposta subito la password e contattaci.</p>`,
			{ label: 'Reimposta password', href: `${SITE}/reset-password` }
		)
	};
}

export function contactRequestEmail(opts: { name: string; email: string; message: string; kind: 'support' | 'business' }) {
	const title = opts.kind === 'business' ? 'Nuova richiesta aziendale' : 'Nuova richiesta di supporto';
	return {
		subject: `${title} da ${opts.name}`,
		tag: opts.kind === 'business' ? 'business-request' : 'support-request',
		html: layout(
			title,
			`<p><strong>Nome:</strong> ${esc(opts.name)}<br><strong>Email:</strong> ${esc(opts.email)}</p>
			 <p style="white-space:pre-wrap;background:#f4f5fa;padding:14px;border-radius:10px;">${esc(opts.message)}</p>`
		)
	};
}

export function contactAutoReplyEmail(opts: { name: string }) {
	return {
		subject: 'Abbiamo ricevuto la tua richiesta',
		tag: 'auto-reply',
		html: layout(
			`Grazie ${esc(opts.name)}, ci pensiamo noi.`,
			`<p>La tua richiesta è arrivata in laboratorio. Ti rispondiamo di solito entro un giorno lavorativo.</p>`
		)
	};
}

/** Notifica generica interna (titolare/produzione) */
export function ownerNotifyEmail(opts: { title: string; lines: string[]; href?: string }) {
	return {
		subject: `[Stickerprint] ${opts.title}`,
		tag: 'owner-notification',
		html: layout(
			opts.title,
			`<ul style="padding-left:18px;">${opts.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
			opts.href ? { label: 'Apri', href: opts.href } : undefined
		)
	};
}

export const OWNER_EMAIL = env.OWNER_NOTIFY_EMAIL || 'info@stickerprint.it';

export function orderConfirmationEmail(opts: { name?: string | null; numbers: string[]; invoiceNumber: string; total: string; lines: (string | EmailItem)[]; shipDate: string; accountUrl?: string | null }) {
	const items = itemsBlock(opts.lines);
	return {
		subject: `Ordine ${opts.numbers.join(', ')} confermato – Stickerprint`,
		tag: 'order-confirmation',
		html: `<p>Ciao ${opts.name || ''},</p>
<p>grazie per il tuo ordine! Abbiamo ricevuto il pagamento e stiamo già preparando la <strong>prova di stampa</strong>, che ti invieremo a breve via email.</p>
<p><strong>Ordine:</strong> ${opts.numbers.join(', ')}<br><strong>Fattura:</strong> ${opts.invoiceNumber} (in allegato)<br><strong>Totale pagato:</strong> ${opts.total}<br><strong>Pronti per la spedizione entro:</strong> ${opts.shipDate}</p>
${items}
${opts.accountUrl ? `<p>Trovi ordine e fattura anche nella tua <a href="${opts.accountUrl}">area personale</a>.</p>` : '<p>Vuoi seguire l’ordine e guadagnare credito sul prossimo? <a href="https://stickerprint.it/signup">Crea il tuo account</a> con questa stessa email: ordine e fattura saranno già lì.</p>'}
<p>A presto,<br>Il team Stickerprint</p>`
	};
}

/** Conferma d'ordine per gli ordini inseriti dalla dashboard (con PDF allegato) */
export function manualOrderEmail(opts: { name?: string | null; number: string; total: string; lines: (string | EmailItem)[]; shipDate: string; terms: string[] }) {
	return {
		subject: `Conferma d'ordine ${opts.number} – Stickerprint`,
		tag: 'order-confirmation-manual',
		html: `<p>Ciao ${opts.name || ''},</p>
<p>ti confermiamo l'ordine <strong>${opts.number}</strong>. In allegato trovi il riepilogo in PDF.</p>
${itemsBlock(opts.lines)}
<p><strong>Totale IVA inclusa:</strong> ${opts.total}<br><strong>Pronti per la spedizione entro:</strong> ${opts.shipDate}</p>
${opts.terms.length ? `<p><strong>Scadenze di pagamento</strong><br>${opts.terms.join('<br>')}</p>` : ''}
<p>Per qualsiasi modifica rispondi a questa email.</p>
<p>A presto,<br>Il team Stickerprint</p>`
	};
}

/** parola chiave sottolineata di verde (stesso segno del sito): regge anche in Gmail e Outlook */
const hl = (t: string) => `<span style="display:inline-block;border-bottom:6px solid #8be33a;line-height:1.05;padding-bottom:1px;">${esc(t)}</span>`;

/**
 * Email di stato spedizione: stesso impianto per tutti gli stati, cambia solo la parola sottolineata
 * ("concluso", "partito", "in consegna", "consegnato"...) e il testo sotto.
 */
export type ShippingMailKind = 'affidato' | 'spedito' | 'in_consegna' | 'consegnato' | 'problema' | 'punto_ritiro' | 'ritardo_corriere' | 'ritardo_nostro';
export function shippingUpdateEmail(o: { kind: ShippingMailKind; name?: string | null; number: string; trackingUrl: string; courier?: string | null; detail?: string; place?: string | null; items: (string | EmailItem)[]; accountUrl?: string | null; consegna?: 'corriere' | 'noi' | 'cliente'; newDate?: string | null; shippedAt?: string | null; reason?: string | null }) {
	const hi = `<p>Ciao ${esc(o.name || '')},</p>`;
	const list = itemsBlock(o.items);
	const courier = o.courier ? ` con ${esc(o.courier.replace('-ITA', ''))}` : '';
	const n = esc(o.number);
	const dopo = o.consegna === 'noi' ? 'lo consegniamo noi direttamente nei prossimi giorni.' : o.consegna === 'cliente' ? 'è pronto per il ritiro da parte del tuo corriere.' : 'ora è in attesa di ritiro da parte del corriere. Appena parte ti scriviamo con il link per seguirlo.';
	const T = {
		affidato: { subject: `Il tuo ordine ${o.number} è concluso 🚀`, title: `Il tuo ordine ${n} è ${hl('concluso')} 🚀`, body: `${hi}<p>l'abbiamo stampato, controllato e confezionato: ${dopo}</p>${list}`, cta: o.accountUrl ? 'Vedi il tuo ordine' : 'Vai su Stickerprint', gif: false },
		spedito: { subject: `Il tuo ordine ${o.number} è partito 🚚`, title: `Il tuo ordine ${n} è ${hl('partito')} 🚚`, body: `${hi}<p>il corriere${courier} lo ha preso in carico. Puoi seguirlo passo passo dal link qui sotto.</p>${list}`, cta: 'Segui la spedizione', gif: true },
		in_consegna: { subject: `Il tuo ordine ${o.number} è in consegna 📦`, title: `Il tuo ordine ${n} è ${hl('in consegna')} 📦`, body: `${hi}<p>arriva oggi${o.place ? ` (zona ${esc(o.place)})` : ''}. Se non ci sei, il corriere lascia un avviso o riprova domani.</p>`, cta: 'Segui la spedizione', gif: false },
		consegnato: { subject: `Il tuo ordine ${o.number} è stato consegnato ✅`, title: `Il tuo ordine ${n} è stato ${hl('consegnato')} ✅`, body: `${hi}<p>speriamo che i tuoi adesivi ti piacciano. Se qualcosa non va, rispondi a questa email e ci pensiamo noi.</p>${list}`, cta: o.accountUrl ? 'Vedi il tuo ordine' : 'Vedi la spedizione', gif: false },
		problema: { subject: `Il tuo ordine ${o.number} ha bisogno di te ⚠️`, title: `Il tuo ordine ${n} è ${hl('fermo')} ⚠️`, body: `${hi}<p>il corriere segnala un problema${o.detail ? `: <b>${esc(o.detail)}</b>` : ''}${o.place ? ` (${esc(o.place)})` : ''}. Di solito basta un contatto con il corriere o un indirizzo più preciso: controlla il tracking e, se serve, rispondi a questa email con un recapito telefonico.</p>`, cta: 'Vedi il tracking', gif: false },
		punto_ritiro: { subject: `Il tuo ordine ${o.number} è al punto di ritiro 📍`, title: `Il tuo ordine ${n} è ${hl('al punto di ritiro')} 📍`, body: `${hi}<p>il pacco è stato lasciato in un punto di ritiro${o.place ? ` (${esc(o.place)})` : ''}. Nel tracking trovi indirizzo e orari.</p>`, cta: 'Vedi dove ritirarlo', gif: false },
		// ritardo del corriere (dal tracking Qapla'): il pacco e' partito da noi in tempo, il ritardo e' sulla rete del corriere
		ritardo_corriere: { subject: `Il tuo ordine ${o.number}: il corriere è in ritardo 🕒`, title: `Il tuo ordine ${n} è ${hl('in ritardo')} 🕒`, body: `${hi}<p>il corriere${courier} ci segnala un ritardo sulla consegna del tuo pacco${o.detail ? ` (<b>${esc(o.detail)}</b>${o.place ? `, ${esc(o.place)}` : ''})` : ''}. Il pacco è partito da noi${o.shippedAt ? ` il ${esc(o.shippedAt)}` : ' nei tempi previsti'}: il ritardo dipende dalla rete del corriere, non dalla produzione. Lo stiamo seguendo e ti aggiorniamo appena si muove; dal link qui sotto vedi il tracking in tempo reale.</p><p>Se il pacco ti serve entro una data precisa, rispondi a questa email: apriamo subito una segnalazione al corriere.</p>${list}`, cta: 'Segui la spedizione', gif: false },
		// ritardo nostro: scuse chiare, un motivo credibile e la nuova data
		ritardo_nostro: { subject: `Il tuo ordine ${o.number} parte con qualche giorno di ritardo, scusaci 🙏`, title: `Il tuo ordine ${n} è ${hl('in ritardo')}, ed è colpa nostra 🙏`, body: `${hi}<p>ti dobbiamo delle scuse: il tuo ordine parte più tardi di quanto ti avevamo detto. ${o.reason ? esc(o.reason) : 'Durante il controllo qualità sulla tua tiratura abbiamo trovato un dettaglio di stampa che non ci convinceva, e abbiamo preferito rifarla piuttosto che spedirti qualcosa di imperfetto.'}</p>${o.newDate ? `<p style="padding:12px 14px;background:#fef6db;border-radius:10px;"><b>Nuova data di spedizione: ${esc(o.newDate)}.</b> Appena parte ricevi l'email con il tracking.</p>` : `<p>Appena parte ricevi l'email con il tracking.</p>`}<p>Il ritardo è tutto nostro e ci dispiace davvero. Se ti crea un problema di date, rispondi a questa email: troviamo insieme la soluzione.</p>${list}`, cta: o.accountUrl ? 'Vedi il tuo ordine' : 'Vai su Stickerprint', gif: false }
	}[o.kind];
	const href = (o.kind === 'consegnato' || o.kind === 'affidato' || o.kind === 'ritardo_nostro') && o.accountUrl ? o.accountUrl : o.trackingUrl;
	const gif = T.gif ? `<p style="margin:18px 0 0;"><img src="${SITE}/images/email/partito.gif" width="496" height="200" alt="" style="width:100%;max-width:496px;height:auto;display:block;border-radius:12px;"></p>` : '';
	return { subject: T.subject, tag: `shipping-${o.kind}`, html: layoutHtml(T.title, T.body + gif, { label: T.cta, href }) };
}

/** richiesta di recensione, 24 ore dopo la consegna (registrati e ospiti) */
export function reviewRequestEmail(o: { name?: string | null; number: string; items: (string | EmailItem)[]; href: string }) {
	const n = esc(o.number);
	/* una recensione per ordine: gli articoli sono elencati, il bottone giallo e' uno solo */
	const list = itemsBlock(o.items.map((i) => (typeof i === 'string' ? { name: i } : { ...i, cta: undefined })));
	const html = layoutHtml(`Il tuo ordine ${n} è ${hl('arrivato')} ⭐`, `<p>Ciao ${esc(o.name || '')},</p><p>ieri il corriere ti ha consegnato i tuoi adesivi. Ci racconti com'è andata? Bastano due righe e una stella da 1 a 5${o.items.length > 1 ? ', una sola recensione per tutto l\'ordine' : ''}.</p><p>Una recensione sincera serve a noi per crescere e a chi deve ancora ordinare per sentirsi tranquillo prima di scegliere. Per ringraziarti, <b>appena la invii ricevi un codice sconto del 10% sul prossimo ordine</b> (valido 6 mesi, ordini da 50 €), qualunque voto tu dia.</p>${list}`, { label: '⭐ Scrivi recensione', href: o.href })
		.replace('background:#0e8bff;color:#fff;', 'background:#f4b400;color:#0b0b3b;');
	return { subject: `Com'è andata con l'ordine ${o.number}? ⭐ (c'è un 10% per te)`, tag: 'review-request', html };
}

/** stesso layout delle altre email, ma il titolo puo' contenere HTML (la parola sottolineata) */
function layoutHtml(titleHtml: string, body: string, cta?: { label: string; href: string } | null): string {
	const plain = titleHtml.replace(/<[^>]+>/g, '');
	return layout('§TITLE§', body, cta ?? undefined).replace('<h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:28px;line-height:1.2;letter-spacing:-0.02em;color:#0b0b3b;">§TITLE§</h1>', `<h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:28px;line-height:1.3;letter-spacing:-0.02em;color:#0b0b3b;">${titleHtml}</h1>`).replace('<title>§TITLE§</title>', `<title>${esc(plain)}</title>`);
}

/** sollecito di approvazione dell'anteprima (o del file mancante), con la data entro cui rispondere per mantenere la spedizione */
export function proofReminderEmail(o: { name?: string | null; number: string; missingFile: boolean; approveBy: Date | null; shipBy: string | null; href: string }) {
	const n = esc(o.number);
	const it = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	const day = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' });
	const shipTxt = o.shipBy ? day.format(new Date(o.shipBy + 'T12:00:00')) : null;
	const byTxt = o.approveBy ? it.format(o.approveBy) : null;
	const what = o.missingFile ? 'il file di stampa' : "l'anteprima";
	const body = o.missingFile
		? `<p>Ciao ${esc(o.name || '')},</p><p>per l'ordine <b>${n}</b> ci manca ancora il file da stampare. Caricalo dalla tua area personale: appena arriva, la commessa entra in produzione.</p>`
		: `<p>Ciao ${esc(o.name || '')},</p><p>l'anteprima dell'ordine <b>${n}</b> aspetta il tuo ok. Basta un clic dalla tua area personale: senza approvazione non possiamo mandare in stampa.</p>`;
	const when = byTxt && shipTxt
		? `<p style="margin-top:14px;padding:12px 14px;background:#fef6db;border-radius:10px;"><b>Per mantenere la spedizione di ${esc(shipTxt)}</b> ci serve ${what} entro <b>${esc(byTxt)}</b>. Dopo, la data di spedizione si sposta al primo giorno utile e te la comunichiamo noi.</p>`
		: '';
	return { subject: `Ordine ${o.number}: ${o.missingFile ? 'manca il file di stampa' : "l'anteprima aspetta il tuo ok"} ⏳`, tag: 'proof-reminder', html: layoutHtml(`Il tuo ordine ${n} è ${hl('in attesa')} ⏳`, body + when, { label: o.missingFile ? 'Carica il file' : "Approva l'anteprima", href: o.href }) };
}

/* ---------- Aziende: preventivi ---------- */
/** email di invio scritta dallo staff: solo testo e un bottone, niente allegato (il preventivo si apre sul sito) */
export function quoteEmail(o: { subject: string; message: string; senderName: string | null; number: string; validUntil: string | null; href: string }) {
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${o.senderName ? `<p style="margin:18px 0 0;color:#8e92b0;font-size:13px;">${esc(o.senderName)} · Stickerprint · ti seguo io: rispondi pure a questa email.</p>` : ''}`;
	return { subject: o.subject, tag: 'quote', html: layoutHtml(`Preventivo ${esc(o.number)} ${hl('pronto')} 📄`, body + (o.validUntil ? `<p style="margin:14px 0 0;font-size:13px;color:#8e92b0;">Valido fino al ${esc(o.validUntil)}.</p>` : ''), { label: 'Apri il preventivo', href: o.href }) };
}
export function quoteReminderEmail(o: { name?: string | null; number: string; validUntil: string | null; href: string; senderName?: string | null }) {
	const n = esc(o.number);
	return { subject: `Preventivo ${o.number}: ti serve altro?`, tag: 'quote-reminder', html: layoutHtml(`Il preventivo ${n} è ${hl('in attesa')} ⏳`, `<p>Ciao ${esc(o.name || '')},</p><p>qualche giorno fa ti ho mandato il preventivo <b>${n}</b>${o.validUntil ? `, valido fino al <b>${esc(o.validUntil)}</b>` : ''}. Se hai dubbi su materiali, quantità o tempi, scrivimi dalla pagina del preventivo o rispondi a questa email: ci penso io.</p>${o.senderName ? `<p style="color:#8e92b0;font-size:13px;">${esc(o.senderName)} · Stickerprint</p>` : ''}`, { label: 'Rivedi il preventivo', href: o.href }) };
}
export function quoteReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }) {
	const n = esc(o.number);
	return { subject: `Re: preventivo ${o.number}`, tag: 'quote-reply', html: layoutHtml(`Novità sul preventivo ${n} 💬`, `<p>Ciao ${esc(o.name || '')},</p><div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(o.body)}</div>${o.author ? `<p style="margin-top:10px;color:#8e92b0;font-size:13px;">${esc(o.author)} · Stickerprint</p>` : ''}`, { label: 'Apri il preventivo', href: o.href }) };
}
export function quoteAcceptedEmail(o: { name?: string | null; number: string; orderNumber: string | null }) {
	const n = esc(o.number);
	return { subject: `Preventivo ${o.number} confermato ✅`, tag: 'quote-accepted', html: layoutHtml(`Preventivo ${n} ${hl('confermato')} ✅`, `<p>Ciao ${esc(o.name || '')},</p><p>grazie, abbiamo registrato la tua conferma.${o.orderNumber ? ` L'ordine <b>${esc(o.orderNumber)}</b> è in lavorazione: ricevi la conferma d'ordine con il riepilogo a parte.` : ' Prossimo passo: ti mandiamo la conferma d\'ordine con i dettagli, e si parte.'}</p>`) };
}

/* ---------- Helpdesk ---------- */
export function ticketReceivedEmail(o: { name?: string | null; number: string; href: string }) {
	const n = esc(o.number);
	return { subject: `Richiesta ${o.number} ricevuta: ci pensiamo noi`, tag: 'ticket-received', html: layoutHtml(`Richiesta ${n} ${hl('ricevuta')} 🙌`, `<p>Ciao ${esc(o.name || '')},</p><p>la tua richiesta è arrivata in laboratorio con il numero <b>${n}</b>. Di solito rispondiamo entro un giorno lavorativo. Puoi seguire la conversazione e aggiungere dettagli dal link qui sotto.</p>`, { label: 'Vedi la richiesta', href: o.href }) };
}
export function ticketReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }) {
	const n = esc(o.number);
	return { subject: `Re: richiesta ${o.number}`, tag: 'ticket-reply', html: layoutHtml(`Novità sulla richiesta ${n} 💬`, `<p>Ciao ${esc(o.name || '')},</p><div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(o.body)}</div>${o.author ? `<p style="margin-top:10px;color:#8e92b0;font-size:13px;">${esc(o.author)} · Stickerprint</p>` : ''}<p>Per rispondere usa il bottone: la conversazione resta tutta in un posto.</p>`, { label: 'Rispondi', href: o.href }) };
}

/* ---------- Conferma d'ordine (pagina del cliente) ---------- */
/** email scritta dallo staff: testo e un bottone "Apri la conferma d'ordine"; il PDF si scarica dalla pagina */
export function orderConfirmEmail(o: { subject: string; message: string; senderName: string | null; number: string; href: string; toPay: string | null }) {
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${o.toPay ? `<p style="margin:16px 0 0;padding:12px 14px;background:#fef6db;border-radius:10px;"><b>Da pagare adesso: ${esc(o.toPay)}</b>. Trovi le istruzioni e i bottoni di pagamento nella pagina della conferma.</p>` : ''}${o.senderName ? `<p style="margin:18px 0 0;color:#8e92b0;font-size:13px;">${esc(o.senderName)} · Stickerprint · ti seguo io: rispondi pure a questa email.</p>` : ''}`;
	return { subject: o.subject, tag: 'order-confirm', html: layoutHtml(`Conferma d'ordine ${esc(o.number)} ${hl('pronta')} 📦`, body, { label: "Apri la conferma d'ordine", href: o.href }) };
}
export function orderReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }) {
	const n = esc(o.number);
	return { subject: `Re: ordine ${o.number}`, tag: 'order-reply', html: layoutHtml(`Novità sull'ordine ${n} 💬`, `<p>Ciao ${esc(o.name || '')},</p><div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(o.body)}</div>${o.author ? `<p style="margin-top:10px;color:#8e92b0;font-size:13px;">${esc(o.author)} · Stickerprint</p>` : ''}`, { label: "Apri la conferma d'ordine", href: o.href }) };
}
export function orderPaymentReminderEmail(o: { name?: string | null; number: string; amount: string; href: string; senderName?: string | null }) {
	const n = esc(o.number);
	return { subject: `Ordine ${o.number}: manca il pagamento per partire`, tag: 'order-payment-reminder', html: layoutHtml(`L'ordine ${n} aspetta il ${hl('pagamento')} ⏳`, `<p>Ciao ${esc(o.name || '')},</p><p>la tua conferma d'ordine <b>${n}</b> è pronta, ma per mandarla in produzione ci manca il pagamento di <b>${esc(o.amount)}</b>. Trovi tutto nella pagina della conferma: appena arriva, partiamo.</p>${o.senderName ? `<p style="color:#8e92b0;font-size:13px;">${esc(o.senderName)} · Stickerprint</p>` : ''}`, { label: 'Vai al pagamento', href: o.href }) };
}

/* ---------- Fattura (pagina del cliente) ---------- */
export function invoiceEmail(o: { subject: string; message: string; senderName: string | null; number: string; href: string; toPay: string | null }) {
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${o.toPay ? `<p style="margin:16px 0 0;padding:12px 14px;background:#fef6db;border-radius:10px;"><b>Da pagare: ${esc(o.toPay)}</b>. Nella pagina della fattura puoi pagare subito con carta o vedere i dati per il bonifico.</p>` : ''}${o.senderName ? `<p style="margin:18px 0 0;color:#8e92b0;font-size:13px;">${esc(o.senderName)} · Stickerprint · per qualsiasi cosa rispondi pure a questa email.</p>` : ''}`;
	return { subject: o.subject, tag: 'invoice', html: layoutHtml(`La tua fattura ${esc(o.number)} è ${hl('pronta')} 🧾`, body, { label: 'Apri la fattura', href: o.href }) };
}
export function invoiceReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }) {
	const n = esc(o.number);
	return { subject: `Re: fattura ${o.number}`, tag: 'invoice-reply', html: layoutHtml(`Novità sulla fattura ${n} 💬`, `<p>Ciao ${esc(o.name || '')},</p><div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(o.body)}</div>${o.author ? `<p style="margin-top:10px;color:#8e92b0;font-size:13px;">${esc(o.author)} · Stickerprint</p>` : ''}`, { label: 'Apri la fattura', href: o.href }) };
}

/** grazie per la recensione: codice sconto personale */
export function reviewThanksEmail(o: { name?: string | null; number: string; code: string; validUntil: string; href: string }) {
	return { subject: `Grazie per la recensione: ecco il tuo 10% 🎁`, tag: 'review-thanks', html: layoutHtml(`Grazie ${esc(o.name || '')}, ecco il tuo ${hl('10%')} 🎁`, `<p>La tua recensione sull'ordine <b>${esc(o.number)}</b> è arrivata: la leggiamo e la pubblichiamo a breve. Aiuta davvero, noi e chi deve ancora scegliere.</p><p style="margin:18px 0;padding:16px;background:#fef6db;border-radius:12px;text-align:center;"><span style="font-size:13px;color:#8a5a00;">IL TUO CODICE</span><br><b style="font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-size:28px;letter-spacing:.06em;">${esc(o.code)}</b><br><span style="font-size:13px;color:#8a5a00;">10% sul prossimo ordine · valido fino al ${esc(o.validUntil)} · ordini da 50 €</span></p><p>Lo inserisci nel carrello, nel campo "Codice sconto". È personale: vale una volta sola e con la tua email.</p>`, { label: 'Usa il codice', href: o.href }) };
}
