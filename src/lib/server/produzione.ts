/**
 * Produzione a lavorazioni: pianificazione delle commesse e azioni dei reparti (solo server).
 * Le regole (percorsi, tempi, calendario, colori) stanno in $lib/dashboard/produzione.ts.
 */
import { fail } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { OrderRow } from '$lib/dashboard/orders';
import { addWork, APPROVAL_STATUSES, approveBy, defaultShipBy, dueDates, isoDay, lastDue, metricsOf, PICKUP_MIN, MARGIN_MIN, PLANNABLE_STATUSES, rome, routeFor, shipCutoff, STAGES, totalWork, type ProdEvent, type Task, type TaskWithOrder } from '$lib/dashboard/produzione';
import { sendEmail } from '$lib/server/email';
import { proofReminderEmail } from '$lib/server/email-templates';

type DB = SupabaseClient;

/** nome dell'operatore che sta usando la dashboard */
export async function operatorName(db: DB, user: User | null): Promise<string | null> {
	if (!user) return null;
	const { data } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
	return (data?.full_name as string | null) || user.email || null;
}
export async function logEvent(db: DB, e: { order_id: string; task_id?: string | null; kind: string; detail?: string | null; operator?: string | null }) {
	await db.from('production_events').insert({ order_id: e.order_id, task_id: e.task_id ?? null, kind: e.kind, detail: e.detail ?? null, operator: e.operator ?? null });
}

/** Lavorazioni con la loro commessa, per gli ordini negli stati indicati */
export async function loadTasks(db: DB, statuses: string[] = PLANNABLE_STATUSES): Promise<TaskWithOrder[]> {
	const { data } = await db.from('production_tasks').select('*, order:orders!inner(*)').in('order.status', statuses).order('seq');
	return ((data ?? []) as unknown as TaskWithOrder[]).filter((t) => t.order);
}

/** la macchina di stampa meno carica tra le due Roland */
async function pickRoland(db: DB): Promise<string> {
	const { data } = await db.from('production_tasks').select('machine, minutes').eq('stage', 'stampa').in('status', ['pronto', 'in_corso', 'bloccato']);
	const load: Record<string, number> = { 'Roland SG3-300 #1': 0, 'Roland SG3-300 #2': 0 };
	for (const t of data ?? []) if (t.machine && t.machine in load) load[t.machine] += t.minutes;
	return load['Roland SG3-300 #1'] <= load['Roland SG3-300 #2'] ? 'Roland SG3-300 #1' : 'Roland SG3-300 #2';
}

/** Costruisce le lavorazioni di una commessa (senza salvarle) */
export function buildPlan(o: OrderRow, shipBy: string, roland: string) {
	const m = metricsOf(o);
	const steps = routeFor(o).map((s) => ({ stage: s.stage, label: s.label, machine: s.machine === 'Roland SG3-300' ? roland : s.machine, minutes: s.wait ? 0 : s.work(m), wait_minutes: s.wait ?? 0 }));
	const dues = dueDates(steps, shipBy);
	return steps.map((s, i) => ({ ...s, order_id: o.id, seq: i + 1, due_at: dues[i].toISOString(), status: 'da_fare' as const }));
}

/** Se partendo adesso non si arriva al ritiro del corriere, la data promessa slitta al primo giorno utile */
function shiftedShipBy(tasks: { minutes: number; wait_minutes: number; status?: string; started_at?: string | null }[], shipBy: string, now: Date): string | null {
	let cur = new Date(now);
	for (const t of tasks) { if (t.status === 'completato') continue; cur = t.wait_minutes ? new Date(cur.getTime() + t.wait_minutes * 60000) : addWork(cur, t.minutes); }
	if (cur <= lastDue(shipBy)) return null;
	// giorno in cui si finisce; se si finisce dopo l'ora utile per il ritiro, il giorno lavorativo dopo
	const withMargin = new Date(cur.getTime() + MARGIN_MIN * 60000);
	const p = rome(withMargin);
	let day = isoDay(withMargin);
	if (p.h * 60 + p.min > PICKUP_MIN || p.wd === 0 || p.wd === 6) day = isoDay(addWork(withMargin, 1));
	return day;
}

/**
 * Crea le lavorazioni mancanti per le commesse aperte e attiva la prima lavorazione
 * delle commesse appena entrate in produzione (con la data che slitta se l'approvazione e' arrivata tardi).
 * Si chiama all'apertura delle pagine di produzione, alla conferma del checkout e al cambio di stato in dashboard.
 */
