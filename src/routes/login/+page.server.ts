import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { next: url.searchParams.get('next') ?? '/account' };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/account'));

		if (!email || !password) return fail(400, { email, error: 'Inserisci email e password.' });

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			const msg =
				error.code === 'email_not_confirmed'
					? 'Devi prima confermare la tua email: controlla la posta.'
					: 'Email o password non corretti.';
			return fail(400, { email, error: msg });
		}
		redirect(303, next);
	}
};

/** Evita redirect aperti verso domini esterni */
function safeNext(next: string): string {
	return next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}
