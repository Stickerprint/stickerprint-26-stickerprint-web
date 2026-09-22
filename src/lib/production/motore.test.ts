/**
 * Test del motore di produzione (routing + calendario + pianificatore): puri, senza database.
 * Le regole di Stickerprint: lamina → SG3, senza protezione → LG2 UV, resinati → SG3 + Graphtec + resinatrice, ecc.
 */
import { describe, expect, it } from 'vitest';
import { addWork, isWorkingDay, shiftWorkDays, subWork, workBetween, local, parts, italianHolidays } from './calendar';
import { areaOf, routeOrder, routeTemplate, routingInputFrom } from './routing';
import { forecastForward, planBackward, sortQueue, splitByDays, type PlanPhase } from './scheduler';
import { DEFAULT_CALENDAR, type Calendar, type Machine, type RoutingInput } from './types';

const cal: Calendar = { ...DEFAULT_CALENDAR };
const M = (code: string, name: string, machine_type: string, department: Machine['department'], caps: Machine['capabilities'], extra: Partial<Machine> = {}): Machine => ({
	id: code, code, name, brand: null, model: null, machine_type, department, usable_width_mm: null, is_active: true, archived_at: null,
	setup_minutes: null, sqm_per_hour: null, minutes_per_sqm: null, pieces_per_hour: null, minutes_per_piece: null, cleanup_minutes: null, passive_minutes: null, waste_coefficient: null,
	capabilities: caps, notes: null, sort: 0, ...extra
});
/** i sette macchinari del setup iniziale (velocita' NON configurate) */
const PARK = (): Machine[] => [
	M('SG3-1', 'Roland SG3 #1', 'stampante_ecosolvente', 'stampa', ['stampa_ecosolvente'], { usable_width_mm: 750, sort: 1 }),
	M('SG3-2', 'Roland SG3 #2', 'stampante_ecosolvente', 'stampa', ['stampa_ecosolvente'], { usable_width_mm: 750, sort: 2 }),
	M('LG2-UV', 'Roland LG2 UV', 'stampante_uv', 'stampa', ['stampa_uv'], { usable_width_mm: 750, sort: 3 }),
	M('LAM-1', 'Laminatrice', 'laminatrice', 'laminazione', ['laminazione'], { sort: 4 }),
	M('FC-1', 'Graphtec FC Pro 9000 #1', 'plotter_taglio', 'taglio', ['taglio'], { sort: 5 }),
	M('FC-2', 'Graphtec FC Pro 9000 #2', 'plotter_taglio', 'taglio', ['taglio'], { sort: 6 }),
	M('RES-1', 'Resinatrice automatica', 'resinatrice', 'resinatura', ['resinatura'], { sort: 7 })
];
const order = (over: Partial<RoutingInput> = {}): RoutingInput => ({ product_slug: 'adesivi_personalizzati', laminated: false, protection: 'nessuna', qty: 100, width_mm: 50, height_mm: 50, ...over });
const T = (y: number, m: number, d: number, h: number, min = 0) => local('Europe/Rome', y, m, d, h, min);
const asPlan = (i: RoutingInput, machines = PARK()): PlanPhase[] => routeOrder(i, machines).phases.map((p) => ({ ...p, status: 'da_fare' as const }));

