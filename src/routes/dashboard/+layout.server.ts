import { redirect } from '@sveltejs/kit';
import { PUBLIC_VAPID_KEY } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

/** Tutta l'area /dashboard richiede un profilo staff o admin. */
export const load: LayoutServerLoad = async ({ locals: { supabase, session, user }, url }) => {
	if (url.pathname === '/dashboard/login') return { role: null, counts: {} as Record<string, number>, vapid: '' };
	if (!session || !user) redirect(303, '/dashboard/login');

	const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) {
		await supabase.auth.signOut();
		redirect(303, '/dashboard/login');
	}
	// contatori del menù: articoli per fase di produzione e ordini pronti per la spedizione
	const { data: rows } = await supabase.from('orders').select('prod_stage, status').in('status', ['in_produzione', 'pronto', 'in_spedizione', 'attesa_prova', 'in_attesa']);
	const counts: Record<string, number> = {};
	for (const r of rows ?? []) {
		if (r.status === 'in_produzione' && r.prod_stage) counts[r.prod_stage] = (counts[r.prod_stage] ?? 0) + 1;
		if (r.status === 'pronto' || r.status === 'in_spedizione') counts.spedizione = (counts.spedizione ?? 0) + 1;
		if (r.status === 'attesa_prova' || r.status === 'in_attesa') counts.prove = (counts.prove ?? 0) + 1;
	}
	return { role: profile.role as 'admin' | 'staff', fullName: profile.full_name as string | null, counts, vapid: PUBLIC_VAPID_KEY };
};
