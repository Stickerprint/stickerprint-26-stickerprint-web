import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { session } }) => {
	if (session) redirect(303, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { email, error: 'Inserisci email e password.' });

		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error || !data.user) return fail(400, { email, error: 'Credenziali non corrette.' });

		// solo staff e admin entrano nell'area amministratore
		const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
		if (!profile || !['admin', 'staff'].includes(profile.role)) {
			await supabase.auth.signOut();
			return fail(403, { email, error: 'Questo account non ha accesso all’area amministratore.' });
		}
		redirect(303, '/dashboard');
	}
};
