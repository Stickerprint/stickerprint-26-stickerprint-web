import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import { localizePath } from '$lib/i18n';
import type { RequestHandler } from './$types';

/**
 * Punto di rientro dei link inviati da Supabase Auth:
 *  - conferma registrazione / magic link (PKCE: ?code=...)
 *  - reset password e verifiche OTP (?token_hash=...&type=...)
 */
/* /auth non ha prefisso di lingua: la lingua viene dal cookie (locals.locale) e i rientri tornano nella lingua del cliente */
export const GET: RequestHandler = async ({ url, locals: { supabase, locale } }) => {
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const account = localizePath('/account', locale);
	const rawNext = url.searchParams.get('next') ?? account;
	const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : account;

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}

	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) redirect(303, type === 'recovery' ? localizePath('/account/password', locale) : next);
	}

	redirect(303, `${localizePath('/login', locale)}?error=link`);
};
