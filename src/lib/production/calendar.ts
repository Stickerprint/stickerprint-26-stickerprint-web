/**
 * Calendario di lavoro configurabile (fuso Europe/Rome con ora legale/solare, giorni lavorativi,
 * orario, pausa, festivita' fisse italiane + festivita' e chiusure impostate dall'amministratore).
 * Tutto il tempo "attivo" delle fasi scorre solo dentro l'orario di lavoro; il tempo passivo e' tempo di calendario.
 */
import type { Calendar } from './types';

export interface Parts { y: number; m: number; d: number; h: number; min: number; wd: number }   // wd: 1 = lunedi' ... 7 = domenica
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
	let f = fmtCache.get(tz);
	if (!f) { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }); fmtCache.set(tz, f); }
	return f;
}
/** componenti locali di un istante */
export function parts(d: Date, tz: string): Parts {
	const p: Record<string, string> = {};
	for (const x of fmt(tz).formatToParts(d)) p[x.type] = x.value;
	const wd = WD.indexOf(p.weekday);
	return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: wd === 0 ? 7 : wd };
}
/** istante da ora locale (giorni fuori range ammessi: d = 0 → mese prima); gestisce il cambio d'ora */
export function local(tz: string, y: number, m: number, d: number, h = 0, min = 0): Date {
	const guess = new Date(Date.UTC(y, m - 1, d, h, min));
	const p = parts(guess, tz);
	const off = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess.getTime();
	const r = new Date(guess.getTime() - off);
	// intorno al cambio d'ora la prima correzione puo' non bastare: seconda passata
	const q = parts(r, tz);
	if (q.h !== h || q.min !== min) { const off2 = Date.UTC(q.y, q.m - 1, q.d, q.h, q.min) - r.getTime(); return new Date(r.getTime() - off2); }
	return r;
}
export const isoDay = (d: Date, tz: string) => { const p = parts(d, tz); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
const dayNum = (s: string) => s.split('-').map(Number) as [number, number, number];

/** Pasqua (algoritmo di Gauss) per il lunedi' dell'Angelo */
function easter(y: number): [number, number] {
	const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
	return [month, day];
}
/** festivita' nazionali italiane (fisse + lunedi' dell'Angelo) */
export function italianHolidays(y: number): string[] {
	const fixed = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].map((s) => `${y}-${s}`);
	const [em, ed] = easter(y);
	const monday = new Date(Date.UTC(y, em - 1, ed + 1));
	return [...fixed, `${y}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`];
}
/** il giorno (YYYY-MM-DD) e' lavorativo? */
export function isWorkingDay(day: string, cal: Calendar): boolean {
	const [y, m, d] = dayNum(day);
	const wd = parts(local(cal.timezone, y, m, d, 12), cal.timezone).wd;
	if (!cal.working_days.includes(wd)) return false;
	if (italianHolidays(y).includes(day) || cal.holidays.includes(day)) return false;
	for (const c of cal.closures ?? []) if (c.from <= day && day <= c.to) return false;
	return true;
}
/** fasce di lavoro di un giorno in minuti dalla mezzanotte (una o due, se c'e' la pausa) */
function shifts(cal: Calendar): [number, number][] {
	const o = hm(cal.open_time), c = hm(cal.close_time);
	if (cal.break_start && cal.break_end) { const bs = hm(cal.break_start), be = hm(cal.break_end); if (o < bs && be < c) return [[o, bs], [be, c]]; }
	return [[o, c]];
}
const minutesOfDay = (d: Date, tz: string) => { const p = parts(d, tz); return p.h * 60 + p.min; };
function at(day: string, mod: number, tz: string): Date { const [y, m, d] = dayNum(day); return local(tz, y, m, d, Math.floor(mod / 60), mod % 60); }
function shiftDay(day: string, n: number, tz: string): string { const [y, m, d] = dayNum(day); return isoDay(local(tz, y, m, d + n, 12), tz); }