export async function ensurePlan(db: DB, rows: OrderRow[], operator: string | null = null): Promise<void> {
	const open = rows.filter((r) => PLANNABLE_STATUSES.includes(r.status));
	if (!open.length) return;
	const { data: existing } = await db.from('production_tasks').select('*').in('order_id', open.map((r) => r.id)).order('seq');
	const byOrder = new Map<string, Task[]>();
	for (const t of (existing ?? []) as Task[]) { if (!byOrder.has(t.order_id)) byOrder.set(t.order_id, []); byOrder.get(t.order_id)!.push(t); }
	let roland: string | null = null;
	const now = new Date();
	for (const o of open) {
		const ts = byOrder.get(o.id) ?? [];
		if (!ts.length) {
			roland ??= await pickRoland(db);
			const shipBy = o.ship_by ?? o.delivery_date ?? defaultShipBy(o.created_at, o.express);
			const plan = buildPlan(o, shipBy, roland);
			if (o.status === 'in_produzione') {
				// commessa gia' in lavorazione (fase manuale): le fasi precedenti risultano fatte
				const stages = plan.map((p) => p.stage);
				let cur = o.prod_stage ? stages.indexOf(o.prod_stage) : 0;
				if (cur < 0) cur = 0;
				plan.forEach((p, i) => { if (i < cur) Object.assign(p, { status: 'completato', completed_at: now.toISOString() }); else if (i === cur) Object.assign(p, { status: p.wait_minutes && !p.minutes ? 'in_corso' : 'pronto', started_at: p.wait_minutes ? now.toISOString() : null }); });
			}
			const { data: ins } = await db.from('production_tasks').insert(plan).select('*');
			const patch: Record<string, unknown> = {};
			if (!o.ship_by) patch.ship_by = shipBy;
			if (o.status === 'in_produzione') patch.prod_stage = ((ins ?? []) as Task[]).find((t) => t.status !== 'completato')?.stage ?? null;
			if (Object.keys(patch).length) await db.from('orders').update(patch).eq('id', o.id);
			await logEvent(db, { order_id: o.id, kind: 'pianificata', detail: `${plan.length} lavorazioni, spedizione ${shipBy}`, operator });
			continue;
		}
		// commessa approvata: entra in produzione → prima lavorazione pronta, data verificata
		if (o.status === 'in_produzione' && !ts.some((t) => t.status === 'pronto' || t.status === 'in_corso' || t.status === 'bloccato') && ts.some((t) => t.status === 'da_fare')) {
			await activate(db, o, ts, operator);
		}
	}
}

async function activate(db: DB, o: OrderRow, ts: Task[], operator: string | null) {
	const now = new Date();
	let shipBy = o.ship_by ?? o.delivery_date ?? defaultShipBy(o.created_at, o.express);
	const shifted = shiftedShipBy(ts, shipBy, now);
	if (shifted && shifted > shipBy) {
		await logEvent(db, { order_id: o.id, kind: 'data_spostata', detail: `Spedizione da ${shipBy} a ${shifted}: approvazione arrivata oltre il termine utile`, operator });
		shipBy = shifted;
		await db.from('orders').update({ ship_by: shipBy }).eq('id', o.id);
		await replanDates(db, ts, shipBy);
	}
	const first = ts.find((t) => t.status === 'da_fare');
	if (!first) return;
	const patch = first.wait_minutes && !first.minutes ? { status: 'in_corso', started_at: now.toISOString() } : { status: 'pronto' };
	await db.from('production_tasks').update({ ...patch, updated_at: now.toISOString() }).eq('id', first.id);
	await db.from('orders').update({ prod_stage: first.stage }).eq('id', o.id);
	await logEvent(db, { order_id: o.id, task_id: first.id, kind: 'in_produzione', detail: `Prima lavorazione: ${first.label}`, operator });
}

/** ricalcola le scadenze delle lavorazioni non ancora completate */
export async function replanDates(db: DB, ts: Task[], shipBy: string) {
	const sorted = [...ts].sort((a, b) => a.seq - b.seq);
	const dues = dueDates(sorted, shipBy);
	for (let i = 0; i < sorted.length; i++) if (sorted[i].status !== 'completato') await db.from('production_tasks').update({ due_at: dues[i].toISOString() }).eq('id', sorted[i].id);
}

async function taskAndSiblings(db: DB, id: string): Promise<{ task: Task; all: Task[]; order: OrderRow } | null> {
	const { data: task } = await db.from('production_tasks').select('*').eq('id', id).maybeSingle();
	if (!task) return null;
	const [{ data: all }, { data: order }] = await Promise.all([
		db.from('production_tasks').select('*').eq('order_id', task.order_id).order('seq'),
		db.from('orders').select('*').eq('id', task.order_id).maybeSingle()
	]);
	if (!order) return null;
	return { task: task as Task, all: (all ?? []) as Task[], order: order as OrderRow };
}

