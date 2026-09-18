/**
 * Produzione a lavorazioni (condiviso tra server e browser).
 *
 * Logica: ogni riga d'ordine e' una commessa con una coda di lavorazioni (percorso per prodotto).
 * Le scadenze si calcolano a ritroso dalla data di spedizione promessa: il corriere ritira alle 17:00,
 * si tiene un'ora di margine, e ogni fase deve finire prima che inizi la successiva.
 * Orario di lavoro: lunedi-venerdi 8:30-17:30 (Europe/Rome). La maturazione della resina e' tempo di calendario.
 */
import type { OrderRow } from './orders';

export type TaskStatus = 'da_fare' | 'pronto' | 'in_corso' | 'bloccato' | 'completato';
export interface Task {
	id: string; order_id: string; seq: number; stage: string; label: string; machine: string | null;
	minutes: number; wait_minutes: number; status: TaskStatus; due_at: string | null;
	started_at: string | null; completed_at: string | null; operator: string | null; block_reason: string | null; notes: string | null;
	created_at: string; updated_at: string;
}
export interface TaskWithOrder extends Task { order: OrderRow }
export interface ProdEvent { id: number; order_id: string; task_id: string | null; kind: string; detail: string | null; operator: string | null; created_at: string }

export const TASK_STATUS: Record<TaskStatus, string> = { da_fare: 'In arrivo', pronto: 'Pronta', in_corso: 'In corso', bloccato: 'Bloccata', completato: 'Completata' };
export const OPEN_TASK = new Set<TaskStatus>(['pronto', 'in_corso', 'bloccato']);
/** stati dell'ordine in cui la commessa aspetta il cliente (file o approvazione dell'anteprima) */
export const APPROVAL_STATUSES = new Set(['in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione']);
/* dal 18/09/2026 non ci sono piu' prove da approvare: si pianifica solo cio' che e' in produzione */
export const PLANNABLE_STATUSES = ['in_produzione'];

/** Reparti: capacita' in minuti al giorno (420 = 7 ore per macchina o persona) e macchine disponibili */
export const STAGES: Record<string, { label: string; icon: string; capacity: number; machines: string[] }> = {
	stampa: { label: 'Stampa', icon: '🖨️', capacity: 840, machines: ['Roland SG3-300 #1', 'Roland SG3-300 #2', 'Roland LG-300'] },
	plastifica: { label: 'Plastifica', icon: '🧴', capacity: 420, machines: ['Plastificatrice'] },
	taglio: { label: 'Taglio', icon: '✂️', capacity: 840, machines: ['Graphtec', 'Summa'] },
	resinatura: { label: 'Resinatura', icon: '💧', capacity: 420, machines: ['Banco resina'] },
	confezionamento: { label: 'Confezionamento', icon: '📦', capacity: 420, machines: ['Banco imballaggio'] }
};
export const STAGE_KEYS = Object.keys(STAGES);
export const ALL_MACHINES = STAGE_KEYS.flatMap((k) => STAGES[k].machines);

/* ---------- calendario di lavoro (Europe/Rome) ---------- */
export const TZ = 'Europe/Rome';
export const WORK_START = 8 * 60 + 30;
export const WORK_END = 17 * 60 + 30;
export const PICKUP_MIN = 17 * 60; // ritiro del corriere
export const MARGIN_MIN = 60; // margine prima del ritiro
export const CRITICAL_MIN = 4 * 60; // sotto 4 ore di margine = percorso critico

