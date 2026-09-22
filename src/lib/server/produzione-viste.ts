/** Dati aggregati per le pagine di produzione (riepilogo, macchinari, TV): tutto letto dalla stessa fonte. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { dayOf, todayIso } from '$lib/production/calendar';
import { fmtMin } from '$lib/production/format';
import type { Machine, Phase } from '$lib/production/types';
import { loadQueue, loadSetup, recalcIfStale, type QueueRow, type Setup } from './produzione';

export interface MachineView { machine: Machine; state: 'busy' | 'free' | 'off'; current: { row: QueueRow; phase: Phase } | null; next: { row: QueueRow; phase: Phase } | null; loadMinutes: number; loadPct: number; queueCount: number }
export interface Overview { queue: QueueRow[]; setup: Setup; machines: MachineView[]; today: string; kpi: { paidToday: number; startToday: number; running: number; atRisk: number; busyMachines: number; late: number; doneToday: number }; now: string }

export async function loadOverview(db: SupabaseClient): Promise<Overview> {
	await recalcIfStale(db);
	const [setup, queue] = await Promise.all([loadSetup(db), loadQueue(db)]);
	const now = new Date(), today = todayIso(setup.calendar, now);
	const dayMinutes = (() => { const [oh, om] = setup.calendar.open_time.split(':').map(Number), [ch, cm] = setup.calendar.close_time.split(':').map(Number); return ch * 60 + cm - (oh * 60 + om); })();
	const machines: MachineView[] = setup.machines.filter((m) => !m.archived_at).map((m) => {
		const mine: { row: QueueRow; phase: Phase }[] = [];
		for (const row of queue) for (const phase of row.phases) if (phase.machine_id === m.id && phase.status !== 'completato' && phase.status !== 'saltata' && !phase.passive) mine.push({ row, phase });
		const current = mine.find((x) => x.phase.status === 'in_corso') ?? null;
		const upcoming = mine.filter((x) => x.phase.status !== 'in_corso').sort((a, b) => (a.phase.planned_start_at ?? '').localeCompare(b.phase.planned_start_at ?? ''));
		const todayLoad = mine.filter((x) => x.phase.planned_start_at && dayOf(x.phase.planned_start_at, setup.calendar) === today).reduce((s, x) => s + x.phase.minutes, 0);
		return { machine: m, state: !m.is_active ? 'off' : current ? 'busy' : 'free', current, next: upcoming[0] ?? null, loadMinutes: todayLoad, loadPct: Math.min(100, Math.round((todayLoad / Math.max(1, dayMinutes)) * 100)), queueCount: upcoming.length };
	});
	const kpi = {
		paidToday: queue.filter((r) => r.job.paid_at && dayOf(r.job.paid_at, setup.calendar) === today).length + queue.filter((r) => !r.job.paid_at && dayOf(r.job.created_at, setup.calendar) === today).length,
		startToday: queue.filter((r) => r.job.status === 'READY_TO_START' && r.job.latest_start_at && dayOf(r.job.latest_start_at, setup.calendar) <= today).length,
		running: queue.filter((r) => ['IN_PROGRESS', 'WAITING_PASSIVE_TIME'].includes(r.job.status)).length,
		doneToday: await db.from('production_jobs').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED').gte('completed_at', `${today}T00:00:00Z`).then((r) => r.count ?? 0),
		atRisk: queue.filter((r) => r.job.risk_status === 'AT_RISK' || r.job.risk_status === 'TIGHT').length,
		late: queue.filter((r) => r.job.risk_status === 'LATE').length,
		busyMachines: machines.filter((m) => m.state === 'busy').length
	};
	return { queue, setup, machines, today, kpi, now: now.toISOString() };
}
export { fmtMin };
