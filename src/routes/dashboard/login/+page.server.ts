import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** dopo il login si torna dove si era partiti, solo dentro l'area interna (dashboard o studio) */
const safeNext = (v: unknown) => {
	const s = String(v ?? '');
	return /^\/(dashboard|studio)(\/|$|\?)/.test(s) && !s.startsWith('//') ? s : '/dashboard';
};

export const load: PageServerLoad = async ({ locals: { session }, url }) => {
	if (session) redirect(303, safeNext(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
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
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
