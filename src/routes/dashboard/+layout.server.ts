import { redirect } from '@sveltejs/kit';
import { PUBLIC_VAPID_KEY } from '$env/static/public';
import type { LayoutServerLoad } from './$types';
import { periz, perizConfigurato } from '$lib/server/periz';
import { aziendeCounts } from '$lib/server/richieste';
import { supportoCounts } from '$lib/server/helpdesk';
import { confirmCounts } from '$lib/server/conferme';
import { invoiceCounts } from '$lib/server/fatture';
import { pendingReviews } from '$lib/server/recensioni';

/** Tutta l'area /dashboard richiede un profilo staff o admin. */
export const load: LayoutServerLoad = async ({ locals: { supabase, session, user }, url }) => {
	if (url.pathname === '/dashboard/login') return { role: null, counts: {} as Record<string, number>, vapid: '' };
	if (!session || !user) redirect(303, '/dashboard/login');

	const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) {
		await supabase.auth.signOut();
		redirect(303, '/dashboard/login');
	}
	// contatori del menù: lavorazioni aperte per reparto, problemi (bloccate o in ritardo), ordini in spedizione e in attesa di prova
	const [{ data: rows }, { data: tasks }] = await Promise.all([
		supabase.from('orders').select('prod_stage, status').in('status', ['pronto', 'in_spedizione', 'attesa_prova', 'in_attesa']),
		supabase.from('production_tasks').select('stage, status, due_at, order:orders!inner(status)').in('status', ['pronto', 'in_corso', 'bloccato']).eq('order.status', 'in_produzione')
	]);
	const counts: Record<string, number> = {};
	const now = Date.now();
	for (const t of tasks ?? []) {
		counts[t.stage] = (counts[t.stage] ?? 0) + 1;
		if (t.status === 'bloccato' || (t.due_at && new Date(t.due_at).getTime() < now)) counts.problemi = (counts.problemi ?? 0) + 1;
	}
	for (const r of rows ?? []) {
		if (r.status === 'pronto' || r.status === 'in_spedizione') counts.spedizione = (counts.spedizione ?? 0) + 1;
		if (r.status === 'attesa_prova' || r.status === 'in_attesa') counts.prove = (counts.prove ?? 0) + 1;
	}
	// richieste aziendali nuove + preventivi da sollecitare; ticket nuovi o con risposta del cliente da leggere
	const [az, sup, conf, invq, rev] = await Promise.all([aziendeCounts(supabase), supportoCounts(supabase), confirmCounts(supabase), invoiceCounts(supabase), pendingReviews(supabase)]);
	if (rev) counts.recensioni = rev;
	if (invq) counts.fatture = invq;
	if (conf) counts.prove = (counts.prove ?? 0) + conf;
	if (az.nuove) counts.aziende = az.nuove;
	if (az.daSollecitare) counts.preventivi = az.daSollecitare;
	if (sup.daLeggere) counts.supporto = sup.daLeggere;
	// contatori della sezione Marketing (dashboard PERIZ): letti solo se la chiave c'è,
	// e senza far aspettare il resto se la dashboard non risponde
	if (perizConfigurato()) {
		const [c, n] = await Promise.all([periz.contenuti(), periz.notifiche(50)]);
		if (c.ok && c.conteggi.in_attesa) counts.approvazioni = c.conteggi.in_attesa;
		if (n.ok && n.nonLette) counts.notifiche = n.nonLette;
	}
	return { role: profile.role as 'admin' | 'staff', fullName: profile.full_name as string | null, counts, vapid: PUBLIC_VAPID_KEY };
};
