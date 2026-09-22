/**
 * Produzione v2 (solo server): commesse, fasi, macchinari, calendario e cronologia.
 * Le regole stanno nei moduli puri di $lib/production (routing, calendar, scheduler): qui si legge e si scrive il database.
 *
 * Fonte di verita' degli ordini: la tabella `orders` (stato, prod_stage). La commessa (`production_jobs`) e' UNA per
 * ordine (checkout_group): la creazione e' idempotente (vincolo univoco), quindi webhook o conferme ripetute non
 * creano doppioni. La data promessa e' uno snapshot: la produzione non la modifica.
 */
import { fail } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { OrderRow } from '$lib/dashboard/orders';
import { groupOrders } from '$lib/dashboard/orders';
import { defaultPromise, todayIso } from '$lib/production/calendar';
import { areaOf, machineMinutes, routeOrder, routingInputFrom } from '$lib/production/routing';
import { forecastForward, planBackward, sortQueue, type Busy, type PlanPhase } from '$lib/production/scheduler';
import { DEFAULT_CALENDAR, MACHINE_TYPES, type Calendar, type Job, type JobStatus, type Machine, type MachineProfile, type Phase } from '$lib/production/types';

type DB = SupabaseClient;
export interface Setup { machines: Machine[]; profiles: MachineProfile[]; calendar: Calendar }
export interface JobFull { job: Job; group: ReturnType<typeof groupOrders>[number]; phases: Phase[] }

