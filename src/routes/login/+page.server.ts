import { fail, redirect } from '@sveltejs/kit';
import { t } from '$lib/traduzioni';
import { localizePath } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	return { next: url.searchParams.get('next') ?? localizePath('/account', locals.locale) };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, locale }, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? localizePath('/account', locale)), localizePath('/account', locale));

		if (!email || !password) return fail(400, { email, error: t(locale, 'account.errori.emailPassword') });

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			const msg =
				error.code === 'email_not_confirmed'
					? t(locale, 'account.errori.emailNonConfermata')
					: t(locale, 'account.errori.credenziali');
			return fail(400, { email, error: msg });
		}
		redirect(303, next);
	}
};

/** Evita redirect aperti verso domini esterni */
function safeNext(next: string, fallback: string): string {
	return next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
