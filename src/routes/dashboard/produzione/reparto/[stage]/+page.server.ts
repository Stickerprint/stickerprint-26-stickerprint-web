import { error } from '@sveltejs/kit';
import { DEPARTMENTS, type Department, type Phase } from '$lib/production/types';
import { loadQueue, loadSetup, recalcIfStale, taskActions, type QueueRow } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** Vista reparto: in cima la fase con l'ultimo avvio utile piu' vicino; poi in corso, pronte, bloccate, in arrivo */
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const stage = params.stage as Department;
	if (!DEPARTMENTS[stage]) error(404, 'Reparto non trovato');
	await recalcIfStale(supabase);
	const [setup, queue] = await Promise.all([loadSetup(supabase), loadQueue(supabase)]);
	const items: { row: QueueRow; phase: Phase }[] = [];
	for (const row of queue) for (const phase of row.phases) if (phase.stage === stage && !phase.passive && phase.status !== 'completato' && phase.status !== 'saltata') items.push({ row, phase });
	const byLatest = (a: { phase: Phase }, b: { phase: Phase }) => (a.phase.latest_start_at ?? '9').localeCompare(b.phase.latest_start_at ?? '9');
	return {
		stage, info: DEPARTMENTS[stage], setup, now: new Date().toISOString(),
		running: items.filter((x) => x.phase.status === 'in_corso').sort(byLatest),
		ready: items.filter((x) => x.phase.status === 'pronto').sort(byLatest),
		blocked: items.filter((x) => x.phase.status === 'bloccato').sort(byLatest),
		incoming: items.filter((x) => x.phase.status === 'da_fare').sort(byLatest).slice(0, 12),
		waiting: queue.flatMap((row) => row.phases.filter((p) => p.stage === stage && p.passive && p.status === 'in_attesa').map((phase) => ({ row, phase })))
	};
};
export const actions: Actions = { ...taskActions };
