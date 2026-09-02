import { env } from '$env/dynamic/private';

/**
 * Invio email tramite Postmark (API REST, nessuna dipendenza aggiuntiva).
 * Docs: https://postmarkapp.com/developer/api/email-api
 */

export interface SendEmailInput {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	tag?: string;
	replyTo?: string;
	/** Metadati liberi visibili nel pannello Postmark */
	metadata?: Record<string, string>;
}

export interface SendEmailResult {
	ok: boolean;
	messageId?: string;
	error?: string;
	skipped?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
	const token = env.POSTMARK_SERVER_TOKEN;
	const from = env.POSTMARK_FROM || 'Stickerprint <noreply@stickerprint.it>';
	const stream = env.POSTMARK_MESSAGE_STREAM || 'outbound';

	// In sviluppo senza token: logga e basta, non blocca il flusso.
	if (!token) {
		console.warn('[email] POSTMARK_SERVER_TOKEN mancante — email non inviata:', {
			to: input.to,
			subject: input.subject
		});
		return { ok: true, skipped: true };
	}

	const res = await fetch('https://api.postmarkapp.com/email', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Postmark-Server-Token': token
		},
		body: JSON.stringify({
			From: from,
			To: Array.isArray(input.to) ? input.to.join(',') : input.to,
			Subject: input.subject,
			HtmlBody: input.html,
			TextBody: input.text ?? htmlToText(input.html),
			Tag: input.tag,
			ReplyTo: input.replyTo,
			MessageStream: stream,
			Metadata: input.metadata,
			TrackOpens: true
		})
	});

	const body = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string };
	if (!res.ok) {
		console.error('[email] Postmark error', res.status, body);
		return { ok: false, error: body.Message || `HTTP ${res.status}` };
	}
	return { ok: true, messageId: body.MessageID };
}

/** Versione testo minimale per i client che non mostrano HTML */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
