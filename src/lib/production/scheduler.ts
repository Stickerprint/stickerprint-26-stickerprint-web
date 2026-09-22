/**
 * productionScheduler: pianificazione deterministica delle fasi (niente AI, niente accesso al database).
 *
 *  - a ritroso: dalla data di spedizione promessa si sottraggono tutte le fasi → ultimo avvio utile di ogni fase e della commessa;
 *  - in avanti: da adesso (o dall'avvio/fine reale delle fasi gia' fatte) si prevede quando finira' ogni fase,
 *    scegliendo per ognuna il primo macchinario compatibile libero, senza sovrapporre lavori sulla stessa macchina;
 *  - tempo attivo = orario di lavoro (calendario); tempo passivo (maturazione, asciugatura) = tempo di calendario,
 *    non occupa la macchina;
 *  - margine, ritardo previsto e stato di rischio; ordinamento della coda.
 */
import { addWork, prevWorking, shipDeadline, subWork, workBetween, workingDaysBetween, isoDay, nextWorking } from './calendar';
import { candidates } from './routing';
import type { Calendar, Capability, Machine, PhaseStatus, RiskStatus } from './types';

/** la fase come la vede il pianificatore (sottoinsieme di Phase / RoutedPhase) */
export interface PlanPhase {
	id?: string; seq: number; capability: Capability | null; machine_types: string[]; machine_id: string | null;
	minutes: number; wait_minutes: number; passive: boolean; status: PhaseStatus;
	started_at?: string | null; completed_at?: string | null;
	/** macchina scelta a mano dall'amministratore: il pianificatore non la cambia (altrimenti machine_id e' solo una proposta) */
	machine_locked?: boolean;
}
/** intervallo gia' occupato su una macchina (fasi di ALTRE commesse, pianificate o in corso) */
export interface Busy { machine_id: string; start: Date; end: Date; job_id?: string | null }

/* ---------- a ritroso ---------- */
export interface Backward { latest_start: Date[]; latest_end: Date[]; job_latest_start: Date; deadline: Date }
export function planBackward(phases: PlanPhase[], promisedDay: string, cal: Calendar): Backward {
	const deadline = shipDeadline(promisedDay, cal);
	const n = phases.length, latest_start: Date[] = new Array(n), latest_end: Date[] = new Array(n);
	let cur = prevWorking(deadline, cal);
	for (let k = n - 1; k >= 0; k--) {
		const p = phases[k];
		latest_end[k] = cur;
		// passivo: tempo di calendario (matura anche di notte); attivo: minuti di lavoro
		cur = p.passive ? prevWorking(new Date(cur.getTime() - p.wait_minutes * 60000), cal) : subWork(cur, p.minutes, cal);
		latest_start[k] = cur;
	}
	return { latest_start, latest_end, job_latest_start: latest_start[0] ?? deadline, deadline };
}

/* ---------- in avanti ---------- */
export interface Forward {
	planned_start: Date[]; planned_end: Date[]; machine_id: (string | null)[];
	estimated_packaging_at: Date; slack_minutes: number; predicted_delay_minutes: number; risk: RiskStatus; busy: Busy[];
}
/** primo istante >= from in cui la macchina e' libera per `minutes` di lavoro */
function earliestSlot(machineId: string, from: Date, minutes: number, cal: Calendar, busy: Busy[]): Date {
	let start = nextWorking(from, cal);
	const mine = busy.filter((b) => b.machine_id === machineId).sort((a, b) => a.start.getTime() - b.start.getTime());
	for (let guard = 0; guard < 200; guard++) {
		const end = addWork(start, minutes, cal);
		const clash = mine.find((b) => start < b.end && end > b.start);
		if (!clash) return start;
		start = nextWorking(clash.end, cal);
	}
	return start;
}
/**
 * Previsione dalla situazione attuale. `busy` contiene le occupazioni delle ALTRE commesse; le fasi qui pianificate
 * vengono aggiunte (cosi' chi pianifica un lotto di commesse in fila non le sovrappone).
 */
