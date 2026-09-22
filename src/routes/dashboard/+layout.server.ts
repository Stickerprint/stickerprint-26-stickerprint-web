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
const perizCache = { at: 0, busy: false, approvazioni: 0, notifiche: 0 };
const countsCache: { at: number; value: Record<string, number> | null } = { at: 0, value: null };

async function menuCounts(supabase: App.Locals['supabase']): Promise<Record<string, number>> {
	const [{ data: rows }, { data: tasks }, { count: daAvviare }, az, sup, conf, invq, rev] = await Promise.all([
		supabase.from('orders').select('prod_stage, status, transmitted_at, ddt_id').in('status', ['pronto', 'in_spedizione']),
		supabase.from('production_tasks').select('stage, status, job:production_jobs!inner(status)').in('status', ['pronto', 'in_corso', 'bloccato']).in('job.status', ['READY_TO_START', 'IN_PROGRESS', 'WAITING_PASSIVE_TIME']),
		supabase.from('production_jobs').select('id', { count: 'exact', head: true }).eq('status', 'READY_TO_START'),
		aziendeCounts(supabase), supportoCounts(supabase), confirmCounts(supabase), invoiceCounts(supabase), pendingReviews(supabase)
	]);
	const counts: Record<string, number> = {};
	for (const t of tasks ?? []) counts[t.stage] = (counts[t.stage] ?? 0) + 1;
	if (daAvviare) counts.daAvviare = daAvviare;
	for (const r of rows ?? []) if (!r.transmitted_at && !r.ddt_id) counts.spedizione = (counts.spedizione ?? 0) + 1;
	if (rev) counts.recensioni = rev;
	if (invq) counts.fatture = invq;
	if (conf) counts.prove = (counts.prove ?? 0) + conf;
	if (az.nuove) counts.aziende = az.nuove;
	if (az.daSollecitare) counts.preventivi = az.daSollecitare;
	if (sup.daLeggere) counts.supporto = sup.daLeggere;
	// la dashboard PERIZ (servizio esterno): valori in memoria, aggiornati in sottofondo ogni 5 minuti, mai attesi
	if (perizConfigurato()) {
		if (Date.now() - perizCache.at > 5 * 60 * 1000 && !perizCache.busy) {
			perizCache.busy = true;
			Promise.all([periz.contenuti(), periz.notifiche(50)]).then(([c, n]) => {
				perizCache.approvazioni = c.ok ? (c.conteggi.in_attesa ?? 0) : 0; perizCache.notifiche = n.ok ? (n.nonLette ?? 0) : 0; perizCache.at = Date.now();
			}).catch(() => {}).finally(() => { perizCache.busy = false; });
		}
		if (perizCache.approvazioni) counts.approvazioni = perizCache.approvazioni;
		if (perizCache.notifiche) counts.notifiche = perizCache.notifiche;
	}
	return counts;
}

export const load: LayoutServerLoad = async ({ locals: { supabase, session, user }, url }) => {
	if (url.pathname === '/dashboard/login') return { role: null, counts: {} as Record<string, number>, vapid: '' };
	if (!session || !user) redirect(303, '/dashboard/login');

	const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) {
		await supabase.auth.signOut();
		redirect(303, '/dashboard/login');
	}
	/* contatori del menu': calcolati al massimo ogni 20 secondi (sono uguali per tutto lo staff) e tutti in parallelo,
	   cosi' cambiare pagina non aspetta una decina di letture in fila */
	let counts = countsCache.value;
	if (!counts || Date.now() - countsCache.at > 20000) {
		counts = await menuCounts(supabase);
		countsCache.value = counts; countsCache.at = Date.now();
	}
	return { role: profile.role as 'admin' | 'staff', fullName: profile.full_name as string | null, counts, vapid: PUBLIC_VAPID_KEY };
};
