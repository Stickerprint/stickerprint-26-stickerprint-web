import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { t } from '$lib/traduzioni';
import { localizePath } from '$lib/i18n';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, locale }, url }) => {
		const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
		if (!email) return fail(400, { error: t(locale, 'account.errori.inserisciEmail') });

		const origin = PUBLIC_SITE_URL || url.origin;
		await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(localizePath('/account/password', locale))}`
		});
		// Risposta identica anche se l'email non esiste: non riveliamo gli account registrati.
		return { sent: true, email };
	}
};
