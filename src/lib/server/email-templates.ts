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
<p><strong>Ordine:</strong> ${opts.numbers.join(', ')}<br><strong>Fattura:</strong> ${opts.invoiceNumber} (in allegato)<br><strong>Totale pagato:</strong> ${opts.total}<br><strong>Pronti per la spedizione:</strong> ${opts.shipDate}</p>
<ul>${items}</ul>
${opts.accountUrl ? `<p>Trovi ordine e fattura anche nella tua <a href="${opts.accountUrl}">area personale</a>.</p>` : '<p>Vuoi seguire l’ordine e guadagnare credito sul prossimo? <a href="https://stickerprint.it/signup">Crea il tuo account</a> con questa stessa email: ordine e fattura saranno già lì.</p>'}
<p>A presto,<br>Il team Stickerprint</p>`
	};
}