/* ---------- utenti e cronologia ---------- */
export async function operatorName(db: DB, user: User | null): Promise<string | null> {
	if (!user) return null;
	const { data } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
	return (data?.full_name as string | null) || user.email || null;
}
export async function isAdmin(db: DB, user: User | null): Promise<boolean> {
	if (!user) return false;
	const { data } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
	return data?.role === 'admin';
}
export interface EventIn { order_id: string; job_id?: string | null; task_id?: string | null; machine_id?: string | null; kind: string; detail?: string | null; operator?: string | null; from_status?: string | null; to_status?: string | null; est_minutes?: number | null; actual_minutes?: number | null; packaging_eta?: string | null; slack_minutes?: number | null }
export async function logEvent(db: DB, e: EventIn) {
	await db.from('production_events').insert({ order_id: e.order_id, job_id: e.job_id ?? null, task_id: e.task_id ?? null, machine_id: e.machine_id ?? null, kind: e.kind, detail: e.detail ?? null, operator: e.operator ?? null, from_status: e.from_status ?? null, to_status: e.to_status ?? null, est_minutes: e.est_minutes ?? null, actual_minutes: e.actual_minutes ?? null, packaging_eta: e.packaging_eta ?? null, slack_minutes: e.slack_minutes ?? null });
}
export async function loadEvents(db: DB, jobId: string, limit = 100) {
	const { data } = await db.from('production_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(limit);
	return data ?? [];
}

/* ---------- setup ---------- */
/* il setup (macchinari, profili, calendario) cambia di rado: si tiene in memoria 30 s e si azzera a ogni modifica dal Setup */
let setupCache: { at: number; value: Setup } | null = null;
export const invalidateSetup = () => { setupCache = null; };
export async function loadSetup(db: DB): Promise<Setup> {
	if (setupCache && Date.now() - setupCache.at < 30000) return setupCache.value;
	const v = await loadSetupFresh(db);
	setupCache = { at: Date.now(), value: v };
	return v;
}
async function loadSetupFresh(db: DB): Promise<Setup> {
	const [{ data: m }, { data: p }, { data: c }] = await Promise.all([
		db.from('production_machines').select('*').order('sort').order('name'),
		db.from('production_machine_profiles').select('*'),
		db.from('production_calendar').select('*').eq('id', 1).maybeSingle()
	]);
	const calendar: Calendar = c ? { ...DEFAULT_CALENDAR, ...c, open_time: String(c.open_time).slice(0, 5), close_time: String(c.close_time).slice(0, 5), ship_cutoff: String(c.ship_cutoff).slice(0, 5), break_start: c.break_start ? String(c.break_start).slice(0, 5) : null, break_end: c.break_end ? String(c.break_end).slice(0, 5) : null, holidays: (c.holidays ?? []) as string[], closures: (c.closures ?? []) as Calendar['closures'], working_days: (c.working_days ?? [1, 2, 3, 4, 5]) as number[] } : DEFAULT_CALENDAR;
	return { machines: ((m ?? []) as Machine[]).map(numMachine), profiles: ((p ?? []) as MachineProfile[]).map(numProfile), calendar };
}
const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
const numMachine = (m: Machine): Machine => ({ ...m, setup_minutes: num(m.setup_minutes), sqm_per_hour: num(m.sqm_per_hour), minutes_per_sqm: num(m.minutes_per_sqm), pieces_per_hour: num(m.pieces_per_hour), minutes_per_piece: num(m.minutes_per_piece), cleanup_minutes: num(m.cleanup_minutes), passive_minutes: num(m.passive_minutes), waste_coefficient: num(m.waste_coefficient), usable_width_mm: num(m.usable_width_mm), capabilities: m.capabilities ?? [] });
const numProfile = (p: MachineProfile): MachineProfile => ({ ...p, sqm_per_hour: num(p.sqm_per_hour), minutes_per_sqm: num(p.minutes_per_sqm), minutes_per_piece: num(p.minutes_per_piece), setup_minutes: num(p.setup_minutes), coefficient: num(p.coefficient) });

/** i campi del macchinario dal form di Setup → Macchinari */
export function machineFromForm(f: FormData): Partial<Machine> & { code: string; name: string; machine_type: string } {
	const s = (k: string) => String(f.get(k) ?? '').trim();
	const n = (k: string) => (s(k) === '' ? null : Number(s(k).replace(',', '.')));
	const type = s('machine_type') || 'stampante_ecosolvente';
	const caps = f.getAll('capabilities').map(String).filter(Boolean) as Machine['capabilities'];
	return {
		code: s('code').toUpperCase(), name: s('name'), brand: s('brand') || null, model: s('model') || null, machine_type: type,
		department: (s('department') || MACHINE_TYPES[type]?.department || 'stampa') as Machine['department'],
		usable_width_mm: n('usable_width_mm'), is_active: f.get('is_active') === 'on' || f.get('is_active') === 'true',
		setup_minutes: n('setup_minutes'), sqm_per_hour: n('sqm_per_hour'), minutes_per_sqm: n('minutes_per_sqm'), pieces_per_hour: n('pieces_per_hour'), minutes_per_piece: n('minutes_per_piece'),
		cleanup_minutes: n('cleanup_minutes'), passive_minutes: n('passive_minutes'), waste_coefficient: n('waste_coefficient'),
		capabilities: caps.length ? caps : (MACHINE_TYPES[type]?.capabilities ?? []), notes: s('notes') || null, sort: n('sort') ?? 0
	};
}
export async function saveMachine(db: DB, id: string | null, m: ReturnType<typeof machineFromForm>): Promise<{ id: string | null; error?: string }> {
	invalidateSetup();
	if (!m.code || !m.name) return { id: null, error: 'Codice e nome sono obbligatori.' };
	const patch = { ...m, updated_at: new Date().toISOString() };
	if (id) { const { error } = await db.from('production_machines').update(patch).eq('id', id); return { id, error: error?.message }; }
	const { data, error } = await db.from('production_machines').insert(patch).select('id').single();
	return { id: data?.id ?? null, error: error?.code === '23505' ? 'Esiste già un macchinario con questo codice.' : error?.message };
}
/** copia con codice e nome nuovi (i profili di velocita' vengono copiati) */
export async function duplicateMachine(db: DB, id: string): Promise<{ id: string | null; error?: string }> {
	invalidateSetup();
	const { data: m } = await db.from('production_machines').select('*').eq('id', id).maybeSingle();
	if (!m) return { id: null, error: 'Macchinario non trovato.' };
	const { id: _id, created_at: _c, updated_at: _u, archived_at: _a, ...rest } = m;
	let code = `${m.code}-COPIA`, name = `${m.name} (copia)`;
	for (let k = 2; k < 20; k++) { const { data: ex } = await db.from('production_machines').select('id').eq('code', code).maybeSingle(); if (!ex) break; code = `${m.code}-COPIA${k}`; name = `${m.name} (copia ${k})`; }
	const { data, error } = await db.from('production_machines').insert({ ...rest, code, name, is_active: false, sort: (m.sort ?? 0) + 1 }).select('id').single();
	if (error || !data) return { id: null, error: error?.message };
	const { data: prof } = await db.from('production_machine_profiles').select('*').eq('machine_id', id);
	for (const p of prof ?? []) { const { id: _p, created_at: _pc, ...pr } = p; await db.from('production_machine_profiles').insert({ ...pr, machine_id: data.id }); }
	return { id: data.id };
}
/** mai usato in una commessa → eliminato; altrimenti archiviato (le commesse vecchie continuano a mostrarlo) */
export async function removeMachine(db: DB, id: string): Promise<{ archived: boolean; error?: string }> {
	invalidateSetup();
	const { count } = await db.from('production_tasks').select('id', { count: 'exact', head: true }).eq('machine_id', id);
	if (!count) { const { error } = await db.from('production_machines').delete().eq('id', id); return { archived: false, error: error?.message }; }
	const { error } = await db.from('production_machines').update({ archived_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
	return { archived: true, error: error?.message };
}
export async function setMachineActive(db: DB, id: string, on: boolean) {
	invalidateSetup();
	const { error } = await db.from('production_machines').update({ is_active: on, archived_at: on ? null : undefined, updated_at: new Date().toISOString() }).eq('id', id);
	return error?.message ?? null;
}
export async function saveProfile(db: DB, machineId: string, id: string | null, f: FormData) {
	invalidateSetup();
	const s = (k: string) => String(f.get(k) ?? '').trim();
	const n = (k: string) => (s(k) === '' ? null : Number(s(k).replace(',', '.')));
	const row = { machine_id: machineId, name: s('name') || 'Profilo', product_slug: s('product_slug') || null, quality: s('quality') || null, material: s('material') || null, capability: s('capability') || null, sqm_per_hour: n('sqm_per_hour'), minutes_per_sqm: n('minutes_per_sqm'), minutes_per_piece: n('minutes_per_piece'), setup_minutes: n('setup_minutes'), coefficient: n('coefficient'), is_active: f.get('is_active') !== 'off' };
	const { error } = id ? await db.from('production_machine_profiles').update(row).eq('id', id) : await db.from('production_machine_profiles').insert(row);
	return error?.message ?? null;
}
export async function saveCalendar(db: DB, f: FormData) {
	invalidateSetup();
	const s = (k: string) => String(f.get(k) ?? '').trim();
	const days = f.getAll('working_days').map(Number).filter((d) => d >= 1 && d <= 7);
	const holidays = s('holidays').split(/[\n,;]+/).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
	let closures: Calendar['closures'] = [];
	try { closures = JSON.parse(s('closures') || '[]'); } catch { return 'Chiusure non leggibili.'; }
	closures = closures.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.from) && /^\d{4}-\d{2}-\d{2}$/.test(c.to));
	const row = { timezone: s('timezone') || 'Europe/Rome', working_days: days.length ? days : [1, 2, 3, 4, 5], open_time: s('open_time') || '08:30', close_time: s('close_time') || '17:30', break_start: s('break_start') || null, break_end: s('break_end') || null, ship_cutoff: s('ship_cutoff') || '17:00', ship_margin_minutes: Number(s('ship_margin_minutes')) || 60, orange_threshold_minutes: Number(s('orange_threshold_minutes')) || 240, holidays, closures, updated_at: new Date().toISOString() };
	const { error } = await db.from('production_calendar').upsert({ id: 1, ...row });
	return error?.message ?? null;
}

/* ---------- commesse ---------- */
const OPEN_JOB: JobStatus[] = ['READY_TO_START', 'IN_PROGRESS', 'WAITING_PASSIVE_TIME'];
const isOpen = (p: Phase) => p.status !== 'completato' && p.status !== 'saltata';

/** l'ordine e' davvero da produrre: pagato (o manuale senza anticipo in sospeso), in produzione, non annullato */
function producible(o: OrderRow): boolean {
	if (o.status !== 'in_produzione') return false;
	if (['failed', 'refunded', 'cancelled'].includes(String(o.payment_status ?? ''))) return false;
	if (o.channel !== 'manuale' && o.payment_status !== 'paid' && o.payment_status !== 'test') return false;
	return true;
}

/**
 * ensurePlan: per ogni ordine da produrre crea la commessa (una sola, idempotente) e le sue fasi, poi ripianifica.
 * Chiamata dal checkout (pagamento riuscito), dalla conferma d'ordine (anticipo incassato), dal preventivo accettato,
 * da "Inizia produzione" e all'apertura delle pagine di produzione.
 */
export async function ensurePlan(db: DB, rows: OrderRow[], operator: string | null = null): Promise<void> {
	const rowsOk = rows.filter(producible);
	if (!rowsOk.length) return;
	const setup = await loadSetup(db);
	const groups = groupOrders(rowsOk);
	let touched = false;
	for (const g of groups) {
		const f = g.items[0];
		// snapshot della data promessa: quella scritta al cliente (ship_by / delivery_date), altrimenti quella di default del checkout
		const promised = f.ship_by ?? g.delivery_date ?? defaultPromise(g.created_at, g.express, setup.calendar);
		const { data: ins } = await db.from('production_jobs').upsert({ checkout_group: g.key, order_number: g.number, promised_ship_date: promised, paid_at: f.payment_status === 'paid' ? (f.updated_at ?? g.created_at) : null }, { onConflict: 'checkout_group', ignoreDuplicates: true }).select('id');
		const { data: jobRow } = await db.from('production_jobs').select('*').eq('checkout_group', g.key).maybeSingle();
		if (!jobRow) continue;
		const job = jobRow as Job;
		if (job.status === 'CANCELLED') continue;
		if (!f.ship_by) await db.from('orders').update({ ship_by: promised }).eq('checkout_group', g.key);
		const { count } = await db.from('production_tasks').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
		if (count) continue;
		// fasi: percorso per ogni riga dell'ordine (in fila), dal servizio di routing
		const rowsToInsert: Record<string, unknown>[] = [];
		let seq = 0;
		for (const it of g.items) {
			const r = routeOrder(routingInputFrom(it), setup.machines, setup.profiles);
			for (const p of r.phases) rowsToInsert.push({ job_id: job.id, order_id: it.id, seq: ++seq, stage: p.stage, label: p.label, capability: p.capability, machine_type: p.machine_types[0] ?? null, machine_id: p.machine_id, machine: setup.machines.find((m) => m.id === p.machine_id)?.name ?? null, minutes: p.minutes, wait_minutes: p.wait_minutes, passive: p.passive, complexity: p.complexity ?? null, status: 'da_fare' });
		}
		if (rowsToInsert.length) {
			// la prima fase reale e' subito pronta (LOCKED → READY)
			rowsToInsert[0].status = 'pronto';
			const { error } = await db.from('production_tasks').insert(rowsToInsert);
			if (error) { console.error('[produzione] fasi', error.message); continue; }
			await db.from('orders').update({ prod_stage: rowsToInsert[0].stage }).eq('checkout_group', g.key);
		} else {
			// nessuna lavorazione (es. campioni): l'ordine va direttamente in spedizione
			await db.from('production_jobs').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', job.id);
			await db.from('orders').update({ prod_stage: null, status: 'in_spedizione' }).eq('checkout_group', g.key).eq('status', 'in_produzione');
		}
		await logEvent(db, { order_id: f.id, job_id: job.id, kind: 'pianificata', detail: `${rowsToInsert.length} fasi, spedizione promessa ${promised}${ins?.length ? '' : ' (commessa già esistente)'}`, operator, to_status: 'READY_TO_START' });
		touched = true;
	}
	if (touched) await recalcAll(db);
}

/** commessa completa (per id commessa, gruppo o id di una riga d'ordine) */
export async function loadJob(db: DB, key: string): Promise<JobFull | null> {
	let { data: j } = await db.from('production_jobs').select('*').eq('id', key).maybeSingle();
	if (!j) ({ data: j } = await db.from('production_jobs').select('*').eq('checkout_group', key).maybeSingle());
	if (!j) { const { data: o } = await db.from('orders').select('checkout_group, id').eq('id', key).maybeSingle(); if (o) ({ data: j } = await db.from('production_jobs').select('*').eq('checkout_group', o.checkout_group ?? o.id).maybeSingle()); }
	if (!j) return null;
	const [{ data: orders }, { data: phases }] = await Promise.all([db.from('orders').select('*').eq('checkout_group', j.checkout_group), db.from('production_tasks').select('*').eq('job_id', j.id).order('seq')]);
	let rows = (orders ?? []) as OrderRow[];
	if (!rows.length) { const { data: one } = await db.from('orders').select('*').eq('id', j.checkout_group); rows = (one ?? []) as OrderRow[]; }
	if (!rows.length) return null;
	return { job: j as Job, group: groupOrders(rows)[0], phases: (phases ?? []) as Phase[] };
}
export async function loadOpenJobs(db: DB): Promise<JobFull[]> {
	const { data: jobs } = await db.from('production_jobs').select('*').in('status', OPEN_JOB);
	if (!jobs?.length) return [];
	const keys = jobs.map((j) => j.checkout_group);
	const [{ data: orders }, { data: phases }] = await Promise.all([db.from('orders').select('*').in('checkout_group', keys), db.from('production_tasks').select('*').in('job_id', jobs.map((j) => j.id)).order('seq')]);
	const byGroup = new Map<string, OrderRow[]>();
	for (const o of (orders ?? []) as OrderRow[]) { const k = o.checkout_group ?? o.id; if (!byGroup.has(k)) byGroup.set(k, []); byGroup.get(k)!.push(o); }
	return (jobs as Job[]).map((job) => { const rows = byGroup.get(job.checkout_group); return rows?.length ? { job, group: groupOrders(rows)[0], phases: ((phases ?? []) as Phase[]).filter((p) => p.job_id === job.id) } : null; }).filter((x): x is JobFull => !!x);
}

/* ---------- pianificazione ---------- */
const toPlan = (p: Phase): PlanPhase => ({ id: p.id, seq: p.seq, capability: p.capability, machine_types: p.machine_type ? [p.machine_type] : [], machine_id: p.machine_id, minutes: p.minutes, wait_minutes: p.wait_minutes, passive: p.passive, status: p.status, started_at: p.started_at, completed_at: p.completed_at, machine_locked: p.machine_locked });
function jobStatusOf(phases: Phase[], cur: JobStatus): JobStatus {
	if (cur === 'CANCELLED') return cur;
	if (!phases.length) return 'COMPLETED';   // niente lavorazioni (campioni): passa subito in spedizione
	if (phases.every((p) => !isOpen(p))) return 'COMPLETED';
	if (phases.some((p) => p.status === 'in_corso')) return 'IN_PROGRESS';
	if (phases.some((p) => p.status === 'in_attesa')) return 'WAITING_PASSIVE_TIME';
	if (!phases.some((p) => p.started_at || p.status === 'completato')) return 'READY_TO_START';
	return 'IN_PROGRESS';
}
/** i tempi passivi scaduti si chiudono da soli e sbloccano la fase dopo */
async function settlePassive(db: DB, phases: Phase[], now: Date, operator: string | null = null) {
	for (let k = 0; k < phases.length; k++) {
		const p = phases[k];
		if (p.status !== 'in_attesa' || !p.started_at) continue;
		if (new Date(p.started_at).getTime() + p.wait_minutes * 60000 > now.getTime()) continue;
		await db.from('production_tasks').update({ status: 'completato', completed_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', p.id);
		p.status = 'completato'; p.completed_at = now.toISOString();
		await logEvent(db, { order_id: p.order_id, job_id: p.job_id, task_id: p.id, kind: 'completata', detail: `${p.label} (tempo passivo trascorso)`, operator, from_status: 'in_attesa', to_status: 'completato' });
		const next = phases[k + 1];
		if (next && next.status === 'da_fare') { await db.from('production_tasks').update({ status: 'pronto', updated_at: now.toISOString() }).eq('id', next.id); next.status = 'pronto'; }
	}
}
/**
 * Ripianifica TUTTE le commesse aperte in ordine di priorita', condividendo le macchine: ogni commessa vede
 * come occupate le fasi di quelle prima di lei. Aggiorna fasi e campi calcolati delle commesse.
 */
export async function recalcAll(db: DB, now = new Date()): Promise<void> {
	const [setup, jobs] = await Promise.all([loadSetup(db), loadOpenJobs(db)]);
	// prima passata: date a ritroso e chiusura dei tempi passivi scaduti
	for (const jf of jobs) await settlePassive(db, jf.phases, now);
	const ranked = sortQueue(jobs.map((jf) => ({ ...jf, risk_status: jf.job.risk_status, latest_start_at: jf.job.latest_start_at, promised_ship_date: jf.job.promised_ship_date, paid_at: jf.job.paid_at, created_at: jf.job.created_at })));
	let busy: Busy[] = [];
	const phasePatch: Record<string, unknown>[] = [], jobPatch: Record<string, unknown>[] = [], afterDone: JobFull[] = [];
	const near = (a: string | null, b: string | null) => !!a && !!b && Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60000;   // sotto il minuto non si riscrive
	for (const jf of ranked) {
		/* le durate seguono i parametri ATTUALI dei macchinari (cambiare una velocita' ricalcola le stime);
		   le durate corrette a mano e le fasi gia' avviate non si toccano */
		const newMinutes = new Map<string, number>();
		for (const p of jf.phases) {
			if (!isOpen(p) || p.passive || p.manual_minutes || p.status === 'in_corso' || !p.capability || !p.machine_id) continue;
			const m = setup.machines.find((x) => x.id === p.machine_id); const it = jf.group.items.find((i) => i.id === p.order_id);
			if (!m || !it) continue;
			const inp = { ...routingInputFrom(it), complexity: (p.complexity as 'semplice' | 'standard' | 'complesso' | null) ?? null };
			const est = machineMinutes(m, p.capability, areaOf(inp), inp, setup.profiles);
			if (est != null && est !== p.minutes) { newMinutes.set(p.id, est); p.minutes = est; }
		}
		const plan = jf.phases.map(toPlan);
		const back = planBackward(plan, jf.job.promised_ship_date, setup.calendar);
		const fwd = forecastForward(plan, jf.job.promised_ship_date, setup.calendar, setup.machines, busy, now, jf.job.id, false);
		busy = fwd.busy;
		for (let k = 0; k < jf.phases.length; k++) {
			const p = jf.phases[k];
			const mid = isOpen(p) && !p.machine_locked && p.status !== 'in_corso' ? fwd.machine_id[k] : p.machine_id;
			const patch = { id: p.id, latest_start_at: back.latest_start[k].toISOString(), due_at: back.latest_end[k].toISOString(), planned_start_at: fwd.planned_start[k].toISOString(), planned_end_at: fwd.planned_end[k].toISOString(), machine_id: mid, machine: setup.machines.find((m) => m.id === mid)?.name ?? p.machine, minutes: newMinutes.get(p.id) ?? null };
			if (!near(patch.latest_start_at, p.latest_start_at) || !near(patch.planned_start_at, p.planned_start_at) || !near(patch.planned_end_at, p.planned_end_at) || mid !== p.machine_id || patch.minutes != null) phasePatch.push(patch);
		}
		const status = jobStatusOf(jf.phases, jf.job.status);
		const total = jf.phases.filter(isOpen).reduce((s, p) => s + p.minutes, 0);
		const risk = status === 'COMPLETED' ? 'ON_TRACK' : fwd.risk;
		const eta = fwd.estimated_packaging_at.toISOString(), latest = back.job_latest_start.toISOString();
		if (status !== jf.job.status || risk !== jf.job.risk_status || total !== jf.job.total_minutes || fwd.slack_minutes !== jf.job.slack_minutes || fwd.predicted_delay_minutes !== jf.job.predicted_delay_minutes || !near(eta, jf.job.estimated_packaging_at) || !near(latest, jf.job.latest_start_at)) {
			jobPatch.push({ id: jf.job.id, latest_start_at: latest, estimated_packaging_at: eta, total_minutes: total, slack_minutes: fwd.slack_minutes, predicted_delay_minutes: fwd.predicted_delay_minutes, risk_status: risk, status, completed_at: status === 'COMPLETED' ? now.toISOString() : null });
		}
		if (status === 'COMPLETED' && jf.job.status !== 'COMPLETED') afterDone.push(jf);
	}
	// due scritture in blocco invece di una per fase e una per commessa
	if (phasePatch.length || jobPatch.length) {
		const { error } = await db.rpc('production_apply_plan', { phases: phasePatch, jobs: jobPatch });
		if (error) {
			// funzione non ancora presente (migrazione 0048 non applicata): scritture una per una
			for (const p of phasePatch) { const { id, minutes, ...rest } = p; await db.from('production_tasks').update(minutes == null ? rest : { ...rest, minutes }).eq('id', id); }
			for (const j of jobPatch) { const { id, completed_at, ...rest } = j; await db.from('production_jobs').update(completed_at ? { ...rest, completed_at } : rest).eq('id', id); }
		}
	}
	for (const jf of afterDone) {
		await db.from('orders').update({ prod_stage: null, status: 'in_spedizione' }).eq('checkout_group', jf.job.checkout_group).eq('status', 'in_produzione');
		await logEvent(db, { order_id: jf.group.items[0].id, job_id: jf.job.id, kind: 'completata', detail: 'Ultima lavorazione finita: l’ordine è in Spedizioni', from_status: jf.job.status, to_status: 'COMPLETED' });
	}
}
let lastRecalc = 0;
/** ricalcolo all'apertura delle pagine, al massimo una volta al minuto */
export async function recalcIfStale(db: DB) { if (Date.now() - lastRecalc > 60000) { lastRecalc = Date.now(); await recalcAll(db); } }

/* ---------- azioni sulle fasi (transazionali: ogni update e' condizionato allo stato di partenza → niente doppi click) ---------- */
async function phaseAndJob(db: DB, phaseId: string): Promise<JobFull & { phase: Phase } | null> {
	const { data: p } = await db.from('production_tasks').select('*').eq('id', phaseId).maybeSingle();
	if (!p?.job_id) return null;
	const jf = await loadJob(db, p.job_id);
	return jf ? { ...jf, phase: p as Phase } : null;
}
const nowIso = () => new Date().toISOString();
async function afterAction(db: DB, jf: JobFull, kind: string, phase: Phase | null, operator: string | null, extra: Partial<EventIn> = {}) {
	await recalcAll(db);
	const { data: j } = await db.from('production_jobs').select('estimated_packaging_at, slack_minutes').eq('id', jf.job.id).maybeSingle();
	await logEvent(db, { order_id: phase?.order_id ?? jf.group.items[0].id, job_id: jf.job.id, task_id: phase?.id ?? null, machine_id: phase?.machine_id ?? null, kind, operator, packaging_eta: j?.estimated_packaging_at ?? null, slack_minutes: j?.slack_minutes ?? null, ...extra });
}
/** "Avvia produzione": la commessa parte con la sua prima fase pronta */
export async function startJob(db: DB, jobId: string, operator: string | null): Promise<string | null> {
	const jf = await loadJob(db, jobId);
	if (!jf) return 'Commessa non trovata.';
	if (jf.job.status === 'CANCELLED') return 'La commessa è annullata.';
	const first = jf.phases.find((p) => p.status === 'pronto');
	if (!first) return jf.phases.some((p) => p.status === 'in_corso') ? 'La commessa è già in corso.' : 'Nessuna fase pronta da avviare.';
	return startPhase(db, first.id, operator);
}
export async function startPhase(db: DB, phaseId: string, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	if (c.phase.status !== 'pronto' && c.phase.status !== 'bloccato') return 'La fase non è pronta.';
	if (c.phase.machine_id) { const m = await db.from('production_machines').select('is_active, archived_at').eq('id', c.phase.machine_id).maybeSingle(); if (m.data && (!m.data.is_active || m.data.archived_at)) return 'Il macchinario assegnato è disattivato: cambia macchinario prima di avviare.'; }
	const { data: upd } = await db.from('production_tasks').update({ status: 'in_corso', started_at: c.phase.started_at ?? nowIso(), operator, block_reason: null, updated_at: nowIso() }).eq('id', phaseId).in('status', ['pronto', 'bloccato']).select('id');
	if (!upd?.length) return 'La fase è già stata avviata.';
	await Promise.all([
		db.from('orders').update({ prod_stage: c.phase.stage, status: 'in_produzione' }).eq('id', c.phase.order_id),
		c.job.started_at ? Promise.resolve() : db.from('production_jobs').update({ started_at: nowIso() }).eq('id', c.job.id)
	]);
	await afterAction(db, c, 'iniziata', c.phase, operator, { detail: c.phase.label, from_status: c.phase.status, to_status: 'in_corso', est_minutes: c.phase.minutes });
	return null;
}
/** Termina fase: registra l'ora reale, sblocca la successiva (o fa partire il tempo passivo) e ricalcola */
export async function completePhase(db: DB, phaseId: string, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	if (c.phase.status !== 'in_corso' && c.phase.status !== 'pronto') return 'La fase non è in corso.';
	const now = new Date();
	const started = c.phase.started_at ? new Date(c.phase.started_at) : now;
	const { data: upd } = await db.from('production_tasks').update({ status: 'completato', completed_at: now.toISOString(), started_at: started.toISOString(), operator: c.phase.operator ?? operator, updated_at: now.toISOString() }).eq('id', phaseId).in('status', ['in_corso', 'pronto']).select('id');
	if (!upd?.length) return 'La fase è già stata chiusa.';
	const next = c.phases.filter((p) => p.seq > c.phase.seq && isOpen(p)).sort((a, b) => a.seq - b.seq)[0];
	if (next) {
		if (next.passive) {
			await db.from('production_tasks').update({ status: 'in_attesa', started_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', next.id);
			// se il tempo passivo e' gia' trascorso (durata 0) la fase dopo e' subito pronta: se ne occupa il ricalcolo
		} else await db.from('production_tasks').update({ status: 'pronto', updated_at: now.toISOString() }).eq('id', next.id);
		await db.from('orders').update({ prod_stage: next.stage }).eq('id', next.order_id);
	}
	await afterAction(db, c, 'completata', c.phase, operator, { detail: c.phase.label, from_status: c.phase.status, to_status: 'completato', est_minutes: c.phase.minutes, actual_minutes: Math.round((now.getTime() - started.getTime()) / 60000) });
	return null;
}
export async function blockPhase(db: DB, phaseId: string, reason: string, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	if (!reason.trim()) return 'Scrivi il motivo del blocco.';
	await db.from('production_tasks').update({ status: 'bloccato', block_reason: reason.trim(), updated_at: nowIso() }).eq('id', phaseId).in('status', ['pronto', 'in_corso']);
	await afterAction(db, c, 'bloccata', c.phase, operator, { detail: `${c.phase.label}: ${reason.trim()}`, from_status: c.phase.status, to_status: 'bloccato' });
	return null;
}
export async function unblockPhase(db: DB, phaseId: string, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	await db.from('production_tasks').update({ status: c.phase.started_at ? 'in_corso' : 'pronto', block_reason: null, updated_at: nowIso() }).eq('id', phaseId).eq('status', 'bloccato');
	await afterAction(db, c, 'sbloccata', c.phase, operator, { detail: c.phase.label, from_status: 'bloccato', to_status: c.phase.started_at ? 'in_corso' : 'pronto' });
	return null;
}
/** Modifica stima: durata a mano (il ricalcolo non la tocca) */
export async function setEstimate(db: DB, phaseId: string, minutes: number, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	if (!(minutes >= 0) || minutes > 24 * 60 * 30) return 'Durata non valida.';
	const field = c.phase.passive ? { wait_minutes: Math.round(minutes) } : { minutes: Math.round(minutes) };
	await db.from('production_tasks').update({ ...field, manual_minutes: true, updated_at: nowIso() }).eq('id', phaseId);
	await afterAction(db, c, 'stima', c.phase, operator, { detail: `${c.phase.label}: da ${c.phase.passive ? c.phase.wait_minutes : c.phase.minutes} a ${Math.round(minutes)} min`, est_minutes: Math.round(minutes) });
	return null;
}
/** Cambia macchinario: solo tra quelli compatibili e usabili; la scelta resta fissa */
export async function setMachine(db: DB, phaseId: string, machineId: string, operator: string | null): Promise<string | null> {
	const c = await phaseAndJob(db, phaseId);
	if (!c) return 'Fase non trovata.';
	const { machines } = await loadSetup(db);
	const m = machines.find((x) => x.id === machineId);
	if (!m) return 'Macchinario non trovato.';
	if (!m.is_active || m.archived_at) return 'Il macchinario è disattivato o archiviato.';
	if (c.phase.capability && !m.capabilities.includes(c.phase.capability)) return `${m.name} non può fare "${c.phase.label}".`;
	await db.from('production_tasks').update({ machine_id: m.id, machine: m.name, machine_locked: true, updated_at: nowIso() }).eq('id', phaseId);
	await afterAction(db, c, 'macchina', { ...c.phase, machine_id: m.id }, operator, { detail: `${c.phase.label} → ${m.name}` });
	return null;
}
/** Annulla commessa (solo amministratore): le fasi aperte si chiudono come saltate, l'ordine risulta annullato */
export async function cancelJob(db: DB, jobId: string, reason: string, operator: string | null): Promise<string | null> {
	const jf = await loadJob(db, jobId);
	if (!jf) return 'Commessa non trovata.';
	if (jf.job.status === 'CANCELLED') return 'Già annullata.';
	const { data: upd } = await db.from('production_jobs').update({ status: 'CANCELLED', cancelled_at: nowIso(), cancel_reason: reason.trim() || null, risk_status: 'ON_TRACK', updated_at: nowIso() }).eq('id', jobId).neq('status', 'CANCELLED').select('id');
	if (!upd?.length) return 'Già annullata.';
	await db.from('production_tasks').update({ status: 'saltata', updated_at: nowIso() }).eq('job_id', jobId).in('status', ['da_fare', 'pronto', 'in_corso', 'bloccato', 'in_attesa']);
	await db.from('orders').update({ status: 'annullato', prod_stage: null }).eq('checkout_group', jf.job.checkout_group);
	await logEvent(db, { order_id: jf.group.items[0].id, job_id: jf.job.id, kind: 'annullata', detail: reason.trim() || null, operator, from_status: jf.job.status, to_status: 'CANCELLED' });
	await recalcAll(db);
	return null;
}
export async function addNote(db: DB, jobId: string, text: string, operator: string | null): Promise<string | null> {
	const jf = await loadJob(db, jobId);
	if (!jf) return 'Commessa non trovata.';
	if (!text.trim()) return 'Nota vuota.';
	await logEvent(db, { order_id: jf.group.items[0].id, job_id: jf.job.id, kind: 'nota', detail: text.trim(), operator });
	return null;
}

/** azioni condivise da tutte le pagine di produzione (?/avvia, ?/inizia, ?/completa, ?/stima, ?/macchina, ?/annulla, ...) */
export const taskActions = {
	avvia: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => startJob(db, String((await request.formData()).get('job')), op)),
	inizia: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => startPhase(db, String((await request.formData()).get('task')), op)),
	completa: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => completePhase(db, String((await request.formData()).get('task')), op)),
	blocca: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return blockPhase(db, String(f.get('task')), String(f.get('motivo') ?? ''), op); }),
	sblocca: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => unblockPhase(db, String((await request.formData()).get('task')), op)),
	stima: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return setEstimate(db, String(f.get('task')), Number(f.get('minuti')), op); }, true),
	macchina: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return setMachine(db, String(f.get('task')), String(f.get('machine') ?? ''), op); }, true),
	annulla: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return cancelJob(db, String(f.get('job')), String(f.get('motivo') ?? ''), op); }, true),
	nota: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return addNote(db, String(f.get('job')), String(f.get('testo') ?? ''), op); })
};
async function run(locals: App.Locals, fn: (db: DB, op: string | null) => Promise<string | null>, adminOnly = false) {
	if (adminOnly && !(await isAdmin(locals.supabase, locals.user))) return fail(403, { error: 'Questa azione è riservata all’amministratore.' });
	const op = await operatorName(locals.supabase, locals.user);
	const err = await fn(locals.supabase, op);
	if (err) return fail(400, { error: err });
	return { ok: true };
}