export async function startTask(db: DB, id: string, operator: string | null) {
	const c = await taskAndSiblings(db, id);
	if (!c) return 'Lavorazione non trovata.';
	if (c.task.status === 'completato') return 'Lavorazione già completata.';
	const now = new Date().toISOString();
	await db.from('production_tasks').update({ status: 'in_corso', started_at: c.task.started_at ?? now, operator, block_reason: null, updated_at: now }).eq('id', id);
	await db.from('orders').update({ prod_stage: c.task.stage, status: 'in_produzione' }).eq('id', c.order.id);
	await logEvent(db, { order_id: c.order.id, task_id: id, kind: 'iniziata', detail: c.task.label, operator });
	return null;
}

/** Completa la lavorazione: la successiva diventa pronta (la maturazione parte da sola); l'ultima manda l'ordine in spedizione */
export async function completeTask(db: DB, id: string, operator: string | null) {
	const c = await taskAndSiblings(db, id);
	if (!c) return 'Lavorazione non trovata.';
	const now = new Date();
	const early = c.task.wait_minutes && c.task.started_at && new Date(c.task.started_at).getTime() + c.task.wait_minutes * 60000 > now.getTime();
	await db.from('production_tasks').update({ status: 'completato', completed_at: now.toISOString(), started_at: c.task.started_at ?? now.toISOString(), operator: c.task.operator ?? operator, block_reason: null, updated_at: now.toISOString() }).eq('id', id);
	await logEvent(db, { order_id: c.order.id, task_id: id, kind: 'completata', detail: c.task.label + (early ? ' (chiusa prima del tempo di maturazione)' : ''), operator });
	const next = c.all.filter((t) => t.seq > c.task.seq && t.status !== 'completato').sort((a, b) => a.seq - b.seq)[0];
	if (next) {
		const patch = next.wait_minutes && !next.minutes ? { status: 'in_corso', started_at: now.toISOString() } : { status: 'pronto' };
		await db.from('production_tasks').update({ ...patch, updated_at: now.toISOString() }).eq('id', next.id);
		await db.from('orders').update({ prod_stage: next.stage, status: 'in_produzione' }).eq('id', c.order.id);
	} else {
		await db.from('orders').update({ prod_stage: null, status: 'pronto' }).eq('id', c.order.id);
		await logEvent(db, { order_id: c.order.id, kind: 'pronta', detail: 'Commessa completata, pronta per la spedizione', operator });
	}
	return null;
}

export async function blockTask(db: DB, id: string, reason: string, operator: string | null) {
	const c = await taskAndSiblings(db, id);
	if (!c) return 'Lavorazione non trovata.';
	if (!reason.trim()) return 'Scrivi il motivo del blocco.';
	await db.from('production_tasks').update({ status: 'bloccato', block_reason: reason.trim(), updated_at: new Date().toISOString() }).eq('id', id);
	await logEvent(db, { order_id: c.order.id, task_id: id, kind: 'bloccata', detail: `${c.task.label}: ${reason.trim()}`, operator });
	return null;
}
export async function unblockTask(db: DB, id: string, operator: string | null) {
	const c = await taskAndSiblings(db, id);
	if (!c) return 'Lavorazione non trovata.';
	await db.from('production_tasks').update({ status: c.task.started_at ? 'in_corso' : 'pronto', block_reason: null, updated_at: new Date().toISOString() }).eq('id', id);
	await logEvent(db, { order_id: c.order.id, task_id: id, kind: 'sbloccata', detail: c.task.label, operator });
	return null;
}
export async function setMachine(db: DB, id: string, machine: string, operator: string | null) {
	const c = await taskAndSiblings(db, id);
	if (!c) return 'Lavorazione non trovata.';
	if (!STAGES[c.task.stage]?.machines.includes(machine)) return 'Macchina non valida per questo reparto.';
	await db.from('production_tasks').update({ machine, updated_at: new Date().toISOString() }).eq('id', id);
	await logEvent(db, { order_id: c.order.id, task_id: id, kind: 'macchina', detail: `${c.task.label} → ${machine}`, operator });
	return null;
}

/** Ristampa: si riparte dalla stampa, le fasi seguenti tornano da fare; le scadenze restano (la commessa risulta in ritardo se lo e') */
export async function reprint(db: DB, orderId: string, reason: string, operator: string | null) {
	const { data: all } = await db.from('production_tasks').select('*').eq('order_id', orderId).order('seq');
	const ts = (all ?? []) as Task[];
	const from = ts.find((t) => t.stage === 'stampa') ?? ts[0];
	if (!from) return 'Nessuna lavorazione da ripetere.';
	const now = new Date().toISOString();
	for (const t of ts) if (t.seq >= from.seq) await db.from('production_tasks').update({ status: t.id === from.id ? 'pronto' : 'da_fare', started_at: null, completed_at: null, block_reason: null, updated_at: now }).eq('id', t.id);
	const { data: o } = await db.from('orders').select('reprints').eq('id', orderId).maybeSingle();
	await db.from('orders').update({ status: 'in_produzione', prod_stage: from.stage, reprints: (Number(o?.reprints) || 0) + 1 }).eq('id', orderId);
	await logEvent(db, { order_id: orderId, task_id: from.id, kind: 'ristampa', detail: reason.trim() || 'Ristampa', operator });
	return null;
}

