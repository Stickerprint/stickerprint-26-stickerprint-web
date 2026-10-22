import { json } from '@sveltejs/kit';
import { t } from '$lib/traduzioni';
import { LOCALES } from '$lib/i18n';
import { klaviyoIscrivi } from '$lib/server/klaviyo';
import type { RequestHandler } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST /api/newsletter { email, fonte? } → salva in newsletter_subscribers e iscrive alla lista Klaviyo con la lingua del sito
 *  (fonte: 'footer' o 'popup'; da li' parte il flusso di benvenuto nella lingua giusta) */
export const POST: RequestHandler = async ({ request, locals: { supabase, locale }, getClientAddress }) => {
	const body = (await request.json().catch(() => ({}))) as { email?: string; fonte?: string };
	const email = String(body.email ?? '').trim().toLowerCase();
	if (!EMAIL_RE.test(email)) return json({ ok: false, error: t(locale, 'api.emailNonValida') }, { status: 400 });
	const fonte = body.fonte === 'popup' ? 'popup' : 'footer';
	const lingua = LOCALES[locale]?.lang ?? 'it';
	const paese = request.headers.get('x-vercel-ip-country');

	const { error } = await supabase.from('newsletter_subscribers').insert({
		email,
		source: fonte,
		ip: getClientAddress()
	});
	/* Klaviyo anche se l'email era gia' nella nostra tabella: la lista e il flusso di benvenuto sono li' */
	const kl = klaviyoIscrivi({ email, lingua, sito: locale, paese, fonte: fonte === 'popup' ? `popup sito /${locale}` : `footer sito /${locale}` });

	if (error) {
		if (error.code === '23505') { await kl; return json({ ok: true, already: true }); }
		console.error('[newsletter]', error);
		return json({ ok: false, error: t(locale, 'api.iscrizioneNonSalvata') }, { status: 500 });
	}
	await kl;
	return json({ ok: true });
};
