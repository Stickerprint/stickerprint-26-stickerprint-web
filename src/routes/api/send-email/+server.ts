import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sendEmail } from '$lib/server/email';
import {
	OWNER_EMAIL,
	contactAutoReplyEmail,
	contactRequestEmail,
	ownerNotifyEmail,
	welcomeEmail
} from '$lib/server/email-templates';
import type { RequestHandler } from './$types';

/**
 * POST /api/send-email
 * Body: { type, ...payload }
 *
 * Autorizzazione:
 *  - header `x-internal-key` uguale a INTERNAL_API_KEY → tutti i tipi (uso interno / automazioni)
 *  - utente loggato → solo i tipi "self" (welcome a se stesso)
 *  - anonimo → solo contact (form pubblici), con controllo anti-abuso minimo
 */
type Body =
	| { type: 'welcome' }
	| { type: 'contact'; kind: 'support' | 'business'; name: string; email: string; message: string }
	| { type: 'owner-notify'; title: string; lines: string[]; href?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => null)) as Body | null;
	if (!body || typeof body !== 'object' || !('type' in body)) error(400, 'Body non valido');

	const internal = !!env.INTERNAL_API_KEY && request.headers.get('x-internal-key') === env.INTERNAL_API_KEY;
	const user = locals.user;

	switch (body.type) {
		case 'welcome': {
			if (!user && !internal) error(401, 'Non autorizzato');
			const to = user?.email;
			if (!to) error(400, 'Email utente mancante');
			const tpl = welcomeEmail({ name: user?.user_metadata?.full_name, email: to });
			return json(await sendEmail({ to, ...tpl }));
		}

		case 'contact': {
			const name = String(body.name ?? '').trim().slice(0, 120);
			const email = String(body.email ?? '').trim().toLowerCase();
			const message = String(body.message ?? '').trim().slice(0, 5000);
			if (!name || !EMAIL_RE.test(email) || message.length < 10) error(400, 'Compila nome, email e messaggio');
			const kind = body.kind === 'business' ? 'business' : 'support';

			const [owner, reply] = await Promise.all([
				sendEmail({ to: OWNER_EMAIL, replyTo: email, ...contactRequestEmail({ name, email, message, kind }) }),
				sendEmail({ to: email, ...contactAutoReplyEmail({ name }) })
			]);
			return json({ ok: owner.ok && reply.ok });
		}

		case 'owner-notify': {
			if (!internal) error(401, 'Non autorizzato');
			const tpl = ownerNotifyEmail({ title: String(body.title), lines: (body.lines ?? []).map(String), href: body.href });
			return json(await sendEmail({ to: OWNER_EMAIL, ...tpl }));
		}

		default:
			error(400, 'Tipo email sconosciuto');
	}
};
