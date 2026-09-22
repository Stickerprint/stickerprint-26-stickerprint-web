/** Formati per le pagine di produzione (e per il resto della dashboard): orari in Europe/Rome, durate, "oggi/domani". */
import { isoDay, shiftWorkDays } from './calendar';
import { DEFAULT_CALENDAR, type Calendar } from './types';
const TZ = 'Europe/Rome';
export function fmtMin(min: number | null | undefined): string {
	if (min == null) return '—';
	const v = Math.round(min);
	if (v < 60) return `${v} min`;
	const h = Math.floor(v / 60), m = v % 60;
	if (h >= 48) { const d = Math.floor(h / 24); return `${d} g ${h % 24 ? (h % 24) + ' h' : ''}`.trim(); }
	return m ? `${h} h ${m} min` : `${h} h`;
}
const fTime = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fDayShort = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fDayLong = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
export const fmtTime = (d: Date | string | null) => (d ? fTime.format(new Date(d)) : '—');
/** "oggi alle 16:00", "domani alle 10:30", "gio 18/09 alle 09:00" */
export function fmtWhen(d: Date | string | null | undefined, now = new Date(), cal: Calendar = DEFAULT_CALENDAR): string {
	if (!d) return '—';
	const x = typeof d === 'string' ? new Date(d) : d;
	const day = isoDay(x, TZ), today = isoDay(now, TZ);
	const t = fTime.format(x);
	if (day === today) return `oggi alle ${t}`;
	if (day === shiftWorkDays(today, 1, cal) || day === isoDay(new Date(now.getTime() + 864e5), TZ)) return `domani alle ${t}`;
	return `${fDayShort.format(x)} alle ${t}`;
}
export function fmtDay(day: string | null | undefined, now = new Date(), cal: Calendar = DEFAULT_CALENDAR): string {
	if (!day) return '—';
	const today = isoDay(now, TZ);
	if (day === today) return 'oggi';
	if (day === shiftWorkDays(today, 1, cal)) return 'domani';
	const [y, m, d] = day.split('-').map(Number);
	return fDayLong.format(new Date(Date.UTC(y, m - 1, d, 12)));
}
export function fmtAgo(d: string | Date | null | undefined, now = new Date()): string {
	if (!d) return '—';
	const min = Math.max(0, (now.getTime() - new Date(d).getTime()) / 60000);
	if (min < 60) return `${Math.round(min)} min fa`;
	if (min < 48 * 60) return `${Math.round(min / 60)} h fa`;
	return `${Math.round(min / 1440)} giorni fa`;
}
/** "tra 2 h 10 min" / "2 h 10 min fa" */
export function fmtIn(d: string | Date | null | undefined, now = new Date()): string {
	if (!d) return '—';
	const diff = (new Date(d).getTime() - now.getTime()) / 60000;
	return diff >= 0 ? `tra ${fmtMin(diff)}` : `${fmtMin(-diff)} fa`;
}
