import { env } from '$env/dynamic/private';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { LOCALES, localizePath, type Lang } from '$lib/i18n';
import { t as tradotto, perLingua, numeroIn, dataIn, type Params } from '$lib/traduzioni';

/**
 * Template email transazionali. Tutti condividono lo stesso layout brand.
 * Ogni funzione restituisce { subject, html, tag }.
 * Le email al cliente hanno un ultimo parametro `lang` (default 'it'): i testi vengono dal catalogo
 * src/lib/traduzioni/email.ts (chiavi "email.<template>.<voce>"). Quelle per lo staff (contactRequestEmail,
 * ownerNotifyEmail) restano in italiano.
 */

const SITE = PUBLIC_SITE_URL || 'https://stickerprint.it';

function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/* ---------- lingua: t() relativo all'area "email", locale, link interni nella lingua ---------- */
type T = (chiave: string, params?: Params) => string;
const tt = (lang: Lang): T => (chiave, params) => tradotto(perLingua(lang), `email.${chiave}`, params);
const loc = (lang: Lang) => LOCALES[perLingua(lang)];
/** link interno al sito nella lingua del cliente (/de/individuelle-aufkleber) */
const link = (lang: Lang, p: string) => `${SITE}${localizePath(p, perLingua(lang))}`;
/** "Ciao Mario," in apertura */
const hi = (T: T, name?: string | null) => `<p>${T('comune.ciao', { nome: esc(name || '') })}</p>`;
/** firma dello staff in grigio sotto il testo */
const firma = (T: T, name: string | null | undefined, chiave: string, stile = '') => (name ? `<p style="${stile}color:#8e92b0;font-size:13px;">${T(chiave, { nome: esc(name) })}</p>` : '');
/** paragrafo "intanto guarda le domande frequenti" con il link alla pagina di supporto */
const faq = (T: T, lang: Lang) => T('comune.faq', { link: `<a href="${link(lang, '/support')}" style="color:#1d6bf3;font-weight:700;">${T('comune.faqLink')}</a>` });
/** parola chiave sottolineata di verde (stesso segno del sito): regge anche in Gmail e Outlook */
const hl = (t: string) => `<span style="display:inline-block;border-bottom:6px solid #8be33a;line-height:1.05;padding-bottom:1px;">${esc(t)}</span>`;
const BOX = 'margin:16px 0 0;padding:12px 14px;background:#f4f5fa;border-radius:10px;';
const BOX_GIALLO = 'margin:16px 0 0;padding:12px 14px;background:#fef6db;border-radius:10px;';

/** riga prodotto nelle email: mockup generato dal sito, nome, quantita' e (opzionale) bottone a destra */
export interface EmailItem { name: string; qty?: number | null; preview?: string | null; meta?: string | null; cta?: { label: string; href: string } | null }
export function itemsBlock(items: (string | EmailItem)[], lang: Lang = 'it'): string {
	if (!items.length) return '';
	const T = tt(lang);
	const rows = items.map((raw) => {
		const i: EmailItem = typeof raw === 'string' ? { name: raw } : raw;
		const img = i.preview ? `<img src="${i.preview}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;object-fit:contain;border-radius:12px;background:#f4f5fa;">` : `<div style="width:96px;height:96px;border-radius:12px;background:#f4f5fa;"></div>`;
		const qty = i.qty ? `<span style="color:#8e92b0;">${numeroIn(loc(lang), Number(i.qty))} ${T('layout.pz')}</span>` : '';
		const cta = i.cta ? `<td align="right" valign="middle" style="padding-left:12px;white-space:nowrap;"><a href="${i.cta.href}" style="display:inline-block;background:#f4b400;color:#0b0b3b;text-decoration:none;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.02em;padding:11px 16px;border-radius:8px;">${esc(i.cta.label)}</a></td>` : '';
		return `<tr><td style="padding:10px 0;border-top:1px solid #eceef5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="96" valign="middle">${img}</td><td valign="middle" style="padding-left:14px;font-size:15px;line-height:1.4;color:#0b0b3b;"><b>${esc(i.name)}</b>${i.meta ? `<br><span style="color:#8e92b0;font-size:13px;">${esc(i.meta)}</span>` : ''}${qty ? `<br>${qty}` : ''}</td>${cta}</tr></table></td></tr>`;
	}).join('');
	return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;border-bottom:1px solid #eceef5;">${rows}</table>`;
}

