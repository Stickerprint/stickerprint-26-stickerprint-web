import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { APPROVAL_STATUSES, OPEN_TASK, PLANNABLE_STATUSES, prioritize, rome, romeDate, STAGE_KEYS, STAGES, todayRome, type Task } from '$lib/dashboard/produzione';
import { ensurePlan, loadTasks, operatorName, proofDeadline, taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** "Produzione di oggi": cosa va spedito oggi, lavorazioni aperte in ordine di priorita', carico dei reparti, anteprime in attesa, problemi */
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', [...PLANNABLE_STATUSES, 'pronto', 'in_spedizione']).order('created_at', { ascending: true });
	const rows = (data ?? []) as OrderRow[];
	await ensurePlan(supabase, rows, await operatorName(supabase, user));
	const tasks = await loadTasks(supabase);
	const now = new Date(), today = todayRome(now);
	const byOrder = new Map<string, Task[]>();
	for (const t of tasks) { if (!byOrder.has(t.order_id)) byOrder.set(t.order_id, []); byOrder.get(t.order_id)!.push(t); }

	// lavorazioni aperte (pronte, in corso, bloccate) in ordine di lavoro
	const open = prioritize(tasks.filter((t) => OPEN_TASK.has(t.status) && t.order.status === 'in_produzione'), now);
	// carico di oggi per reparto: minuti delle lavorazioni aperte o in arrivo con scadenza entro oggi
	const rp = rome(now), endOfToday = romeDate(rp.y, rp.m, rp.d, 23, 59);
	const load: Record<string, { minutes: number; open: number; capacity: number }> = {};
	for (const k of STAGE_KEYS) load[k] = { minutes: 0, open: 0, capacity: STAGES[k].capacity };
	for (const t of tasks) {
		if (t.status === 'completato' || !load[t.stage]) continue;
		if (OPEN_TASK.has(t.status)) load[t.stage].open++;
		if (t.due_at && new Date(t.due_at) <= endOfToday && t.order.status === 'in_produzione') load[t.stage].minutes += t.minutes;
	}
	// commesse da spedire oggi (o gia' in ritardo) non ancora consegnate al corriere
	const shipToday = groupOrders(rows.filter((r) => r.ship_by && r.ship_by <= today && r.status !== 'in_spedizione'));
	// anteprime e file in attesa del cliente
	const approvals = rows.filter((r) => APPROVAL_STATUSES.has(r.status)).map((r) => {
		const ts = byOrder.get(r.id) ?? [];
		const deadline = proofDeadline(r, ts);
		const since = r.status === 'approvazione' ? (r.proof_sent_at ?? r.updated_at) : r.created_at; // da quando aspetta: il cliente dall'invio dell'anteprima, noi dall'ordine
		return { order: r, deadline: deadline?.toISOString() ?? null, overdue: !!deadline && deadline < now, since, waitingCustomer: r.status === 'approvazione' || r.status === 'attesa_file' };
	}).sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'));
	const problems = open.filter((p) => p.task.status === 'bloccato' || p.risk.late);
	const kpi = {
		shipToday: shipToday.length,
		open: open.length,
		atRisk: open.filter((p) => p.risk.colour === 'rosso' || p.risk.colour === 'arancione').length,
		approvals: approvals.length,
		blocked: open.filter((p) => p.task.status === 'bloccato').length
	};
	return { kpi, open, load, shipToday, approvals, problems, now: now.toISOString() };
};

export const actions: Actions = { ...taskActions };
