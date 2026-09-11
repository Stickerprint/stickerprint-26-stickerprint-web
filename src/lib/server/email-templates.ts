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

function layout(title: string, body: string, cta?: { label: string; href: string }): string {
	return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f5fa;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#0b0b3b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5fa;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;overflow:hidden;">
  <tr><td style="background:#050538;padding:26px 32px;text-align:center;">
    <img src="${SITE}/images/splogo-400.png" width="120" alt="Stickerprint" style="display:inline-block;transform:rotate(-5deg);">
  </td></tr>
  <tr><td style="padding:34px 32px 10px;">
    <h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;letter-spacing:-0.02em;">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3d3f63;">${body}</div>
    ${cta ? `<p style="margin:28px 0 8px;"><a href="${cta.href}" style="display:inline-block;background:#0e8bff;color:#fff;text-decoration:none;font-weight:800;text-transform:uppercase;font-size:14px;padding:14px 26px;border-radius:6px;">${esc(cta.label)}</a></p>` : ''}
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

export function orderConfirmationEmail(opts: { name?: string | null; numbers: string[]; invoiceNumber: string; total: string; lines: string[]; shipDate: string; accountUrl?: string | null }) {
	const items = opts.lines.map((l) => `<li>${l}</li>`).join('');
	return {
		subject: `Ordine ${opts.numbers.join(', ')} confermato – Stickerprint`,
		tag: 'order-confirmation',
		html: `<p>Ciao ${opts.name || ''},</p>
<p>grazie per il tuo ordine! Abbiamo ricevuto il pagamento e stiamo già preparando la <strong>prova di stampa</strong>, che ti invieremo a breve via email.</p>
<p><strong>Ordine:</strong> ${opts.numbers.join(', ')}<br><strong>Fattura:</strong> ${opts.invoiceNumber} (in allegato)<br><strong>Totale pagato:</strong> ${opts.total}<br><strong>Pronti per la spedizione entro:</strong> ${opts.shipDate}</p>
<ul>${items}</ul>
${opts.accountUrl ? `<p>Trovi ordine e fattura anche nella tua <a href="${opts.accountUrl}">area personale</a>.</p>` : '<p>Vuoi seguire l’ordine e guadagnare credito sul prossimo? <a href="https://stickerprint.it/signup">Crea il tuo account</a> con questa stessa email: ordine e fattura saranno già lì.</p>'}
<p>A presto,<br>Il team Stickerprint</p>`
	};
}

/** Conferma d'ordine per gli ordini inseriti dalla dashboard (con PDF allegato) */
export function manualOrderEmail(opts: { name?: string | null; number: string; total: string; lines: string[]; shipDate: string; terms: string[] }) {
	return {
		subject: `Conferma d'ordine ${opts.number} – Stickerprint`,
		tag: 'order-confirmation-manual',
		html: `<p>Ciao ${opts.name || ''},</p>
<p>ti confermiamo l'ordine <strong>${opts.number}</strong>. In allegato trovi il riepilogo in PDF.</p>
<ul>${opts.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
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
export function shippingUpdateEmail(o: { kind: 'affidato' | 'spedito' | 'in_consegna' | 'consegnato' | 'problema' | 'punto_ritiro'; name?: string | null; number: string; trackingUrl: string; courier?: string | null; detail?: string; place?: string | null; items: string[]; accountUrl?: string | null; consegna?: 'corriere' | 'noi' | 'cliente' }) {
	const hi = `<p>Ciao ${esc(o.name || '')},</p>`;
	const list = o.items.length ? `<ul style="margin:14px 0 0;padding-left:18px;">${o.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
	const courier = o.courier ? ` con ${esc(o.courier.replace('-ITA', ''))}` : '';
	const n = esc(o.number);
	const dopo = o.consegna === 'noi' ? 'lo consegniamo noi direttamente nei prossimi giorni.' : o.consegna === 'cliente' ? 'è pronto per il ritiro da parte del tuo corriere.' : 'ora è in attesa di ritiro da parte del corriere. Appena parte ti scriviamo con il link per seguirlo.';
	const T = {
		affidato: { subject: `Il tuo ordine ${o.number} è concluso 🚀`, title: `Il tuo ordine ${n} è ${hl('concluso')} 🚀`, body: `${hi}<p>l'abbiamo stampato, controllato e confezionato: ${dopo}</p>${list}`, cta: o.accountUrl ? 'Vedi il tuo ordine' : 'Vai su Stickerprint', gif: false },
		spedito: { subject: `Il tuo ordine ${o.number} è partito 🚚`, title: `Il tuo ordine ${n} è ${hl('partito')} 🚚`, body: `${hi}<p>il corriere${courier} lo ha preso in carico. Puoi seguirlo passo passo dal link qui sotto.</p>${list}`, cta: 'Segui la spedizione', gif: true },
		in_consegna: { subject: `Il tuo ordine ${o.number} è in consegna 📦`, title: `Il tuo ordine ${n} è ${hl('in consegna')} 📦`, body: `${hi}<p>arriva oggi${o.place ? ` (zona ${esc(o.place)})` : ''}. Se non ci sei, il corriere lascia un avviso o riprova domani.</p>`, cta: 'Segui la spedizione', gif: false },
		consegnato: { subject: `Il tuo ordine ${o.number} è stato consegnato ✅`, title: `Il tuo ordine ${n} è stato ${hl('consegnato')} ✅`, body: `${hi}<p>speriamo che i tuoi adesivi ti piacciano. Se qualcosa non va, rispondi a questa email e ci pensiamo noi.</p>${list}`, cta: o.accountUrl ? 'Vedi il tuo ordine' : 'Vedi la spedizione', gif: false },
		problema: { subject: `Il tuo ordine ${o.number} ha bisogno di te ⚠️`, title: `Il tuo ordine ${n} è ${hl('fermo')} ⚠️`, body: `${hi}<p>il corriere segnala un problema${o.detail ? `: <b>${esc(o.detail)}</b>` : ''}${o.place ? ` (${esc(o.place)})` : ''}. Di solito basta un contatto con il corriere o un indirizzo più preciso: controlla il tracking e, se serve, rispondi a questa email con un recapito telefonico.</p>`, cta: 'Vedi il tracking', gif: false },
		punto_ritiro: { subject: `Il tuo ordine ${o.number} è al punto di ritiro 📍`, title: `Il tuo ordine ${n} è ${hl('al punto di ritiro')} 📍`, body: `${hi}<p>il pacco è stato lasciato in un punto di ritiro${o.place ? ` (${esc(o.place)})` : ''}. Nel tracking trovi indirizzo e orari.</p>`, cta: 'Vedi dove ritirarlo', gif: false }
	}[o.kind];
	const href = (o.kind === 'consegnato' || o.kind === 'affidato') && o.accountUrl ? o.accountUrl : o.trackingUrl;
	const gif = T.gif ? `<p style="margin:18px 0 0;"><img src="${SITE}/images/email/partito.gif" width="496" alt="" style="width:100%;max-width:496px;height:auto;display:block;border-radius:12px;"></p>` : '';
	return { subject: T.subject, tag: `shipping-${o.kind}`, html: layoutHtml(T.title, T.body + gif, { label: T.cta, href }) };
}

/** richiesta di recensione, 24 ore dopo la consegna (registrati e ospiti) */
export function reviewRequestEmail(o: { name?: string | null; number: string; items: string[]; href: string }) {
	const n = esc(o.number);
	const list = o.items.length ? `<ul style="margin:14px 0 0;padding-left:18px;">${o.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
	return { subject: `Com'è andata con l'ordine ${o.number}? ⭐`, tag: 'review-request', html: layoutHtml(`Il tuo ordine ${n} è ${hl('arrivato')} ⭐`, `<p>Ciao ${esc(o.name || '')},</p><p>ieri il corriere ti ha consegnato i tuoi adesivi. Ci racconti com'è andata? Bastano due righe e una stella da 1 a 5: aiutano noi a migliorare e chi deve ancora scegliere.</p>${list}`, { label: 'Lascia una recensione', href: o.href }) };
}

/** stesso layout delle altre email, ma il titolo puo' contenere HTML (la parola sottolineata) */
function layoutHtml(titleHtml: string, body: string, cta?: { label: string; href: string }): string {
	const plain = titleHtml.replace(/<[^>]+>/g, '');
	return layout('§TITLE§', body, cta).replace('<h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;letter-spacing:-0.02em;">§TITLE§</h1>', `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;letter-spacing:-0.02em;">${titleHtml}</h1>`).replace('<title>§TITLE§</title>', `<title>${esc(plain)}</title>`);
}