export function forecastForward(phases: PlanPhase[], promisedDay: string, cal: Calendar, machines: Machine[], busy: Busy[], now = new Date(), jobId: string | null = null, jobDone = false): Forward {
	const deadline = shipDeadline(promisedDay, cal);
	const n = phases.length, planned_start: Date[] = new Array(n), planned_end: Date[] = new Array(n), machine_id: (string | null)[] = new Array(n);
	const out: Busy[] = [...busy];
	let cur = new Date(now);
	for (let k = 0; k < n; k++) {
		const p = phases[k];
		machine_id[k] = p.machine_id;
		if (p.status === 'completato' || p.status === 'saltata') {
			planned_start[k] = p.started_at ? new Date(p.started_at) : cur; planned_end[k] = p.completed_at ? new Date(p.completed_at) : cur;
			if (planned_end[k] > cur) cur = planned_end[k];
			continue;
		}
		if (p.passive) {
			// parte da sola alla fine della fase precedente (o e' gia' partita): tempo di calendario
			const start = p.started_at ? new Date(p.started_at) : cur;
			const end = new Date(start.getTime() + p.wait_minutes * 60000);
			planned_start[k] = start; planned_end[k] = end > now ? end : now;
			cur = nextWorking(planned_end[k], cal);
			continue;
		}
		if (p.status === 'in_corso' && p.started_at) {
			// in lavorazione: finisce quando scade il tempo stimato, non prima di adesso
			const start = new Date(p.started_at);
			const end = addWork(start, p.minutes, cal);
			planned_start[k] = start; planned_end[k] = end > now ? end : nextWorking(now, cal);
			if (p.machine_id) out.push({ machine_id: p.machine_id, start, end: planned_end[k], job_id: jobId });
			cur = planned_end[k];
			continue;
		}
		// da fare: macchina fissata oppure la prima compatibile libera
		let mid = p.machine_id, start: Date;
		const fixed = mid && p.machine_locked ? machines.find((m) => m.id === mid) : null;
		const pool = fixed && fixed.is_active && !fixed.archived_at ? [fixed] : (p.capability ? candidates(machines, p.capability).filter((m) => p.machine_types.length === 0 || p.machine_types.includes(m.machine_type)) : []);
		if (pool.length) {
			let best: { m: Machine; at: Date } | null = null;
			for (const m of pool) { const at = earliestSlot(m.id, cur, p.minutes, cal, out); if (!best || at < best.at || (at.getTime() === best.at.getTime() && (m.id === p.machine_id || (best.m.id !== p.machine_id && m.sort < best.m.sort)))) best = { m, at }; }
			mid = best!.m.id; start = best!.at;
		} else { mid = null; start = nextWorking(cur, cal); }   // postazione (controllo, confezionamento): nessuna macchina da occupare
		const end = addWork(start, p.minutes, cal);
		planned_start[k] = start; planned_end[k] = end; machine_id[k] = mid;
		if (mid) out.push({ machine_id: mid, start, end, job_id: jobId });
		cur = end;
	}
	const estimated = n ? planned_end[n - 1] : cur;
	const slack = workBetween(estimated, deadline, cal);
	const over = estimated > deadline ? Math.max(1, workBetween(deadline, estimated, cal), Math.round((estimated.getTime() - deadline.getTime()) / 60000)) : 0;
	let risk: RiskStatus = 'ON_TRACK';
	if (!jobDone && now > deadline) risk = 'LATE';
	else if (over > 0) risk = 'AT_RISK';
	else if (slack < cal.orange_threshold_minutes) risk = 'TIGHT';
	return { planned_start, planned_end, machine_id, estimated_packaging_at: estimated, slack_minutes: slack, predicted_delay_minutes: over, risk, busy: out };
}

/* ---------- coda ---------- */
export interface QueueItem { risk_status: RiskStatus; latest_start_at: string | Date | null; promised_ship_date: string; paid_at: string | null; created_at?: string }
const RISK_RANK: Record<RiskStatus, number> = { LATE: 0, AT_RISK: 1, TIGHT: 2, ON_TRACK: 3 };
/** ritardi, poi a rischio, poi ultimo avvio utile piu' vicino, poi data promessa, poi data del pagamento */
export function sortQueue<T extends QueueItem>(items: T[]): T[] {
	const ts = (d: string | Date | null | undefined) => (d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER);
	return [...items].sort((a, b) => RISK_RANK[a.risk_status] - RISK_RANK[b.risk_status] || ts(a.latest_start_at) - ts(b.latest_start_at) || a.promised_ship_date.localeCompare(b.promised_ship_date) || ts(a.paid_at ?? a.created_at) - ts(b.paid_at ?? b.created_at));
}

/* ---------- piano giornaliero ---------- */
export interface DaySegment { day: string; start: Date; end: Date; minutes: number }
/** una fase lunga si distribuisce sui giorni lavorativi che attraversa */
export function splitByDays(start: Date, end: Date, cal: Calendar, passive = false): DaySegment[] {
	if (passive) return [{ day: isoDay(start, cal.timezone), start, end, minutes: 0 }];
	return workingDaysBetween(start, end, cal).map((day) => {
		const a = new Date(Math.max(start.getTime(), nextWorking(new Date(`${day}T00:00:00Z`), cal).getTime()));
		const dayEnd = prevWorking(new Date(`${day}T23:59:00Z`), cal);
		const b = new Date(Math.min(end.getTime(), dayEnd.getTime()));
		return { day, start: a, end: b, minutes: workBetween(a, b, cal) };
	}).filter((s) => s.end > s.start);
}
export { shipDeadline };
