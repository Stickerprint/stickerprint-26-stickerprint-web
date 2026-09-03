import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { welcomeEmail } from '$lib/server/email-templates';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const form = await request.formData();
		const firstName = String(form.get('first_name') ?? '').trim().slice(0, 60);
		const lastName = String(form.get('last_name') ?? '').trim().slice(0, 60);
		const fullName = `${firstName} ${lastName}`.trim();
		const phone = String(form.get('phone') ?? '').trim().slice(0, 30);
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const privacy = form.get('privacy') === 'on';
		const newsletter = form.get('newsletter') === 'on';
		const next = String(form.get('next') ?? '/account');

		if (!firstName || !lastName || !email || !password) return fail(400, { fullName, email, error: 'Compila nome, cognome, email e password.' });
		if (password.length < 8) return fail(400, { fullName, email, error: 'La password deve avere almeno 8 caratteri.' });
		if (!privacy) return fail(400, { fullName, email, error: 'Devi accettare la privacy policy.' });

		const origin = PUBLIC_SITE_URL || url.origin;
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
				data: { full_name: fullName, phone, marketing_opt_in: newsletter }
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

		if (newsletter) supabase.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true }).then(() => {});
		// Con conferma email attiva su Supabase la sessione è nulla: mostriamo il messaggio. Altrimenti si entra subito.
		if (data.session) redirect(303, next.startsWith('/') ? next : '/account');
		return { success: true, needsConfirmation: true, email };
	}
};
