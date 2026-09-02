import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { welcomeEmail } from '$lib/server/email-templates';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const form = await request.formData();
		const fullName = String(form.get('full_name') ?? '').trim().slice(0, 120);
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const privacy = form.get('privacy') === 'on';

		if (!fullName || !email || !password) return fail(400, { fullName, email, error: 'Compila tutti i campi.' });
		if (password.length < 8) return fail(400, { fullName, email, error: 'La password deve avere almeno 8 caratteri.' });
		if (!privacy) return fail(400, { fullName, email, error: 'Devi accettare la privacy policy.' });

		const origin = PUBLIC_SITE_URL || url.origin;
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${origin}/auth/callback?next=/account`,
				data: { full_name: fullName }
			}
		});

		if (error) {
			const msg = error.code === 'user_already_exists' ? 'Esiste già un account con questa email.' : error.message;
			return fail(400, { fullName, email, error: msg });
		}

		// Supabase invia la mail di conferma; noi mandiamo il benvenuto via Postmark.
		// Non blocca la registrazione se Postmark non è configurato.
		if (data.user) {
			sendEmail({ to: email, ...welcomeEmail({ name: fullName, email }) }).catch((e) =>
				console.error('[signup] welcome email', e)
			);
		}

		// Se la conferma email è attiva su Supabase, session è null: mostriamo il messaggio.
		return { success: true, needsConfirmation: !data.session, email };
	}
};