const fmtParts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export interface RomeParts { y: number; m: number; d: number; h: number; min: number; wd: number }
/** componenti di data/ora in Italia */
export function rome(d: Date): RomeParts {
	const p: Record<string, string> = {};
	for (const x of fmtParts.formatToParts(d)) p[x.type] = x.value;
	return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WD.indexOf(p.weekday) };
}
/** Date da ora locale italiana (gestisce ora legale e giorni fuori range, es. d = 0 → mese precedente) */
export function romeDate(y: number, m: number, d: number, h = 0, min = 0): Date {
	const guess = new Date(Date.UTC(y, m - 1, d, h, min));
	const p = rome(guess);
	const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess.getTime();
	return new Date(guess.getTime() - offset);
}
export const isoDay = (d: Date) => { const p = rome(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
export const todayRome = (now = new Date()) => isoDay(now);
const parseDay = (s: string) => s.split('-').map(Number) as [number, number, number];
const isWeekend = (wd: number) => wd === 0 || wd === 6;

function nextWorkStart(from: Date): Date {
	let p = rome(from);
	let cur = romeDate(p.y, p.m, p.d + 1, WORK_START / 60 | 0, WORK_START % 60);
	for (let i = 0; i < 10; i++) { p = rome(cur); if (!isWeekend(p.wd)) break; cur = romeDate(p.y, p.m, p.d + 1, WORK_START / 60 | 0, WORK_START % 60); }
	return cur;
}
function prevWorkEnd(from: Date): Date {
	let p = rome(from);
	let cur = romeDate(p.y, p.m, p.d - 1, WORK_END / 60 | 0, WORK_END % 60);
	for (let i = 0; i < 10; i++) { p = rome(cur); if (!isWeekend(p.wd)) break; cur = romeDate(p.y, p.m, p.d - 1, WORK_END / 60 | 0, WORK_END % 60); }
	return cur;
}
/** aggiunge minuti di lavoro (salta notti e fine settimana) */
export function addWork(from: Date, minutes: number): Date {
	let cur = new Date(from);
	for (let i = 0; minutes > 0 && i < 400; i++) {
		const p = rome(cur), mod = p.h * 60 + p.min;
		if (isWeekend(p.wd) || mod >= WORK_END) { cur = nextWorkStart(cur); continue; }
		if (mod < WORK_START) { cur = romeDate(p.y, p.m, p.d, WORK_START / 60 | 0, WORK_START % 60); continue; }
		const take = Math.min(WORK_END - mod, minutes);
		cur = new Date(cur.getTime() + take * 60000);
		minutes -= take;
	}
	return cur;
}
/** toglie minuti di lavoro (a ritroso) */
export function subWork(from: Date, minutes: number): Date {
	let cur = new Date(from);
	for (let i = 0; minutes > 0 && i < 400; i++) {
		const p = rome(cur), mod = p.h * 60 + p.min;
		if (isWeekend(p.wd) || mod <= WORK_START) { cur = prevWorkEnd(cur); continue; }
		if (mod > WORK_END) { cur = romeDate(p.y, p.m, p.d, WORK_END / 60 | 0, WORK_END % 60); continue; }
		const take = Math.min(mod - WORK_START, minutes);
		cur = new Date(cur.getTime() - take * 60000);
		minutes -= take;
	}
	return cur;
}
/** minuti di lavoro tra due istanti (0 se b precede a) */
export function workBetween(a: Date, b: Date): number {
	if (b <= a) return 0;
	let cur = new Date(a), tot = 0;
	for (let i = 0; i < 400; i++) {
		const p = rome(cur), mod = p.h * 60 + p.min;
		if (isWeekend(p.wd) || mod >= WORK_END) { cur = nextWorkStart(cur); if (cur >= b) break; continue; }
		if (mod < WORK_START) { cur = romeDate(p.y, p.m, p.d, WORK_START / 60 | 0, WORK_START % 60); if (cur >= b) break; continue; }
		const dayEnd = romeDate(p.y, p.m, p.d, WORK_END / 60 | 0, WORK_END % 60);
		const seg = dayEnd < b ? dayEnd : b;
		tot += (seg.getTime() - cur.getTime()) / 60000;
		if (seg >= b) break;
		cur = nextWorkStart(cur);
	}
	return Math.round(tot);
}
/** giorno lavorativo successivo a una data YYYY-MM-DD */
export function nextWorkDay(day: string, n = 1): string {
	const [y, m, d] = parseDay(day);
	let cur = romeDate(y, m, d, 12);
	for (let added = 0; added < n; ) { cur = romeDate(rome(cur).y, rome(cur).m, rome(cur).d + 1, 12); if (!isWeekend(rome(cur).wd)) added++; }
	return isoDay(cur);
}
/** data di spedizione promessa: N giorni lavorativi dopo l'ordine (come promesso in checkout: 5, express 3) */
export function defaultShipBy(created: string, express: boolean): string {
	return nextWorkDay(isoDay(new Date(created)), express ? 3 : 5);
}
/** ora del ritiro del corriere nel giorno di spedizione */
export function shipCutoff(shipBy: string): Date { const [y, m, d] = parseDay(shipBy); return romeDate(y, m, d, PICKUP_MIN / 60 | 0, PICKUP_MIN % 60); }
/** entro quando deve finire l'ultima lavorazione */
export function lastDue(shipBy: string): Date { return new Date(shipCutoff(shipBy).getTime() - MARGIN_MIN * 60000); }

/* ---------- percorsi per prodotto ---------- */
export interface Metrics { m2: number; qty: number }
export function metricsOf(i: OrderRow): Metrics {
	const qty = Math.max(1, Number(i.qty) || 1);
	const w = Number(i.width_mm) || 0, h = Number(i.height_mm) || 0;
	// senza misure (ordini manuali con descrizione libera): stima dal valore della riga
	const m2 = w && h ? (w * h * qty) / 1e6 : Math.max(0.2, Number(i.total_net || 0) / 60);
	return { m2, qty };
}
export interface Step { stage: string; label: string; machine: string; work: (m: Metrics) => number; wait?: number }
const mins = (v: number, lo = 5, hi = 480) => Math.max(lo, Math.min(hi, Math.round(v)));
const STEP = {
	stampa: (label = 'Stampa', machine = 'Roland SG3-300'): Step => ({ stage: 'stampa', label, machine, work: (m) => mins(15 + m.m2 * 25) }),
	stampaUV: (): Step => ({ stage: 'stampa', label: 'Stampa UV rilievo', machine: 'Roland LG-300', work: (m) => mins(20 + m.m2 * 40) }),
	lamina: (): Step => ({ stage: 'plastifica', label: 'Laminazione', machine: 'Plastificatrice', work: (m) => mins(10 + m.m2 * 8) }),
	taglio: (label = 'Taglio'): Step => ({ stage: 'taglio', label, machine: 'Graphtec', work: (m) => mins(10 + m.m2 * 12 + m.qty * 0.02) }),
	colata: (): Step => ({ stage: 'resinatura', label: 'Colata resina', machine: 'Banco resina', work: (m) => mins(20 + m.qty * 0.35) }),
	maturazione: (): Step => ({ stage: 'resinatura', label: 'Maturazione resina', machine: 'Banco resina', work: () => 0, wait: 12 * 60 }),
	controllo: (): Step => ({ stage: 'controllo', label: 'Controllo qualità', machine: 'Banco controllo', work: (m) => mins(10 + m.qty * 0.01, 5, 90) }),
	imballo: (label = 'Imballaggio'): Step => ({ stage: 'confezionamento', label, machine: 'Banco imballaggio', work: (m) => mins(10 + m.qty * 0.01, 5, 120) })
};
const hasLamina = (i: OrderRow) => (i.finitura && i.finitura !== 'nessuna') || (i.lamination && i.lamination !== 'nessuna');
/** Il percorso di una commessa in base al prodotto (i progetti speciali seguono il percorso standard) */
export function routeFor(i: OrderRow): Step[] {
	switch (i.product_slug) {
		case 'adesivi_resinati': return [STEP.stampa(), ...(hasLamina(i) ? [STEP.lamina()] : []), STEP.taglio(), STEP.colata(), STEP.maturazione(), STEP.imballo()];
		case 'adesivi_rilievo': return [STEP.stampaUV(), STEP.taglio('Taglio e finitura'), STEP.imballo()];
		case 'etichette': return [STEP.stampa('Imposizione e stampa'), STEP.taglio('Taglio fogli'), STEP.imballo('Confezionamento')];
		case 'campioni': return [{ stage: 'confezionamento', label: 'Preparazione campioni', machine: 'Banco imballaggio', work: () => 20 }];
		case 'kit_adesivi': return [STEP.stampa(), STEP.taglio(), STEP.imballo('Confezionamento kit')];
		default: return [STEP.stampa(), ...(hasLamina(i) ? [STEP.lamina()] : []), STEP.taglio(), STEP.imballo()];
	}
}
/** Scadenze a ritroso: ogni fase deve finire prima che la successiva possa iniziare */
export function dueDates(steps: { minutes: number; wait_minutes: number }[], shipBy: string): Date[] {
	const out: Date[] = new Array(steps.length);
	let cur = lastDue(shipBy);
	for (let i = steps.length - 1; i >= 0; i--) {
		out[i] = cur;
		const s = steps[i];
		cur = s.wait_minutes ? snapToWork(new Date(cur.getTime() - s.wait_minutes * 60000)) : subWork(cur, s.minutes);
	}
	return out;
}
/** una scadenza fuori orario torna alla fine del turno precedente (la resina matura di notte e nel fine settimana) */
export function snapToWork(d: Date): Date {
	const p = rome(d), mod = p.h * 60 + p.min;
	if (isWeekend(p.wd) || mod < WORK_START) return prevWorkEnd(d);
	if (mod > WORK_END) return romeDate(p.y, p.m, p.d, WORK_END / 60 | 0, WORK_END % 60);
	return d;
}
export const totalWork = (ts: { minutes: number; status?: string }[]) => ts.filter((t) => t.status !== 'completato').reduce((a, t) => a + t.minutes, 0);

/* ---------- rischio, colori e priorita' ---------- */
export type Colour = 'rosso' | 'arancione' | 'blu' | 'verde' | 'grigio' | 'viola';
export const COLOURS: Record<Colour, { label: string; hex: string; soft: string }> = {
	rosso: { label: 'Spedizione a rischio', hex: '#dc2626', soft: '#fee2e2' },
	arancione: { label: 'Meno di 4 ore di margine', hex: '#ea580c', soft: '#ffedd5' },
	blu: { label: 'Pronta, non urgente', hex: '#2563eb', soft: '#dbeafe' },
	verde: { label: 'In corso o completata', hex: '#16a34a', soft: '#dcfce7' },
	grigio: { label: 'Bloccata', hex: '#6b7280', soft: '#e5e7eb' },
	viola: { label: 'In attesa del cliente', hex: '#7c3aed', soft: '#ede9fe' }
};
export interface Risk { colour: Colour; projected: Date | null; margin: number | null; late: boolean; cutoff: Date | null }
/** Quando finirebbe la commessa partendo adesso con le lavorazioni ancora aperte */
export function projectedFinish(tasks: Task[], now = new Date()): Date {
	let cur = new Date(now);
	for (const t of [...tasks].sort((a, b) => a.seq - b.seq)) {
		if (t.status === 'completato') continue;
		if (t.wait_minutes) {
			const end = t.started_at ? new Date(new Date(t.started_at).getTime() + t.wait_minutes * 60000) : new Date(cur.getTime() + t.wait_minutes * 60000);
			cur = end > cur ? end : cur;
		} else cur = addWork(cur, t.minutes);
	}
	return cur;
}
export function riskOf(t: Task, tasks: Task[], order: Pick<OrderRow, 'status' | 'ship_by'>, now = new Date()): Risk {
	const cutoff = order.ship_by ? shipCutoff(order.ship_by) : null;
	const late = !!t.due_at && new Date(t.due_at) < now && t.status !== 'completato';
	const base = { projected: null, margin: null, late, cutoff };
	if (t.status === 'completato' || t.status === 'in_corso') return { ...base, colour: 'verde' };
	if (t.status === 'bloccato') return { ...base, colour: 'grigio' };
	if (APPROVAL_STATUSES.has(order.status)) return { ...base, colour: 'viola' };
	const projected = projectedFinish(tasks, now);
	const margin = t.due_at ? workBetween(now, new Date(t.due_at)) : null;
	if (late || (cutoff && projected > cutoff)) return { colour: 'rosso', projected, margin, late, cutoff };
	if (margin !== null && margin < CRITICAL_MIN) return { colour: 'arancione', projected, margin, late, cutoff };
	return { colour: 'blu', projected, margin, late, cutoff };
}
export const TIERS = ['In ritardo', 'Da spedire oggi', 'Percorso critico', 'Da spedire domani', 'In programma'];
export function tierOf(order: Pick<OrderRow, 'ship_by'>, risk: Risk, now = new Date()): number {
	const today = todayRome(now);
	if (risk.late || risk.colour === 'rosso') return 0;
	if (order.ship_by === today || (order.ship_by && order.ship_by < today)) return 1;
	if (risk.colour === 'arancione') return 2;
	if (order.ship_by === nextWorkDay(today)) return 3;
	return 4;
}
export interface Planned { task: TaskWithOrder; risk: Risk; tier: number }
/** Ordine di lavoro: ritardi, spedizioni di oggi, percorso critico, domani; poi a lotti per materiale e macchina */
export function prioritize(tasks: TaskWithOrder[], now = new Date()): Planned[] {
	const byOrder = new Map<string, Task[]>();
	for (const t of tasks) { if (!byOrder.has(t.order_id)) byOrder.set(t.order_id, []); byOrder.get(t.order_id)!.push(t); }
	return tasks.map((task) => { const risk = riskOf(task, byOrder.get(task.order_id) ?? [task], task.order, now); return { task, risk, tier: tierOf(task.order, risk, now) }; })
		.sort((a, b) => a.tier - b.tier || (a.task.order.materiale ?? '').localeCompare(b.task.order.materiale ?? '') || (a.task.machine ?? '').localeCompare(b.task.machine ?? '') || (a.task.due_at ?? '').localeCompare(b.task.due_at ?? ''));
}
/** Entro quando il cliente deve approvare per mantenere la data di spedizione */
export function approveBy(tasks: Task[]): Date | null {
	const first = [...tasks].sort((a, b) => a.seq - b.seq)[0];
	if (!first?.due_at) return null;
	return first.wait_minutes ? new Date(new Date(first.due_at).getTime() - first.wait_minutes * 60000) : subWork(new Date(first.due_at), first.minutes);
}

/* ---------- formati ---------- */
export function fmtMin(min: number): string {
	if (min < 60) return `${Math.round(min)} min`;
	const h = Math.floor(min / 60), m = Math.round(min % 60);
	return m ? `${h} h ${m} min` : `${h} h`;
}
const fmtTime = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtDayShort = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDayLong = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
/** "oggi 16:00", "domani 10:30", "gio 18/09 09:00" */
export function fmtWhen(d: Date | string | null, now = new Date()): string {
	if (!d) return '—';
	const x = typeof d === 'string' ? new Date(d) : d;
	const day = isoDay(x), today = todayRome(now);
	const t = fmtTime.format(x);
	if (day === today) return `oggi ${t}`;
	if (day === nextWorkDay(today) || day === isoDay(new Date(now.getTime() + 864e5))) return `domani ${t}`;
	return `${fmtDayShort.format(x)} ${t}`;
}
export function fmtDay(day: string | null | undefined, now = new Date()): string {
	if (!day) return '—';
	const today = todayRome(now);
	if (day === today) return 'oggi';
	if (day === nextWorkDay(today)) return 'domani';
	const [y, m, d] = parseDay(day);
	return fmtDayLong.format(romeDate(y, m, d, 12));
}
export function fmtAgo(d: string | Date | null | undefined, now = new Date()): string {
	if (!d) return '—';
	const min = Math.max(0, (now.getTime() - new Date(d).getTime()) / 60000);
	if (min < 60) return `${Math.round(min)} min fa`;
	if (min < 48 * 60) return `${Math.round(min / 60)} h fa`;
	return `${Math.round(min / 1440)} giorni fa`;
}