describe('routing: le regole di Stickerprint', () => {
	it('5. prodotto laminato → stampa su una SG3, poi laminazione e taglio su Graphtec', () => {
		const r = routeOrder(order({ laminated: true, protection: 'lucida' }), PARK());
		const caps = r.phases.map((p) => p.capability);
		expect(caps).toEqual(['stampa_ecosolvente', 'laminazione', 'taglio']);
		expect(['SG3-1', 'SG3-2']).toContain(r.phases[0].machine_id);
		expect(['FC-1', 'FC-2']).toContain(r.phases[2].machine_id);
	});
	it('6. prodotto senza protezione → LG2 UV, mai la laminatrice', () => {
		for (const slug of ['adesivi_personalizzati', 'etichette', 'kit_adesivi', 'fogli_adesivi']) {
			const r = routeOrder(order({ product_slug: slug }), PARK());
			expect(r.phases[0].machine_id).toBe('LG2-UV');
			expect(r.phases.some((p) => p.capability === 'laminazione')).toBe(false);
		}
	});
	it('7. vetrofania → LG2 UV, taglio solo se previsto', () => {
		const senza = routeOrder(order({ product_slug: 'vetrofanie' }), PARK());
		expect(senza.phases[0].machine_id).toBe('LG2-UV');
		expect(senza.phases.some((p) => p.capability === 'taglio')).toBe(false);
		const con = routeOrder(order({ product_slug: 'vetrofanie', needs_cut: true }), PARK());
		expect(con.phases.some((p) => p.capability === 'taglio')).toBe(true);
	});
	it('8. resinato → SG3, taglio basi su Graphtec, resinatrice, maturazione passiva; mai la LG2', () => {
		const r = routeOrder(order({ product_slug: 'adesivi_resinati', width_mm: 25, height_mm: 25 }), PARK());
		expect(r.phases.map((p) => p.capability)).toEqual(['stampa_ecosolvente', 'taglio', 'resinatura', 'resinatura']);
		expect(['SG3-1', 'SG3-2']).toContain(r.phases[0].machine_id);
		expect(r.phases[2].machine_id).toBe('RES-1');
		expect(r.phases[3].passive).toBe(true);
		expect(r.phases[3].wait_minutes).toBeGreaterThan(0);
		expect(r.phases.some((p) => p.machine_id === 'LG2-UV')).toBe(false);
		// la laminazione sui resinati non si deduce: solo se scelta
		expect(r.phases.some((p) => p.capability === 'laminazione')).toBe(false);
		expect(routeOrder(order({ product_slug: 'adesivi_resinati', laminated: true }), PARK()).phases.some((p) => p.capability === 'laminazione')).toBe(true);
	});
	it('9. la laminatrice si usa solo con lamina', () => {
		const tutti = ['adesivi_personalizzati', 'etichette', 'kit_adesivi', 'fogli_adesivi', 'vetrofanie', 'adesivi_rilievo', 'adesivi_resinati', 'campioni'];
		for (const slug of tutti) expect(routeTemplate(order({ product_slug: slug, laminated: false })).some((t) => t.capability === 'laminazione')).toBe(false);
	});
	it('la scelta dal checkout: finitura "nessuna" e vernice UV del rilievo non sono lamine', () => {
		expect(routingInputFrom({ product_slug: 'adesivi_personalizzati', finitura: 'nessuna', qty: 10, width_mm: 40, height_mm: 40 }).laminated).toBe(false);
		expect(routingInputFrom({ product_slug: 'adesivi_personalizzati', finitura: 'opaca', qty: 10, width_mm: 40, height_mm: 40 }).laminated).toBe(true);
		expect(routingInputFrom({ product_slug: 'adesivi_rilievo', finitura: 'uv-opaca', qty: 10, width_mm: 40, height_mm: 40 }).laminated).toBe(false);
	});
	it('area: millimetri → metri quadrati, con quantita\'', () => {
		const a = areaOf({ qty: 100, width_mm: 50, height_mm: 50 });
		expect(a.pieceSqm).toBeCloseTo(0.0025, 6);
		expect(a.totalSqm).toBeCloseTo(0.25, 6);
		expect(areaOf({ qty: 10, width_mm: null, height_mm: null }).known).toBe(false);
	});
	it('13. macchinario disattivato non riceve lavori; 14. archiviato idem (ma resta nei dati)', () => {
		const park = PARK(); park[2].is_active = false;   // LG2 spenta
		const r = routeOrder(order(), park);
		expect(r.phases[0].machine_id).toBeNull();        // nessuna UV usabile: resta senza macchina, da assegnare
		const park2 = PARK(); park2[0].archived_at = '2026-01-01T00:00:00Z';
		expect(routeOrder(order({ laminated: true }), park2).phases[0].machine_id).toBe('SG3-2');
	});
	it('16. la velocita\' configurata cambia la stima; senza velocita\' vale la riserva', () => {
		const senza = routeOrder(order({ laminated: true }), PARK());
		expect(senza.phases[0].estimated).toBe(false);
		expect(senza.unconfigured.length).toBeGreaterThan(0);
		const park = PARK(); park[0].sqm_per_hour = 10; park[0].setup_minutes = 15; park[1].sqm_per_hour = 10; park[1].setup_minutes = 15;
		const con = routeOrder(order({ laminated: true, qty: 400, width_mm: 100, height_mm: 100 }), park);   // 4 m²
		expect(con.phases[0].estimated).toBe(true);
		expect(con.phases[0].minutes).toBe(15 + (4 / 10) * 60);   // formula: preparazione + area/m²h × 60 = 39
	});
	it('resinatrice: preparazione + pezzi × minuti/pezzo + pulizia', () => {
		const park = PARK(); park[6].setup_minutes = 10; park[6].minutes_per_piece = 0.5; park[6].cleanup_minutes = 15; park[6].passive_minutes = 8 * 60;
		const r = routeOrder(order({ product_slug: 'adesivi_resinati', qty: 100, width_mm: 25, height_mm: 25 }), park);
		expect(r.phases[2].minutes).toBe(10 + 50 + 15);
		expect(r.phases[3].wait_minutes).toBe(480);
	});
	it('taglio: il coefficiente di complessita\' pesa sulla durata', () => {
		const park = PARK(); park[4].minutes_per_sqm = 10; park[5].minutes_per_sqm = 10;
		const s = routeOrder(order({ qty: 400, width_mm: 100, height_mm: 100, complexity: 'semplice' }), park).phases.find((p) => p.capability === 'taglio')!.minutes;
		const c = routeOrder(order({ qty: 400, width_mm: 100, height_mm: 100, complexity: 'complesso' }), park).phases.find((p) => p.capability === 'taglio')!.minutes;
		expect(c).toBeGreaterThan(s);
	});
});

