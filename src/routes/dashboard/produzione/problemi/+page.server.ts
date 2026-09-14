import type { OrderRow } from '$lib/dashboard/orders';
import { APPROVAL_STATUSES, OPEN_TASK, PLANNABLE_STATUSES, prioritize, type Task } from '$lib/dashboard/produzione';
import { ensurePlan, loadTasks, operatorName, proofDeadline, taskActions } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** Centro problemi: lavorazioni bloccate, in ritardo, approvazioni e file scaduti, spedizioni a rischio */
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const { data } = await supabase.from('orders').select('*').in('status', PLANNABLE_STATUSES);
	const rows = (data ?? []) as OrderRow[];
	await ensurePlan(supabase, rows, await operatorName(supabase, user));
	const tasks = await loadTasks(supabase);
	const now = new Date();
	const byOrder = new Map<string, Task[]>();
	for (const t of tasks) { if (!byOrder.has(t.order_id)) byOrder.set(t.order_id, []); byOrder.get(t.order_id)!.push(t); }
	const open = prioritize(tasks.filter((t) => OPEN_TASK.has(t.status) && t.order.status === 'in_produzione'), now);
	const blocked = open.filter((p) => p.task.status === 'bloccato');
	const late = open.filter((p) => p.risk.late && p.task.status !== 'bloccato');
	const risky = open.filter((p) => !p.risk.late && p.task.status !== 'bloccato' && (p.risk.colour === 'rosso' || p.risk.colour === 'arancione'));
	const approvals = rows.filter((r) => APPROVAL_STATUSES.has(r.status)).map((r) => {
		const deadline = proofDeadline(r, byOrder.get(r.id) ?? []);
		return { order: r, deadline: deadline?.toISOString() ?? null, overdue: !!deadline && deadline < now, since: r.status === 'approvazione' ? (r.proof_sent_at ?? r.updated_at) : r.created_at };
	}).filter((a) => a.overdue || a.order.status === 'attesa_file' || a.order.status === 'modifiche_richieste');
	const missingFile = approvals.filter((a) => a.order.status === 'attesa_file');
	const waiting = approvals.filter((a) => a.order.status !== 'attesa_file');
	return { blocked, late, risky, missingFile, waiting, now: now.toISOString() };
};

export const actions: Actions = { ...taskActions };
