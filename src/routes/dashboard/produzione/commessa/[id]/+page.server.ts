import { error } from '@sveltejs/kit';
import type { OrderRow } from '$lib/dashboard/orders';
import { approveBy, projectedFinish, riskOf, type Task } from '$lib/dashboard/produzione';
import { ensurePlan, loadEvents, operatorName, taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** Dettaglio commessa: timeline delle lavorazioni, file e anteprima, note, ristampe, cronologia */
export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	const { data: o } = await supabase.from('orders').select('*').eq('id', params.id).maybeSingle();
	if (!o) error(404, 'Commessa non trovata');
	const order = o as OrderRow;
	await ensurePlan(supabase, [order], await operatorName(supabase, user));
	const [{ data: t }, events] = await Promise.all([
		supabase.from('production_tasks').select('*').eq('order_id', order.id).order('seq'),
		loadEvents(supabase, order.id)
	]);
	const tasks = (t ?? []) as Task[];
	const now = new Date();
	const timeline = tasks.map((task) => ({ task, risk: riskOf(task, tasks, order, now) }));
	let file: string | null = null;
	if (order.file_path && !order.file_path.endsWith('/')) {
		const { data: s } = await supabase.storage.from('order-files').createSignedUrl(order.file_path, 3600);
		file = s?.signedUrl ?? null;
	}
	const siblings = order.checkout_group ? ((await supabase.from('orders').select('id, number, product_name, qty, status').eq('checkout_group', order.checkout_group).neq('id', order.id)).data ?? []) : [];
	return {
		order, timeline, events, file, siblings,
		projected: tasks.some((x) => x.status !== 'completato') ? projectedFinish(tasks, now).toISOString() : null,
		approveBy: approveBy(tasks)?.toISOString() ?? null,
		totalMinutes: tasks.reduce((a, x) => a + x.minutes, 0),
		doneMinutes: tasks.filter((x) => x.status === 'completato').reduce((a, x) => a + x.minutes, 0)
	};
};

export const actions: Actions = { ...taskActions };