/** l'emoji finale resta attaccata all'ultima parola: se il titolo va a capo, non va a capo da sola */
const keepEmoji = (t: string) => t.replace(/((?:<span[^>]*>[^<]*<\/span>|\S+)) (\p{Extended_Pictographic}️?)\s*$/u, '<span style="white-space:nowrap;">$1&nbsp;$2</span>');
function layout(title: string, body: string, cta?: { label: string; href: string }, lang: Lang = 'it'): string {
	const T = tt(lang);
	return `<!doctype html>
<html lang="${loc(lang).hreflang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&family=Montserrat:wght@400;600;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#f4f5fa;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#0b0b3b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5fa;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;overflow:hidden;">
  <tr><td style="background:#050538;padding:26px 32px;text-align:center;">
    <img src="${SITE}/images/splogo-400.png" width="120" alt="Stickerprint" style="display:inline-block;transform:rotate(-5deg);">
  </td></tr>
  <tr><td style="padding:34px 32px 10px;">
    <h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:25px;line-height:1.2;letter-spacing:-0.02em;color:#0b0b3b;">${keepEmoji(esc(title))}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3d3f63;">${body}</div>
    ${cta ? `<p style="margin:28px 0 8px;text-align:center;"><a href="${cta.href}" style="display:inline-block;background:#0e8bff;color:#fff;text-decoration:none;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;text-transform:uppercase;font-size:14px;letter-spacing:.02em;padding:14px 28px;border-radius:8px;">${esc(cta.label)}</a></p>` : ''}
  </td></tr>
  <tr><td style="padding:18px 32px 30px;font-size:12px;color:#8e92b0;line-height:1.5;">
    ${esc(T('layout.azienda'))}<br>
    ${T('layout.aiuto', { link: '<a href="mailto:info@stickerprint.it" style="color:#0e8bff;">info@stickerprint.it</a>' })}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** stesso layout delle altre email, ma il titolo puo' contenere HTML (la parola sottolineata) */
function layoutHtml(titleHtml: string, body: string, cta?: { label: string; href: string } | null, lang: Lang = 'it'): string {
	const plain = titleHtml.replace(/<[^>]+>/g, '');
	return layout('§TITLE§', body, cta ?? undefined, lang).replace('<h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:25px;line-height:1.2;letter-spacing:-0.02em;color:#0b0b3b;">§TITLE§</h1>', `<h1 style="margin:0 0 14px;font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-weight:800;font-size:25px;line-height:1.3;letter-spacing:-0.02em;color:#0b0b3b;">${keepEmoji(titleHtml)}</h1>`).replace('<title>§TITLE§</title>', `<title>${esc(plain)}</title>`);
}

export function welcomeEmail(opts: { name?: string | null; email: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const name = opts.name?.trim() || T('benvenuto.nomeDefault');
	return {
		subject: T('benvenuto.oggetto'),
		tag: 'welcome',
		html: layout(T('benvenuto.titolo', { nome: name }), T('benvenuto.corpo'), { label: T('benvenuto.cta'), href: link(lang, '/adesivi-personalizzati') }, lang)
	};
}

export function passwordChangedEmail(opts: { email: string }, lang: Lang = 'it') {
	const T = tt(lang);
	return {
		subject: T('password.oggetto'),
		tag: 'security',
		html: layout(T('password.titolo'), T('password.corpo', { email: esc(opts.email) }), { label: T('password.cta'), href: link(lang, '/reset-password') }, lang)
	};
}

/** notifica allo staff di una richiesta dal sito: resta in italiano */
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

export function contactAutoReplyEmail(opts: { name: string }, lang: Lang = 'it') {
	const T = tt(lang);
	return {
		subject: T('contatto.oggetto'),
		tag: 'auto-reply',
		html: layout(T('contatto.titolo', { nome: opts.name }), T('contatto.corpo') + faq(T, lang), undefined, lang)
	};
}

/** Notifica generica interna (titolare/produzione): resta in italiano */
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

export function orderConfirmationEmail(opts: { name?: string | null; numbers: string[]; invoiceNumber: string; total: string; lines: (string | EmailItem)[]; shipDate: string; accountUrl?: string | null }, lang: Lang = 'it') {
	/* stesso stile delle email di spedizione: titolo Rubik con la parola sottolineata, anteprime dei prodotti, bottone centrato */
	const T = tt(lang);
	const n = esc(opts.numbers.join(', '));
	const body = `${hi(T, opts.name)}
${T('ordine.corpo')}
${itemsBlock(opts.lines, lang)}
<p style="${BOX}"><b>${T('ordine.totalePagato')}</b> ${esc(opts.total)}<br><b>${T('comune.spedizioneStimata')}</b> ${esc(opts.shipDate)}</p>
${opts.accountUrl ? T('ordine.segui') : T('ordine.creaAccount', { link: `<a href="${link(lang, '/signup')}" style="color:#0e8bff;">${T('ordine.creaAccountLink')}</a>` })}
${T('ordine.fattura', { n: esc(opts.invoiceNumber) })}`;
	return {
		subject: T('ordine.oggetto', { n: opts.numbers.join(', ') }),
		tag: 'order-confirmation',
		html: layoutHtml(T('ordine.titolo', { n, parola: hl(T('ordine.parola')) }), body, { label: opts.accountUrl ? T('comune.vediOrdine') : T('ordine.creaAccountLink'), href: opts.accountUrl ?? link(lang, '/signup') }, lang)
	};
}

/** Conferma d'ordine per gli ordini inseriti dalla dashboard (con PDF allegato) */
export function manualOrderEmail(opts: { name?: string | null; number: string; total: string; lines: (string | EmailItem)[]; shipDate: string; terms: string[] }, lang: Lang = 'it') {
	/* stesso template della conferma automatica: cambia solo il riquadro (totale, spedizione, scadenze) e l'allegato (conferma d'ordine in PDF) */
	const T = tt(lang);
	const n = esc(opts.number);
	const body = `${hi(T, opts.name)}
${T('ordineManuale.corpo')}
${itemsBlock(opts.lines, lang)}
<p style="${BOX}"><b>${T('comune.totaleIva')}</b> ${esc(opts.total)}<br><b>${T('comune.spedizioneStimata')}</b> ${esc(opts.shipDate)}${opts.terms.length ? `<br><b>${T('ordineManuale.scadenze')}</b><br>${opts.terms.map(esc).join('<br>')}` : ''}</p>
${T('ordineManuale.modifiche')}
${T('ordineManuale.pdf', { n })}`;
	return { subject: T('ordine.oggetto', { n: opts.number }), tag: 'order-confirmation-manual', html: layoutHtml(T('ordine.titolo', { n, parola: hl(T('ordine.parola')) }), body, { label: T('comune.vaiSito'), href: link(lang, '/') }, lang) };
}

/**
 * Email di stato spedizione: stesso impianto per tutti gli stati, cambia solo la parola sottolineata
 * ("concluso", "partito", "in consegna", "consegnato"...) e il testo sotto.
 */
export type ShippingMailKind = 'affidato' | 'spedito' | 'in_consegna' | 'consegnato' | 'problema' | 'punto_ritiro' | 'ritardo_corriere' | 'ritardo_nostro';
const SHIPPING_KEY: Record<ShippingMailKind, string> = { affidato: 'affidato', spedito: 'spedito', in_consegna: 'inConsegna', consegnato: 'consegnato', problema: 'problema', punto_ritiro: 'puntoRitiro', ritardo_corriere: 'ritardoCorriere', ritardo_nostro: 'ritardoNostro' };
export function shippingUpdateEmail(o: { kind: ShippingMailKind; name?: string | null; number: string; trackingUrl: string; courier?: string | null; detail?: string; place?: string | null; items: (string | EmailItem)[]; accountUrl?: string | null; consegna?: 'corriere' | 'noi' | 'cliente'; newDate?: string | null; shippedAt?: string | null; reason?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const k = `spedizione.${SHIPPING_KEY[o.kind]}`;
	const list = itemsBlock(o.items, lang);
	const n = esc(o.number);
	const dopo = o.consegna === 'noi' ? T('spedizione.dopoNoi') : o.consegna === 'cliente' ? T('spedizione.dopoCliente') : T('spedizione.dopoCorriere');
	const luogo = o.place ? ` (${esc(o.place)})` : '';
	// "problema": ": <b>dettaglio</b> (luogo)"; "ritardo del corriere": " (<b>dettaglio</b>, luogo)"
	const dettaglio = o.kind === 'ritardo_corriere'
		? (o.detail ? ` (<b>${esc(o.detail)}</b>${o.place ? `, ${esc(o.place)}` : ''})` : '')
		: `${o.detail ? `: <b>${esc(o.detail)}</b>` : ''}${luogo}`;
	const quando = o.shippedAt ? T('spedizione.ritardoCorriere.partitoIl', { data: esc(o.shippedAt) }) : T('spedizione.ritardoCorriere.neiTempi');
	const motivo = o.reason ? esc(o.reason) : T('spedizione.ritardoNostro.motivoDefault');
	let body = hi(T, o.name) + T(`${k}.corpo`, { n, dopo, dettaglio, luogo, quando, motivo });
	if (o.kind === 'ritardo_nostro') body += (o.newDate ? `<p style="padding:12px 14px;background:#fef6db;border-radius:10px;">${T(`${k}.nuovaData`, { data: esc(o.newDate) })}</p>` : T(`${k}.appenaParte`)) + T(`${k}.scuse`);
	if (['affidato', 'spedito', 'consegnato', 'ritardo_corriere', 'ritardo_nostro'].includes(o.kind)) body += list;
	const cta = {
		affidato: o.accountUrl ? T('comune.vediOrdine') : T('comune.vaiSito'),
		spedito: T('comune.seguiSpedizione'),
		in_consegna: T('comune.seguiSpedizione'),
		consegnato: o.accountUrl ? T('comune.vediOrdine') : T(`${k}.cta`),
		problema: T(`${k}.cta`),
		punto_ritiro: T(`${k}.cta`),
		ritardo_corriere: T('comune.seguiSpedizione'),
		ritardo_nostro: o.accountUrl ? T('comune.vediOrdine') : T('comune.vaiSito')
	}[o.kind];
	const href = (o.kind === 'consegnato' || o.kind === 'affidato' || o.kind === 'ritardo_nostro') && o.accountUrl ? o.accountUrl : o.trackingUrl;
	const gif = o.kind === 'spedito' ? `<p style="margin:18px 0 0;"><img src="${SITE}/images/email/partito.gif" width="496" height="200" alt="" style="width:100%;max-width:496px;height:auto;display:block;border-radius:12px;"></p>` : '';
	return { subject: T(`${k}.oggetto`, { n: o.number }), tag: `shipping-${o.kind}`, html: layoutHtml(T(`${k}.titolo`, { n, parola: hl(T(`${k}.parola`)) }), body + gif, { label: cta, href }, lang) };
}

/** richiesta di recensione, poche ore dopo la consegna (registrati e ospiti) */
export function reviewRequestEmail(o: { name?: string | null; number: string; items: (string | EmailItem)[]; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	/* una recensione per ordine: gli articoli sono elencati, il bottone giallo e' uno solo */
	const list = itemsBlock(o.items.map((i) => (typeof i === 'string' ? { name: i } : { ...i, cta: undefined })), lang);
	const html = layoutHtml(T('recensione.titolo', { n, parola: hl(T('recensione.parola')) }), hi(T, o.name) + T('recensione.corpo') + list, { label: T('recensione.cta'), href: o.href }, lang)
		.replace('background:#0e8bff;color:#fff;', 'background:#f4b400;color:#0b0b3b;');
	return { subject: T('recensione.oggetto', { n: o.number }), tag: 'review-request', html };
}

/** sollecito di approvazione dell'anteprima (o del file mancante), con la data entro cui rispondere per mantenere la spedizione */
export function proofReminderEmail(o: { name?: string | null; number: string; missingFile: boolean; approveBy: Date | null; shipBy: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const L = loc(lang);
	const n = esc(o.number);
	const shipTxt = o.shipBy ? dataIn(L, o.shipBy + 'T12:00:00', true) : null;
	const byTxt = o.approveBy ? new Intl.DateTimeFormat(L.intl, { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(o.approveBy) : null;
	const what = o.missingFile ? T('sollecitoAnteprima.cosaFile') : T('sollecitoAnteprima.cosaAnteprima');
	const body = hi(T, o.name) + (o.missingFile ? T('sollecitoAnteprima.corpoFile', { n }) : T('sollecitoAnteprima.corpoAnteprima', { n }));
	const when = byTxt && shipTxt
		? `<p style="margin-top:14px;padding:12px 14px;background:#fef6db;border-radius:10px;">${T('sollecitoAnteprima.entro', { spedizione: esc(shipTxt), cosa: what, entro: esc(byTxt) })}</p>`
		: '';
	return { subject: o.missingFile ? T('sollecitoAnteprima.oggettoFile', { n: o.number }) : T('sollecitoAnteprima.oggettoAnteprima', { n: o.number }), tag: 'proof-reminder', html: layoutHtml(T('sollecitoAnteprima.titolo', { n, parola: hl(T('sollecitoAnteprima.parola')) }), body + when, { label: o.missingFile ? T('sollecitoAnteprima.ctaFile') : T('sollecitoAnteprima.ctaAnteprima'), href: o.href }, lang) };
}

/* ---------- Aziende: preventivi ---------- */
/** email di invio scritta dallo staff: solo testo e un bottone, niente allegato (il preventivo si apre sul sito) */
export function quoteEmail(o: { subject: string; message: string; senderName: string | null; number: string; validUntil: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${firma(T, o.senderName, 'comune.firmaSeguo', 'margin:18px 0 0;')}`;
	return { subject: o.subject, tag: 'quote', html: layoutHtml(T('preventivo.titolo', { n: esc(o.number), parola: hl(T('preventivo.parola')) }), body + (o.validUntil ? `<p style="margin:14px 0 0;font-size:13px;color:#8e92b0;">${T('preventivo.validoFino', { data: esc(o.validUntil) })}</p>` : ''), { label: T('comune.apriPreventivo'), href: o.href }, lang) };
}
export function quoteReminderEmail(o: { name?: string | null; number: string; validUntil: string | null; href: string; senderName?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + T('preventivoSollecito.corpo', { n, validita: o.validUntil ? T('preventivoSollecito.validita', { data: esc(o.validUntil) }) : '' }) + firma(T, o.senderName, 'comune.firma');
	return { subject: T('preventivoSollecito.oggetto', { n: o.number }), tag: 'quote-reminder', html: layoutHtml(T('preventivoSollecito.titolo', { n, parola: hl(T('preventivoSollecito.parola')) }), body, { label: T('preventivoSollecito.cta'), href: o.href }, lang) };
}
/** risposta dello staff nel riquadro grigio, con la firma sotto */
const replyBody = (T: T, name: string | null | undefined, text: string, author?: string | null) => `${hi(T, name)}<div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(text)}</div>${firma(T, author, 'comune.firma', 'margin-top:10px;')}`;
export function quoteReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	return { subject: T('preventivoRisposta.oggetto', { n: o.number }), tag: 'quote-reply', html: layoutHtml(T('preventivoRisposta.titolo', { n }), replyBody(T, o.name, o.body, o.author), { label: T('comune.apriPreventivo'), href: o.href }, lang) };
}
export function quoteAcceptedEmail(o: { name?: string | null; number: string; orderNumber: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + (o.orderNumber ? T('preventivoConfermato.corpoOrdine', { ordine: esc(o.orderNumber) }) : T('preventivoConfermato.corpoSenzaOrdine'));
	return { subject: T('preventivoConfermato.oggetto', { n: o.number }), tag: 'quote-accepted', html: layoutHtml(T('preventivoConfermato.titolo', { n, parola: hl(T('preventivoConfermato.parola')) }), body, null, lang) };
}

/* ---------- Helpdesk ---------- */
export function aziendeReceivedEmail(o: { name?: string | null; company?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const body = hi(T, o.name) + T('aziende.corpo', { azienda: o.company ? T('aziende.perAzienda', { azienda: esc(o.company) }) : '' }) + T('comune.grazieContatto');
	return { subject: T('aziende.oggetto'), tag: 'aziende-received', html: layoutHtml(T('aziende.titolo', { parola: hl(T('aziende.parola')) }), body, { label: T('aziende.cta'), href: link(lang, '/aziende') }, lang) };
}
export function ticketReceivedEmail(o: { name?: string | null; number: string; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + T('ticket.corpo', { n }) + faq(T, lang) + T('comune.grazieContatto');
	return { subject: T('ticket.oggetto', { n: o.number }), tag: 'ticket-received', html: layoutHtml(T('ticket.titolo', { n, parola: hl(T('ticket.parola')) }), body, { label: T('ticket.cta'), href: o.href }, lang) };
}
export function ticketReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string; attachments?: { name: string; href: string }[] }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const lista = (o.attachments ?? []).map((a) => `<a href="${a.href}" style="color:#1d6bf3;font-weight:700;">${esc(a.name)}</a>`).join(', ');
	const att = o.attachments?.length ? `<p style="margin-top:12px;">${T(o.attachments.length === 1 ? 'ticketRisposta.allegatoUno' : 'ticketRisposta.allegatiTanti', { lista })}</p>` : '';
	const body = `${hi(T, o.name)}<div style="white-space:pre-wrap;background:#f4f5fa;padding:14px 16px;border-radius:10px;">${esc(o.body)}</div>${att}${firma(T, o.author, 'comune.firma', 'margin-top:10px;')}${T('ticketRisposta.rispondi')}`;
	return { subject: T('ticketRisposta.oggetto', { n: o.number }), tag: 'ticket-reply', html: layoutHtml(T('ticketRisposta.titolo', { n }), body, { label: T('ticketRisposta.cta'), href: o.href }, lang) };
}

/* ---------- Ordine nato da un preventivo confermato dal cliente (email automatica) ---------- */
export interface OrderPayLine { label: string; amount: string; due: string | null; upfront: boolean; paid: boolean }
/**
 * Due varianti: senza anticipo l'ordine e' gia' in lavorazione; con anticipo da pagare l'ordine aspetta
 * il primo pagamento e il bottone porta a pagarlo (carta, PayPal o bonifico dalla pagina).
 */
export function quoteOrderEmail(o: { name?: string | null; quoteNumber: string; number: string; items: (string | EmailItem)[]; total: string; shipDate: string | null; leadTime: string | null; payments: OrderPayLine[]; dueNow: string | null; senderName?: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const items = itemsBlock(o.items, lang);
	const dueLines = o.payments.filter((p) => p.upfront && !p.paid);
	const laterLines = o.payments.filter((p) => !p.upfront && !p.paid);
	const riga = (p: OrderPayLine) => `${p.amount} · ${p.label}${p.upfront ? ` · ${T('ordinePreventivo.anticipato')}` : p.due ? ` · ${T('ordinePreventivo.scadenza', { data: p.due })}` : ''}${p.paid ? ` · ${T('ordinePreventivo.pagato')}` : ''}`;
	const box = `<p style="${BOX}"><b>${T('comune.totaleIva')}</b> ${esc(o.total)}${o.shipDate ? `<br><b>${T('comune.spedizioneStimata')}</b> ${esc(o.shipDate)}` : ''}${o.leadTime ? `<br><b>${T('ordinePreventivo.tempi')}</b> ${esc(o.leadTime)}` : ''}${o.payments.length ? `<br><b>${T('ordinePreventivo.pagamento')}</b><br>${o.payments.map((p) => esc(riga(p))).join('<br>')}` : ''}</p>`;
	const sign = firma(T, o.senderName, 'comune.firmaSeguo', 'margin:18px 0 0;');
	if (o.dueNow && dueLines.length) {
		const poi = laterLines.length ? `<br><span style="color:#8a5a00;">${T('ordinePreventivo.poi', { lista: laterLines.map((p) => esc(`${p.amount} · ${p.label}${p.due ? ` · ${p.due}` : ''}`)).join(' · ') })}</span>` : '';
		const body = `${hi(T, o.name)}
${T('ordinePreventivo.corpoAcconto', { preventivo: esc(o.quoteNumber), n })}
<p style="margin:16px 0 0;padding:14px 16px;background:#fef6db;border-radius:12px;"><b style="font-size:16px;">${T('ordinePreventivo.daPagareAdesso', { importo: esc(o.dueNow) })}</b><br>${dueLines.map((p) => esc(`${p.amount} · ${p.label}`)).join('<br>')}${poi}</p>
${T('ordinePreventivo.comePagare')}
${items}${box}
${T('ordinePreventivo.dettagliAcconto')}${sign}`;
		return { subject: T('ordinePreventivo.oggettoAcconto', { n: o.number }), tag: 'quote-order', html: layoutHtml(T('ordinePreventivo.titoloAcconto', { n, parola: hl(T('ordinePreventivo.parolaAcconto')) }), body, { label: T('ordinePreventivo.ctaAcconto'), href: o.href }, lang) };
	}
	const body = `${hi(T, o.name)}
${T('ordinePreventivo.corpo', { preventivo: esc(o.quoteNumber), n })}
${items}${box}
${T('ordinePreventivo.dettagli')}${sign}`;
	return { subject: T('ordinePreventivo.oggetto', { n: o.number }), tag: 'quote-order', html: layoutHtml(T('ordinePreventivo.titolo', { n, parola: hl(T('ordinePreventivo.parola')) }), body, { label: T('comune.apriConferma'), href: o.href }, lang) };
}

/* ---------- Conferma d'ordine (pagina del cliente) ---------- */
/** email scritta dallo staff: testo e un bottone "Apri la conferma d'ordine"; il PDF si scarica dalla pagina */
export function orderConfirmEmail(o: { subject: string; message: string; senderName: string | null; number: string; href: string; toPay: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${o.toPay ? `<p style="${BOX_GIALLO}">${T('conferma.daPagare', { importo: esc(o.toPay) })}</p>` : ''}${firma(T, o.senderName, 'comune.firmaSeguo', 'margin:18px 0 0;')}`;
	return { subject: o.subject, tag: 'order-confirm', html: layoutHtml(T('conferma.titolo', { n: esc(o.number), parola: hl(T('conferma.parola')) }), body, { label: T('comune.apriConferma'), href: o.href }, lang) };
}
export function orderReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	return { subject: T('ordineRisposta.oggetto', { n: o.number }), tag: 'order-reply', html: layoutHtml(T('ordineRisposta.titolo', { n }), replyBody(T, o.name, o.body, o.author), { label: T('comune.apriConferma'), href: o.href }, lang) };
}
export function orderPaymentReminderEmail(o: { name?: string | null; number: string; amount: string; href: string; senderName?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + T('sollecitoPagamento.corpo', { n, importo: esc(o.amount) }) + firma(T, o.senderName, 'comune.firma');
	return { subject: T('sollecitoPagamento.oggetto', { n: o.number }), tag: 'order-payment-reminder', html: layoutHtml(T('sollecitoPagamento.titolo', { n, parola: hl(T('sollecitoPagamento.parola')) }), body, { label: T('sollecitoPagamento.cta'), href: o.href }, lang) };
}

/* ---------- Fattura (pagina del cliente) ---------- */
export function invoiceEmail(o: { subject: string; message: string; senderName: string | null; number: string; href: string; toPay: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const body = `<div style="white-space:pre-wrap;">${esc(o.message)}</div>${o.toPay ? `<p style="${BOX_GIALLO}">${T('fattura.daPagare', { importo: esc(o.toPay) })}</p>` : ''}${firma(T, o.senderName, 'comune.firmaRispondi', 'margin:18px 0 0;')}`;
	return { subject: o.subject, tag: 'invoice', html: layoutHtml(T('fattura.titolo', { n: esc(o.number), parola: hl(T('fattura.parola')) }), body, { label: T('comune.apriFattura'), href: o.href }, lang) };
}
export function invoiceReplyEmail(o: { name?: string | null; number: string; body: string; author?: string | null; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	return { subject: T('fatturaRisposta.oggetto', { n: o.number }), tag: 'invoice-reply', html: layoutHtml(T('fatturaRisposta.titolo', { n }), replyBody(T, o.name, o.body, o.author), { label: T('comune.apriFattura'), href: o.href }, lang) };
}

/** grazie per la recensione: codice sconto personale */
export function reviewThanksEmail(o: { name?: string | null; number: string; code: string; validUntil: string; href: string }, lang: Lang = 'it') {
	const T = tt(lang);
	const body = `${T('recensioneGrazie.corpo', { n: esc(o.number) })}<p style="margin:18px 0;padding:16px;background:#fef6db;border-radius:12px;text-align:center;"><span style="font-size:13px;color:#8a5a00;">${T('recensioneGrazie.ilTuoCodice')}</span><br><b style="font-family:Rubik,Montserrat,Helvetica,Arial,sans-serif;font-size:28px;letter-spacing:.06em;">${esc(o.code)}</b><br><span style="font-size:13px;color:#8a5a00;">${T('recensioneGrazie.condizioni', { data: esc(o.validUntil) })}</span></p>${T('recensioneGrazie.come')}`;
	return { subject: T('recensioneGrazie.oggetto'), tag: 'review-thanks', html: layoutHtml(T('recensioneGrazie.titolo', { nome: esc(o.name || ''), parola: hl(T('recensioneGrazie.parola')) }), body, { label: T('recensioneGrazie.cta'), href: o.href }, lang) };
}

/* ---------- Integrazione di pagamento (modifica dopo l'ordine) ---------- */
const ul = (lines: string[]) => `<ul style="padding-left:18px;">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
export function integrationRequestEmail(o: { name?: string | null; number: string; amount: string; reason: string; lines: string[]; href: string; senderName?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + T('integrazione.corpo', { n, motivo: esc(o.reason) }) + ul(o.lines) + T('integrazione.differenza', { importo: esc(o.amount) }) + firma(T, o.senderName, 'comune.firma');
	return { subject: T('integrazione.oggetto', { n: o.number, importo: o.amount }), tag: 'order-integration', html: layoutHtml(T('integrazione.titolo', { n, parola: hl(T('integrazione.parola')) }), body, { label: T('integrazione.cta'), href: o.href }, lang) };
}
export function integrationInvoiceEmail(o: { name?: string | null; number: string; invoice: string; amount: string; lines: string[] }, lang: Lang = 'it') {
	const T = tt(lang);
	const n = esc(o.number);
	const body = hi(T, o.name) + T('integrazioneRicevuta.corpo', { importo: esc(o.amount), n, fattura: esc(o.invoice) }) + (o.lines.length ? T('integrazioneRicevuta.oraE') + ul(o.lines) : '') + T('integrazioneRicevuta.riparte');
	return { subject: T('integrazioneRicevuta.oggetto', { n: o.number, fattura: o.invoice }), tag: 'order-integration-paid', html: layoutHtml(T('integrazioneRicevuta.titolo', { parola: hl(T('integrazioneRicevuta.parola')) }), body, null, lang) };
}

/** Email di Supabase Auth (conferma account, reset password, magic link, cambio email, invito, codice): le manda il sito via Postmark
    tramite l'hook "Send Email" di Supabase, con il nostro mittente e la nostra grafica. */
export type AuthMailKind = 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite' | 'reauthentication' | 'email';
export function authEmail(kind: AuthMailKind, o: { name?: string | null; email: string; href: string; code?: string | null; newEmail?: string | null }, lang: Lang = 'it') {
	const T = tt(lang);
	const ciao = o.name?.trim() ? T('auth.ciaoNome', { nome: o.name.trim() }) : T('auth.ciao');
	const note = `<p style="font-size:13px;color:#8e92b0;">${T('auth.nota')}</p>`;
	switch (kind) {
		case 'recovery':
			return { subject: T('auth.recovery.oggetto'), tag: 'auth-recovery', html: layout(T('auth.recovery.titolo', { ciao }), T('auth.recovery.corpo') + note, { label: T('auth.recovery.cta'), href: o.href }, lang) };
		case 'magiclink':
			return { subject: T('auth.magiclink.oggetto'), tag: 'auth-magiclink', html: layout(T('auth.magiclink.titolo', { ciao }), T('auth.magiclink.corpo') + note, { label: T('auth.magiclink.cta'), href: o.href }, lang) };
		case 'email_change':
			return { subject: T('auth.emailChange.oggetto'), tag: 'auth-email-change', html: layout(T('auth.emailChange.titolo', { ciao }), T('auth.emailChange.corpo', { email: esc(o.newEmail || o.email) }) + note, { label: T('auth.emailChange.cta'), href: o.href }, lang) };
		case 'invite':
			return { subject: T('auth.invite.oggetto'), tag: 'auth-invite', html: layout(T('auth.invite.titolo', { ciao }), T('auth.invite.corpo'), { label: T('auth.invite.cta'), href: o.href }, lang) };
		case 'reauthentication':
			return { subject: T('auth.codice.oggetto'), tag: 'auth-code', html: layout(T('auth.codice.titolo', { ciao }), `${T('auth.codice.corpo')}<p style="font-size:30px;font-weight:800;letter-spacing:.2em;text-align:center;color:#0b0b3b;">${esc(o.code || '')}</p>${T('auth.codice.dopo')}${note}`, undefined, lang) };
		default:
			return { subject: T('auth.signup.oggetto'), tag: 'auth-signup', html: layout(T('auth.signup.titolo', { ciao }), T('auth.signup.corpo') + note, { label: T('auth.signup.cta'), href: o.href }, lang) };
	}
}