describe('calendario', () => {
	it('sabato, domenica e festivi non sono lavorativi; i giorni lavorativi si contano bene', () => {
		expect(isWorkingDay('2026-09-26', cal)).toBe(false);   // sabato
		expect(isWorkingDay('2026-09-27', cal)).toBe(false);   // domenica
		expect(isWorkingDay('2026-12-25', cal)).toBe(false);
		expect(isWorkingDay('2026-04-06', cal)).toBe(false);   // lunedi' dell'Angelo 2026
		expect(italianHolidays(2026)).toContain('2026-04-06');
		expect(shiftWorkDays('2026-09-25', 1, cal)).toBe('2026-09-28');   // venerdi' → lunedi'
		expect(isWorkingDay('2026-09-28', { ...cal, closures: [{ from: '2026-09-28', to: '2026-09-30', label: 'chiusura' }] })).toBe(false);
	});
	it('18. il lavoro salta il fine settimana', () => {
		const fri = T(2026, 9, 25, 16);   // venerdi' 16:00
		const end = addWork(fri, 180, cal);   // 3 ore: 1,5 oggi + 1,5 lunedi'
		const p = parts(end, cal.timezone);
		expect(`${p.y}-${p.m}-${p.d} ${p.h}:${p.min}`).toBe('2026-9-28 10:0');
		expect(workBetween(fri, end, cal)).toBe(180);
		const back = subWork(end, 180, cal);
		expect(back.getTime()).toBe(fri.getTime());
	});
	it('la pausa non conta come lavoro', () => {
		const c2 = { ...cal, break_start: '12:30', break_end: '13:30' };
		const end = addWork(T(2026, 9, 22, 12), 60, c2);
		const p = parts(end, c2.timezone);
		expect(`${p.h}:${p.min}`).toBe('14:0');
	});
	it('24. cambio ora legale/solare: le ore di lavoro restano ore intere', () => {
		// domenica 25/10/2026 si torna all'ora solare; venerdi' 23 → lunedi' 26
		const fri = T(2026, 10, 23, 17);
		const end = addWork(fri, 90, cal);   // 30 min venerdi', 60 lunedi'
		const p = parts(end, cal.timezone);
		expect(`${p.y}-${p.m}-${p.d} ${p.h}:${p.min}`).toBe('2026-10-26 9:30');
		expect(workBetween(fri, end, cal)).toBe(90);
		// e il 29/03/2026 (ora legale): la giornata di lavoro e' comunque 9 ore
		expect(workBetween(T(2026, 3, 30, 8, 30), T(2026, 3, 30, 17, 30), cal)).toBe(540);
	});
});

