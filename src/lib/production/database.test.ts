/**
 * Test con il database VERO (migrazioni applicate su Postgres embedded): commessa unica per pagamento,
 * webhook doppio, ordini non pagati, data promessa immutabile, macchinari, ruoli.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { fakeClient, freshDb, setUser } from './testdb';
import { cancelJob, completePhase, ensurePlan, isAdmin, loadJob, loadSetup, machineFromForm, recalcAll, removeMachine, saveMachine, setMachineActive, startPhase, taskActions } from '$lib/server/produzione';
import type { OrderRow } from '$lib/dashboard/orders';

let pg: PGlite; let db: ReturnType<typeof fakeClient>;
const ADMIN = '11111111-1111-1111-1111-111111111111', STAFF = '22222222-2222-2222-2222-222222222222';
let n = 0;
/** simula il checkout: righe d'ordine di un gruppo, pagate (o no) */
async function order(o: { paid?: boolean; status?: string; product?: string; finitura?: string; qty?: number; w?: number; h?: number; group?: string } = {}): Promise<OrderRow[]> {
	const group = o.group ?? `g-${++n}`;
	const number = `TST${String(n).padStart(4, '0')}`;
	await pg.query(`insert into public.orders (user_id, number, product_slug, product_name, forma, materiale, finitura, width_mm, height_mm, qty, total_net, total_gross, status, payment_status, channel, checkout_group, customer_name, email, created_at)
		values ('${ADMIN}', '${number}', '${o.product ?? 'adesivi_personalizzati'}', 'Adesivi', 'sagomato', 'bianco', '${o.finitura ?? 'nessuna'}', ${o.w ?? 50}, ${o.h ?? 50}, ${o.qty ?? 100}, 30, 36.6, '${o.status ?? 'in_produzione'}', '${o.paid === false ? 'pending' : 'paid'}', 'ecommerce', '${group}', 'Cliente Test', 'test@example.com', now())`);
	const r = await pg.query<OrderRow>(`select * from public.orders where checkout_group = '${group}'`);
	return r.rows;
}
const jobs = async (group: string) => Number((await pg.query<{ n: number }>(`select count(*)::int n from public.production_jobs where checkout_group = '${group}'`)).rows[0].n);
const phases = async (group: string) => (await pg.query<{ id: string; status: string; machine_id: string | null; machine: string; label: string; minutes: number; seq: number }>(`select t.* from public.production_tasks t join public.production_jobs j on j.id = t.job_id where j.checkout_group = '${group}' order by t.seq`)).rows;

beforeAll(async () => {
	pg = await freshDb();
	db = fakeClient(pg);
	await pg.query(`insert into auth.users (id, email) values ('${ADMIN}', 'admin@test.it'), ('${STAFF}', 'staff@test.it')`);
	await pg.query(`insert into public.profiles (id, email, full_name, role) values ('${ADMIN}', 'admin@test.it', 'Admin', 'admin'), ('${STAFF}', 'staff@test.it', 'Operatore', 'staff') on conflict (id) do update set role = excluded.role`);
}, 120000);

