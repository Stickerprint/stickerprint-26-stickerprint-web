import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { welcomeEmail } from '$lib/server/email-templates';
import { t } from '$lib/traduzioni';
import { localizePath, langOf } from '$lib/i18n';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, locale }, url }) => {
		const form = await request.formData();
		const firstName = String(form.get('first_name') ?? '').trim().slice(0, 60);
		const lastName = String(form.get('last_name') ?? '').trim().slice(0, 60);
		const fullName = `${firstName} ${lastName}`.trim();
		const phone = String(form.get('phone') ?? '').trim().slice(0, 30);
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const privacy = form.get('privacy') === 'on';
		const newsletter = form.get('newsletter') === 'on';
		const customerType = form.get('customer_type') === 'azienda' ? 'azienda' : 'privato';
		const companyName = String(form.get('company_name') ?? '').trim().slice(0, 120);
		const vatNumber = String(form.get('vat_number') ?? '').trim().slice(0, 20);
		if (customerType === 'azienda' && (!companyName || !vatNumber)) return fail(400, { fullName, email, error: t(locale, 'account.errori.aziendaDati') });
		const home = localizePath('/account', locale);
		const next = String(form.get('next') ?? home);

		if (!firstName || !lastName || !email || !password) return fail(400, { fullName, email, error: t(locale, 'account.errori.compilaRegistrazione') });
		if (password.length < 8) return fail(400, { fullName, email, error: t(locale, 'account.errori.passwordCorta') });
		if (!privacy) return fail(400, { fullName, email, error: t(locale, 'account.errori.privacy') });

		const origin = PUBLIC_SITE_URL || url.origin;
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
				data: { full_name: fullName, phone, marketing_opt_in: newsletter, customer_type: customerType, company_name: companyName, vat_number: vatNumber, locale /* lingua del sito al momento dell'iscrizione: le email di autenticazione (webhook) la leggono da qui */ }
			}
		});

		if (error) {
			const msg = error.code === 'user_already_exists' ? t(locale, 'account.errori.emailEsistente') : error.message;
			return fail(400, { fullName, email, error: msg });
		}

		// Supabase invia la mail di conferma; noi mandiamo il benvenuto via Postmark.
		// Non blocca la registrazione se Postmark non è configurato.
		if (data.user) {
			sendEmail({ to: email, ...welcomeEmail({ name: fullName, email }, langOf(locale)) }).catch((e) =>
				console.error('[signup] welcome email', e)
			);
		}

		if (newsletter) supabase.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true }).then(() => {});
		// Con conferma email attiva su Supabase la sessione è nulla: mostriamo il messaggio. Altrimenti si entra subito.
		if (data.session) redirect(303, next.startsWith('/') ? next : home);
		return { success: true, needsConfirmation: true, email };
	}
};
