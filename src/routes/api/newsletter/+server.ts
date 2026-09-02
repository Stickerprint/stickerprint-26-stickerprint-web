import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST /api/newsletter { email } → salva in newsletter_subscribers */
export const POST: RequestHandler = async ({ request, locals: { supabase }, getClientAddress }) => {
	const body = (await request.json().catch(() => ({}))) as { email?: string };
	const email = String(body.email ?? '').trim().toLowerCase();
	if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Inserisci un indirizzo email valido.' }, { status: 400 });

	const { error } = await supabase.from('newsletter_subscribers').insert({
		email,
		source: 'footer',
		ip: getClientAddress()
	});

	if (error) {
		if (error.code === '23505') return json({ ok: true, already: true });
		console.error('[newsletter]', error);
		return json({ ok: false, error: 'Non siamo riusciti a salvare l’iscrizione.' }, { status: 500 });
	}
	return json({ ok: true });
};
