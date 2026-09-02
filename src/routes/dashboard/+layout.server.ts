import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Tutta l'area /dashboard richiede un profilo staff o admin. */
export const load: LayoutServerLoad = async ({ locals: { supabase, session, user }, url }) => {
	if (url.pathname === '/dashboard/login') return { role: null };
	if (!session || !user) redirect(303, '/dashboard/login');

	const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) {
		await supabase.auth.signOut();
		redirect(303, '/dashboard/login');
	}
	return { role: profile.role as 'admin' | 'staff', fullName: profile.full_name as string | null };
};