export async function setShipBy(db: DB, orderId: string, day: string, operator: string | null) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Data non valida.';
	const { data: o } = await db.from('orders').select('ship_by').eq('id', orderId).maybeSingle();
	await db.from('orders').update({ ship_by: day }).eq('id', orderId);
	const { data: all } = await db.from('production_tasks').select('*').eq('order_id', orderId);
	await replanDates(db, (all ?? []) as Task[], day);
	await logEvent(db, { order_id: orderId, kind: 'data_spostata', detail: `Spedizione da ${o?.ship_by ?? '—'} a ${day} (manuale)`, operator });
	return null;
}
export async function addNote(db: DB, orderId: string, text: string, operator: string | null) {
	if (!text.trim()) return 'Nota vuota.';
	await logEvent(db, { order_id: orderId, kind: 'nota', detail: text.trim(), operator });
	return null;
}

/** Sollecito di approvazione al cliente, con la data entro cui approvare per mantenere la spedizione */
export async function remindApproval(db: DB, orderId: string, origin: string, operator: string | null) {
	const { data: o } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
	if (!o) return 'Ordine non trovato.';
	const order = o as OrderRow;
	if (!APPROVAL_STATUSES.has(order.status)) return 'La commessa non aspetta il cliente.';
	if (!order.email) return 'Nessuna email del cliente.';
	const { data: all } = await db.from('production_tasks').select('*').eq('order_id', orderId);
	const by = approveBy((all ?? []) as Task[]);
	const mail = proofReminderEmail({ name: order.shipping?.first_name ?? order.customer_name, number: order.number, missingFile: order.status === 'attesa_file', approveBy: by, shipBy: order.ship_by ?? null, href: `${origin}/account/ordini` });
	const r = await sendEmail({ to: order.email, ...mail });
	if (!r.ok) return r.error ?? 'Invio non riuscito.';
	await db.from('orders').update({ proof_reminded_at: new Date().toISOString() }).eq('id', orderId);
	await logEvent(db, { order_id: orderId, kind: 'sollecito', detail: `Email a ${order.email}`, operator });
	return null;
}

export async function loadEvents(db: DB, orderId: string): Promise<ProdEvent[]> {
	const { data } = await db.from('production_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100);
	return (data ?? []) as ProdEvent[];
}

/** Azioni dei reparti, condivise da tutte le pagine di produzione (i form usano ?/inizia, ?/completa, ...) */
export const taskActions = {
	inizia: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => startTask(db, String((await request.formData()).get('task')), op)),
	completa: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => completeTask(db, String((await request.formData()).get('task')), op)),
	blocca: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return blockTask(db, String(f.get('task')), String(f.get('motivo') ?? ''), op); }),
	sblocca: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => unblockTask(db, String((await request.formData()).get('task')), op)),
	macchina: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return setMachine(db, String(f.get('task')), String(f.get('machine') ?? ''), op); }),
	ristampa: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return reprint(db, String(f.get('order')), String(f.get('motivo') ?? ''), op); }),
	data: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return setShipBy(db, String(f.get('order')), String(f.get('ship_by') ?? ''), op); }),
	nota: async ({ request, locals }: { request: Request; locals: App.Locals }) => run(locals, async (db, op) => { const f = await request.formData(); return addNote(db, String(f.get('order')), String(f.get('testo') ?? ''), op); }),
	sollecita: async ({ request, url, locals }: { request: Request; url: URL; locals: App.Locals }) => run(locals, async (db, op) => remindApproval(db, String((await request.formData()).get('order')), url.origin, op))
};
async function run(locals: App.Locals, fn: (db: DB, op: string | null) => Promise<string | null>) {
	const op = await operatorName(locals.supabase, locals.user);
	const err = await fn(locals.supabase, op);
	if (err) return fail(400, { error: err });
	return { ok: true };
}

/** scadenza dell'anteprima: entro un giorno lavorativo dall'ordine, o entro quando serve per la produzione */
export function proofDeadline(o: OrderRow, tasks: Task[]): Date | null {
	const by = approveBy(tasks);
	const cut = o.ship_by ? shipCutoff(o.ship_by) : null;
	if (by && cut) return by < cut ? by : cut;
	return by ?? cut;
}
export { totalWork };
