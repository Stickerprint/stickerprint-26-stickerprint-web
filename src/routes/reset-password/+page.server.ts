import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
		if (!email) return fail(400, { error: 'Inserisci la tua email.' });

		const origin = PUBLIC_SITE_URL || url.origin;
		await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${origin}/auth/callback?next=/account/password`
		});
		// Risposta identica anche se l'email non esiste: non riveliamo gli account registrati.
		return { sent: true, email };
	}
};
