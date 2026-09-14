import { error } from '@sveltejs/kit';
import type { OrderRow } from '$lib/dashboard/orders';
import { PLANNABLE_STATUSES, prioritize, STAGES } from '$lib/dashboard/produzione';
import { ensurePlan, loadTasks, operatorName, taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** Coda del reparto: adesso (in corso), prossime in ordine di priorita', bloccate, in arrivo dalle fasi precedenti */
export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	const stage = STAGES[params.stage];
	if (!stage) error(404, 'Reparto non trovato');
	const { data } = await supabase.from('orders').select('*').in('status', PLANNABLE_STATUSES);
	await ensurePlan(supabase, (data ?? []) as OrderRow[], await operatorName(supabase, user));
	const tasks = (await loadTasks(supabase)).filter((t) => t.stage === params.stage);
	const now = new Date();
	const inProd = tasks.filter((t) => t.order.status === 'in_produzione');
	const planned = prioritize(inProd.filter((t) => t.status !== 'completato' && t.status !== 'da_fare'), now);
	const incoming = prioritize(tasks.filter((t) => t.status === 'da_fare'), now).slice(0, 12);
	const doneToday = inProd.filter((t) => t.status === 'completato' && t.completed_at && t.completed_at.slice(0, 10) === now.toISOString().slice(0, 10)).length;
	return {
		stage: params.stage, label: stage.label, icon: stage.icon, machines: stage.machines, capacity: stage.capacity,
		now: planned.filter((p) => p.task.status === 'in_corso'),
		next: planned.filter((p) => p.task.status === 'pronto'),
		blocked: planned.filter((p) => p.task.status === 'bloccato'),
		incoming, doneToday,
		minutesOpen: planned.reduce((a, p) => a + p.task.minutes, 0)
	};
};

export const actions: Actions = { ...taskActions };