/** primo istante lavorativo >= d */
export function nextWorking(d: Date, cal: Calendar): Date {
	let day = isoDay(d, cal.timezone), mod = minutesOfDay(d, cal.timezone);
	for (let i = 0; i < 400; i++) {
		if (isWorkingDay(day, cal)) {
			for (const [a, b] of shifts(cal)) { if (mod < a) return at(day, a, cal.timezone); if (mod < b) return at(day, mod, cal.timezone); }
		}
		day = shiftDay(day, 1, cal.timezone); mod = 0;
	}
	return d;
}
/** ultimo istante lavorativo <= d */
export function prevWorking(d: Date, cal: Calendar): Date {
	let day = isoDay(d, cal.timezone), mod = minutesOfDay(d, cal.timezone);
	for (let i = 0; i < 400; i++) {
		if (isWorkingDay(day, cal)) {
			const sh = shifts(cal);
			for (let k = sh.length - 1; k >= 0; k--) { const [a, b] = sh[k]; if (mod > b) return at(day, b, cal.timezone); if (mod > a) return at(day, mod, cal.timezone); }
		}
		day = shiftDay(day, -1, cal.timezone); mod = 24 * 60;
	}
	return d;
}
/** aggiunge minuti di lavoro (salta notti, pause, giorni non lavorativi) */
export function addWork(from: Date, minutes: number, cal: Calendar): Date {
	let cur = nextWorking(from, cal);
	for (let i = 0; minutes > 0 && i < 1000; i++) {
		const day = isoDay(cur, cal.timezone), mod = minutesOfDay(cur, cal.timezone);
		const shift = shifts(cal).find(([a, b]) => mod >= a && mod < b);
		if (!shift) { cur = nextWorking(new Date(cur.getTime() + 60000), cal); continue; }
		const take = Math.min(shift[1] - mod, minutes);
		cur = at(day, mod + take, cal.timezone); minutes -= take;
		if (minutes > 0) cur = nextWorking(new Date(cur.getTime() + 60000), cal);
	}
	return cur;
}
/** toglie minuti di lavoro (a ritroso) */
export function subWork(from: Date, minutes: number, cal: Calendar): Date {
	let cur = prevWorking(from, cal);
	for (let i = 0; minutes > 0 && i < 1000; i++) {
		const day = isoDay(cur, cal.timezone), mod = minutesOfDay(cur, cal.timezone);
		const shift = shifts(cal).find(([a, b]) => mod > a && mod <= b);
		if (!shift) { cur = prevWorking(new Date(cur.getTime() - 60000), cal); continue; }
		const take = Math.min(mod - shift[0], minutes);
		cur = at(day, mod - take, cal.timezone); minutes -= take;
		if (minutes > 0) cur = prevWorking(new Date(cur.getTime() - 60000), cal);
	}
	return cur;
}
/** minuti di lavoro fra due istanti (0 se b precede a) */
export function workBetween(a: Date, b: Date, cal: Calendar): number {
	if (b <= a) return 0;
	let cur = nextWorking(a, cal), tot = 0;
	for (let i = 0; i < 1000 && cur < b; i++) {
		const day = isoDay(cur, cal.timezone), mod = minutesOfDay(cur, cal.timezone);
		const shift = shifts(cal).find(([x, y]) => mod >= x && mod < y);
		if (!shift) { cur = nextWorking(new Date(cur.getTime() + 60000), cal); continue; }
		const end = at(day, shift[1], cal.timezone);
		const seg = end < b ? end : b;
		tot += (seg.getTime() - cur.getTime()) / 60000;
		cur = nextWorking(new Date(seg.getTime() + 60000), cal);
	}
	return Math.round(tot);
}
/** n-esimo giorno lavorativo dopo (n > 0) o prima (n < 0) del giorno dato */
export function shiftWorkDays(day: string, n: number, cal: Calendar): string {
	let cur = day, step = n > 0 ? 1 : -1, left = Math.abs(n);
	for (let i = 0; left > 0 && i < 400; i++) { cur = shiftDay(cur, step, cal.timezone); if (isWorkingDay(cur, cal)) left--; }
	return cur;
}
/** ritiro del corriere nel giorno di spedizione, e termine entro cui l'ultima fase deve finire */
export function shipCutoff(day: string, cal: Calendar): Date { return at(day, hm(cal.ship_cutoff), cal.timezone); }
export function shipDeadline(day: string, cal: Calendar): Date { return new Date(shipCutoff(day, cal).getTime() - cal.ship_margin_minutes * 60000); }
/** data promessa di default: N giorni lavorativi dopo l'ordine (5, express 3) */
export function defaultPromise(createdIso: string, express: boolean, cal: Calendar): string { return shiftWorkDays(isoDay(new Date(createdIso), cal.timezone), express ? 3 : 5, cal); }
export const todayIso = (cal: Calendar, now = new Date()) => isoDay(now, cal.timezone);
export const dayOf = (d: Date | string, cal: Calendar) => isoDay(typeof d === 'string' ? new Date(d) : d, cal.timezone);
/** i giorni lavorativi che un intervallo tocca */
export function workingDaysBetween(a: Date, b: Date, cal: Calendar): string[] {
	const out: string[] = []; let day = isoDay(a, cal.timezone); const last = isoDay(b, cal.timezone);
	for (let i = 0; i < 400; i++) { if (isWorkingDay(day, cal)) out.push(day); if (day >= last) break; day = shiftDay(day, 1, cal.timezone); }
	return out;
}
