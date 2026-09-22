import { error } from '@sveltejs/kit';
import { isAdmin, loadEvents, loadJob, loadSetup, recalcIfStale, taskActions } from '$lib/server/produzione';
import { splitByDays } from '$lib/production/scheduler';
import type { Actions, PageServerLoad } from './$types';

/** Dettaglio commessa: fasi con macchine e orari, piano per giorno, file e anteprima, cronologia */
export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	await recalcIfStale(supabase);
	const jf = await loadJob(supabase, params.id);
	if (!jf) error(404, 'Commessa non trovata');
	const [setup, events, admin] = await Promise.all([loadSetup(supabase), loadEvents(supabase, jf.job.id), isAdmin(supabase, user)]);
	// file del cliente: link firmati (1 ora)
	const files: Record<string, string> = {};
	for (const it of jf.group.items) {
		if (it.file_path && !it.file_path.endsWith('/')) { const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.file_path, 3600); if (s) files[it.id] = s.signedUrl; }
		if (it.proof_url && !/^https?:\/\//.test(it.proof_url)) { const { data: s } = await supabase.storage.from('order-files').createSignedUrl(it.proof_url, 3600); it.proof_url = s?.signedUrl ?? null; }
	}
	// piano giornaliero: ogni fase spalmata sui giorni che attraversa
	const days: Record<string, { phase: typeof jf.phases[number]; start: string; end: string; minutes: number }[]> = {};
	for (const p of jf.phases) {
		if (!p.planned_start_at || !p.planned_end_at || p.status === 'completato' || p.status === 'saltata') continue;
		for (const s of splitByDays(new Date(p.planned_start_at), new Date(p.planned_end_at), setup.calendar, p.passive)) { (days[s.day] ??= []).push({ phase: p, start: s.start.toISOString(), end: s.end.toISOString(), minutes: s.minutes }); }
	}
	return { ...jf, setup, events, admin, files, days, now: new Date().toISOString() };
};
export const actions: Actions = { ...taskActions };