describe('pianificatore', () => {
	const now = T(2026, 9, 22, 9);   // martedi' 09:00
	it('pianificazione a ritroso: ultimo avvio utile prima della spedizione, fasi in ordine', () => {
		const ph = asPlan(order({ laminated: true }));
		const b = planBackward(ph, '2026-09-24', cal);
		expect(b.deadline.getTime()).toBe(T(2026, 9, 24, 16).getTime());   // ritiro 17:00 meno 60 min di margine
		for (let k = 1; k < ph.length; k++) expect(b.latest_start[k].getTime()).toBeGreaterThanOrEqual(b.latest_start[k - 1].getTime());
		expect(b.job_latest_start.getTime()).toBeLessThan(b.deadline.getTime());
	});
	it('10-12. due SG3 e due Graphtec: due commesse insieme vanno su macchine diverse, senza sovrapposizioni', () => {
		const park = PARK();
		const a = forecastForward(asPlan(order({ laminated: true }), park), '2026-09-30', cal, park, [], now, 'A');
		const b = forecastForward(asPlan(order({ laminated: true }), park), '2026-09-30', cal, park, a.busy, now, 'B');
		expect(a.machine_id[0]).not.toBe(b.machine_id[0]);
		expect(['SG3-1', 'SG3-2']).toContain(b.machine_id[0]);
		const cutA = a.machine_id.findIndex((m) => m?.startsWith('FC')), cutB = b.machine_id.findIndex((m) => m?.startsWith('FC'));
		expect(a.machine_id[cutA]).not.toBe(b.machine_id[cutB]);
		// nessuna sovrapposizione: per ogni macchina gli intervalli non si intersecano
		for (const m of park) {
			const iv = b.busy.filter((x) => x.machine_id === m.id).sort((x, y) => x.start.getTime() - y.start.getTime());
			for (let k = 1; k < iv.length; k++) expect(iv[k].start.getTime()).toBeGreaterThanOrEqual(iv[k - 1].end.getTime());
		}
	});
	it('12. con una sola laminatrice la seconda commessa aspetta la fine della prima', () => {
		const park = PARK();
		const a = forecastForward(asPlan(order({ laminated: true }), park), '2026-09-30', cal, park, [], now, 'A');
		const b = forecastForward(asPlan(order({ laminated: true }), park), '2026-09-30', cal, park, a.busy, now, 'B');
		const la = a.machine_id.indexOf('LAM-1'), lb = b.machine_id.indexOf('LAM-1');
		expect(b.planned_start[lb].getTime()).toBeGreaterThanOrEqual(a.planned_end[la].getTime());
	});
	it('17. una lavorazione lunga si distribuisce su piu\' giorni', () => {
		const park = PARK(); park[2].sqm_per_hour = 1; park[2].setup_minutes = 0;   // LG2 lentissima: 1 m²/h
		const ph = asPlan(order({ qty: 4000, width_mm: 100, height_mm: 100 }), park);   // 40 m² = 40 ore
		const f = forecastForward(ph, '2026-10-30', cal, park, [], now);
		const segs = splitByDays(f.planned_start[0], f.planned_end[0], cal);
		expect(segs.length).toBeGreaterThan(4);
		expect(segs.reduce((s, x) => s + x.minutes, 0)).toBe(40 * 60);
		expect(segs.every((s) => isWorkingDay(s.day, cal))).toBe(true);
	});
	it('19. la maturazione della resina e\' tempo di calendario e non occupa la resinatrice', () => {
		const park = PARK();
		const ph = asPlan(order({ product_slug: 'adesivi_resinati', width_mm: 25, height_mm: 25 }), park);
		const f = forecastForward(ph, '2026-09-30', cal, park, [], now);
		const k = ph.findIndex((p) => p.passive);
		expect(f.planned_end[k].getTime() - f.planned_start[k].getTime()).toBe(ph[k].wait_minutes * 60000);   // 12 h di orologio, notte compresa
		expect(f.busy.some((b) => b.machine_id === 'RES-1' && b.start.getTime() === f.planned_start[k].getTime())).toBe(false);
	});
	it('20-21. avviare tardi riduce il margine; oltre la data promessa → a rischio; scadenza passata → in ritardo', () => {
		const park = PARK();
		const ph = asPlan(order({ laminated: true }), park);
		const presto = forecastForward(ph, '2026-09-24', cal, park, [], T(2026, 9, 22, 9));
		const tardi = forecastForward(ph, '2026-09-24', cal, park, [], T(2026, 9, 23, 9));
		expect(tardi.slack_minutes).toBeLessThan(presto.slack_minutes);
		const oltre = forecastForward(ph, '2026-09-22', cal, park, [], T(2026, 9, 22, 15, 30));
		expect(oltre.risk).toBe('AT_RISK');
		expect(oltre.predicted_delay_minutes).toBeGreaterThan(0);
		const scaduto = forecastForward(ph, '2026-09-21', cal, park, [], T(2026, 9, 22, 9));
		expect(scaduto.risk).toBe('LATE');
		expect(presto.risk === 'ON_TRACK' || presto.risk === 'TIGHT').toBe(true);
	});
	it('22. fase completata: la previsione riparte dalle fasi aperte', () => {
		const park = PARK();
		const ph = asPlan(order({ laminated: true }), park);
		ph[0].status = 'completato'; ph[0].started_at = T(2026, 9, 22, 8, 30).toISOString(); ph[0].completed_at = T(2026, 9, 22, 8, 50).toISOString();
		const f = forecastForward(ph, '2026-09-24', cal, park, [], now);
		expect(f.planned_start[1].getTime()).toBeGreaterThanOrEqual(now.getTime());
		expect(f.busy.some((b) => b.machine_id?.startsWith('SG3'))).toBe(false);   // la stampa e' finita: non occupa piu' nulla
	});
	it('coda: ritardi, poi a rischio, poi ultimo avvio utile, poi data promessa', () => {
		const q = sortQueue([
			{ id: 'c', risk_status: 'ON_TRACK', latest_start_at: '2026-09-25T08:00:00Z', promised_ship_date: '2026-09-30', paid_at: '2026-09-20T10:00:00Z' },
			{ id: 'a', risk_status: 'LATE', latest_start_at: '2026-09-20T08:00:00Z', promised_ship_date: '2026-09-21', paid_at: '2026-09-18T10:00:00Z' },
			{ id: 'b', risk_status: 'AT_RISK', latest_start_at: '2026-09-22T08:00:00Z', promised_ship_date: '2026-09-23', paid_at: '2026-09-19T10:00:00Z' },
			{ id: 'd', risk_status: 'ON_TRACK', latest_start_at: '2026-09-23T08:00:00Z', promised_ship_date: '2026-09-29', paid_at: '2026-09-21T10:00:00Z' }
		] as const);
		expect(q.map((x) => x.id)).toEqual(['a', 'b', 'd', 'c']);
	});
});
