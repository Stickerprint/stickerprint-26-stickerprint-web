import { fail } from '@sveltejs/kit';
import { sendEmail } from '$lib/server/email';
import { passwordChangedEmail } from '$lib/server/email-templates';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, user } }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (password.length < 8) return fail(400, { error: 'La password deve avere almeno 8 caratteri.' });
		if (password !== confirm) return fail(400, { error: 'Le due password non coincidono.' });

		const { error } = await supabase.auth.updateUser({ password });
		if (error) return fail(400, { error: error.message });

		if (user?.email) {
			sendEmail({ to: user.email, ...passwordChangedEmail({ email: user.email }) }).catch(() => {});
		}
		return { success: true };
	}
};