describe('commesse e pagamenti', () => {
	it('setup iniziale: i sette macchinari, velocita\' da configurare', async () => {
		const { machines } = await loadSetup(db);
		expect(machines.map((m) => m.code).sort()).toEqual(['FC-1', 'FC-2', 'LAM-1', 'LG2-UV', 'RES-1', 'SG3-1', 'SG3-2']);
		expect(machines.every((m) => m.sqm_per_hour == null && m.minutes_per_piece == null)).toBe(true);
		expect(machines.filter((m) => m.machine_type === 'stampante_ecosolvente').every((m) => m.usable_width_mm === 750)).toBe(true);
		expect(machines.find((m) => m.code === 'LAM-1')?.usable_width_mm).toBeNull();
	});
	it('1. un pagamento riuscito crea UNA commessa con la prima fase pronta', async () => {
		const rows = await order();
		await ensurePlan(db, rows);
		expect(await jobs(rows[0].checkout_group!)).toBe(1);
		const ph = await phases(rows[0].checkout_group!);
		expect(ph.length).toBeGreaterThan(2);
		expect(ph[0].status).toBe('pronto');
		expect(ph.slice(1).every((p) => p.status === 'da_fare')).toBe(true);
	});
	it('2. un webhook ripetuto non crea doppioni (ne commesse, ne fasi)', async () => {
		const rows = await order();
		await ensurePlan(db, rows); const before = (await phases(rows[0].checkout_group!)).length;
		await ensurePlan(db, rows); await ensurePlan(db, rows);
		expect(await jobs(rows[0].checkout_group!)).toBe(1);
		expect((await phases(rows[0].checkout_group!)).length).toBe(before);
	});
	it('3. ordine non pagato (o in attesa di pagamento, o annullato) non entra in produzione', async () => {
		const a = await order({ paid: false }); await ensurePlan(db, a); expect(await jobs(a[0].checkout_group!)).toBe(0);
		const b = await order({ status: 'attesa_pagamento' }); await ensurePlan(db, b); expect(await jobs(b[0].checkout_group!)).toBe(0);
		const c = await order({ status: 'annullato' }); await ensurePlan(db, c); expect(await jobs(c[0].checkout_group!)).toBe(0);
	});
	it('4. la data promessa e\' salvata come snapshot e non cambia', async () => {
		const rows = await order();
		await ensurePlan(db, rows);
		const j1 = await loadJob(db, rows[0].checkout_group!);
		expect(j1?.job.promised_ship_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		await pg.query(`update public.orders set ship_by = '2030-01-01', delivery_date = '2030-01-01' where checkout_group = '${rows[0].checkout_group}'`);
		await recalcAll(db); await ensurePlan(db, (await pg.query<OrderRow>(`select * from public.orders where checkout_group = '${rows[0].checkout_group}'`)).rows);
		const j2 = await loadJob(db, rows[0].checkout_group!);
		expect(j2?.job.promised_ship_date).toBe(j1?.job.promised_ship_date);
	});
	it('5-6. laminato → SG3; senza protezione → LG2 UV', async () => {
		const lam = await order({ finitura: 'lucida' }); await ensurePlan(db, lam);
		expect((await phases(lam[0].checkout_group!))[0].machine).toMatch(/Roland SG3 #[12]/);
		const uv = await order({ finitura: 'nessuna' }); await ensurePlan(db, uv);
		expect((await phases(uv[0].checkout_group!))[0].machine).toBe('Roland LG2 UV');
	});
	it('22. fase completata sblocca la successiva; fine dell\'ultima → ordine in spedizione', async () => {
		const rows = await order({ product: 'campioni' }); await ensurePlan(db, rows);
		const [p1] = await phases(rows[0].checkout_group!);
		expect(await startPhase(db, p1.id, 'Operatore')).toBeNull();
		expect(await startPhase(db, p1.id, 'Operatore')).not.toBeNull();   // doppio click: la seconda volta non passa
		expect(await completePhase(db, p1.id, 'Operatore')).toBeNull();
		const o = await pg.query<{ status: string }>(`select status from public.orders where checkout_group = '${rows[0].checkout_group}'`);
		expect(o.rows[0].status).toBe('in_spedizione');
		const j = await loadJob(db, rows[0].checkout_group!);
		expect(j?.job.status).toBe('COMPLETED');
	});
	it('fase completata: la successiva diventa pronta e le altre restano bloccate', async () => {
		const rows = await order({ finitura: 'lucida' }); await ensurePlan(db, rows);
		const ph = await phases(rows[0].checkout_group!);
		await startPhase(db, ph[0].id, 'Op'); await completePhase(db, ph[0].id, 'Op');
		const after = await phases(rows[0].checkout_group!);
		expect(after[0].status).toBe('completato');
		expect(after.find((p) => p.status === 'pronto')).toBeTruthy();
		expect(after.filter((p) => p.status === 'da_fare').length).toBe(after.length - 2);
	});
});

describe('macchinari', () => {
	it('15. si aggiunge un macchinario e riceve lavori; 16. la velocita\' cambia le stime', async () => {
		const f = new FormData(); f.set('code', 'SG3-3'); f.set('name', 'Roland SG3 #3'); f.set('machine_type', 'stampante_ecosolvente'); f.set('department', 'stampa'); f.set('is_active', 'on'); f.set('sqm_per_hour', '5'); f.set('setup_minutes', '10'); f.append('capabilities', 'stampa_ecosolvente');
		const r = await saveMachine(db, null, machineFromForm(f));
		expect(r.error).toBeUndefined();
		const rows = await order({ finitura: 'opaca', qty: 400, w: 100, h: 100 }); await ensurePlan(db, rows);   // 4 m²
		const ph = await phases(rows[0].checkout_group!);
		// la stampa va sulla macchina configurata (unica con velocita': stima affidabile) e dura 10 + 4/5×60 = 58 min
		expect(ph[0].machine).toBe('Roland SG3 #3');
		expect(ph[0].minutes).toBe(58);
		const f2 = new FormData(); f2.set('code', 'SG3-3'); f2.set('name', 'Roland SG3 #3'); f2.set('machine_type', 'stampante_ecosolvente'); f2.set('department', 'stampa'); f2.set('is_active', 'on'); f2.set('sqm_per_hour', '10'); f2.set('setup_minutes', '10'); f2.append('capabilities', 'stampa_ecosolvente');
		await saveMachine(db, r.id, machineFromForm(f2)); await recalcAll(db);
		expect((await phases(rows[0].checkout_group!))[0].minutes).toBe(34);
		await removeMachine(db, r.id!);   // usato: viene archiviato
	});
	it('13. macchinario disattivato non riceve lavori', async () => {
		const { machines } = await loadSetup(db);
		const sg2 = machines.find((m) => m.code === 'SG3-2')!;
		await setMachineActive(db, sg2.id, false);
		for (let k = 0; k < 3; k++) { const rows = await order({ finitura: 'lucida' }); await ensurePlan(db, rows); expect((await phases(rows[0].checkout_group!))[0].machine).toBe('Roland SG3 #1'); }
		await setMachineActive(db, sg2.id, true);
	});
	it('14. macchinario archiviato resta nella cronologia delle commesse', async () => {
		const { machines } = await loadSetup(db);
		const lg2 = machines.find((m) => m.code === 'LG2-UV')!;
		const rows = await order({ finitura: 'nessuna' }); await ensurePlan(db, rows);
		const before = await phases(rows[0].checkout_group!);
		expect(before[0].machine_id).toBe(lg2.id);
		const r = await removeMachine(db, lg2.id);
		expect(r.archived).toBe(true);
		const after = await phases(rows[0].checkout_group!);
		expect(after[0].machine_id).toBe(lg2.id);   // il riferimento storico resta
		expect((await loadSetup(db)).machines.find((m) => m.id === lg2.id)?.archived_at).toBeTruthy();
		await pg.query(`update public.production_machines set archived_at = null, is_active = true where id = '${lg2.id}'`);
	});
});

describe('ruoli', () => {
	it('23. l\'operatore non puo\' modificare il setup ne\' le stime; l\'amministratore si\'', async () => {
		expect(await isAdmin(db, { id: STAFF } as never)).toBe(false);
		expect(await isAdmin(db, { id: ADMIN } as never)).toBe(true);
		const rows = await order(); await ensurePlan(db, rows);
		const [p] = await phases(rows[0].checkout_group!);
		const fd = new FormData(); fd.set('task', p.id); fd.set('minuti', '99');
		const req = () => new Request('http://x', { method: 'POST', body: fd });
		const asStaff = await taskActions.stima({ request: req(), locals: { supabase: db, user: { id: STAFF } } as never });
		expect((asStaff as { status?: number }).status).toBe(403);
		const asAdmin = await taskActions.stima({ request: req(), locals: { supabase: db, user: { id: ADMIN } } as never });
		expect((asAdmin as { ok?: boolean }).ok).toBe(true);
		expect((await phases(rows[0].checkout_group!))[0].minutes).toBe(99);
		// RLS: la scrittura sui macchinari e' permessa solo a is_admin()
		await setUser(pg, STAFF); expect((await pg.query<{ ok: boolean }>('select public.is_admin() as ok')).rows[0].ok).toBe(false);
		await setUser(pg, ADMIN); expect((await pg.query<{ ok: boolean }>('select public.is_admin() as ok')).rows[0].ok).toBe(true);
		await setUser(pg, null);
	});
	it('annullare una commessa (admin) chiude le fasi e l\'ordine risulta annullato', async () => {
		const rows = await order(); await ensurePlan(db, rows);
		const j = await loadJob(db, rows[0].checkout_group!);
		expect(await cancelJob(db, j!.job.id, 'cliente ha annullato', 'Admin')).toBeNull();
		expect(await cancelJob(db, j!.job.id, 'di nuovo', 'Admin')).not.toBeNull();
		expect((await phases(rows[0].checkout_group!)).every((p) => p.status === 'saltata')).toBe(true);
		expect((await pg.query<{ status: string }>(`select status from public.orders where checkout_group = '${rows[0].checkout_group}'`)).rows[0].status).toBe('annullato');
	});
});