/* ---------- viste ---------- */
export interface QueueRow { job: Job; group: JobFull['group']; phases: Phase[]; next: Phase | null; current: Phase | null; laminated: boolean; protection: string; machines: string[] }
export async function loadQueue(db: DB): Promise<QueueRow[]> {
	const { machines } = await loadSetup(db);
	const jobs = await loadOpenJobs(db);
	const rows = jobs.map((jf) => {
		const f = jf.group.items[0];
		const inp = routingInputFrom(f);
		const used = [...new Set(jf.phases.map((p) => p.machine_id).filter(Boolean))].map((id) => machines.find((m) => m.id === id)?.name ?? '').filter(Boolean);
		return { ...jf, next: jf.phases.find((p) => p.status === 'pronto') ?? jf.phases.find(isOpen) ?? null, current: jf.phases.find((p) => p.status === 'in_corso' || p.status === 'in_attesa') ?? null, laminated: inp.laminated, protection: inp.protection ?? 'nessuna', machines: used };
	});
	return sortQueue(rows.map((r) => ({ ...r, risk_status: r.job.risk_status, latest_start_at: r.job.latest_start_at, promised_ship_date: r.job.promised_ship_date, paid_at: r.job.paid_at, created_at: r.job.created_at })));
}
/** commesse completate (per la coda con filtro "completati") */
export async function loadCompletedJobs(db: DB, limit = 100): Promise<JobFull[]> {
	const { data: jobs } = await db.from('production_jobs').select('*').in('status', ['COMPLETED', 'CANCELLED']).order('completed_at', { ascending: false, nullsFirst: false }).limit(limit);
	if (!jobs?.length) return [];
	const { data: orders } = await db.from('orders').select('*').in('checkout_group', jobs.map((j) => j.checkout_group));
	const byGroup = new Map<string, OrderRow[]>();
	for (const o of (orders ?? []) as OrderRow[]) { const k = o.checkout_group ?? o.id; if (!byGroup.has(k)) byGroup.set(k, []); byGroup.get(k)!.push(o); }
	return (jobs as Job[]).map((job) => { const rows = byGroup.get(job.checkout_group); return rows?.length ? { job, group: groupOrders(rows)[0], phases: [] as Phase[] } : null; }).filter((x): x is JobFull => !!x);
}
export { todayIso };
