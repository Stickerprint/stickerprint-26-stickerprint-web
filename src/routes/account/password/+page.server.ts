import { fail } from '@sveltejs/kit';
import { langOf } from '$lib/i18n';
import { sendEmail } from '$lib/server/email';
import { passwordChangedEmail } from '$lib/server/email-templates';
import { t } from '$lib/traduzioni';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, user, locale } }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (password.length < 8) return fail(400, { error: t(locale, 'account.errori.passwordCorta') });
		if (password !== confirm) return fail(400, { error: t(locale, 'account.errori.passwordDiverse') });

		const { error } = await supabase.auth.updateUser({ password });
		if (error) return fail(400, { error: error.message });

		if (user?.email) {
			sendEmail({ to: user.email, ...passwordChangedEmail({ email: user.email }, langOf(locale)) }).catch(() => {});
		}
		return { success: true };
	}
};
