/** Giorni e orari in Italia, senza librerie: la dashboard ragiona sempre in Europe/Rome. */
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
/** giorno di oggi (o di un istante) in Italia, yyyy-mm-dd */
export const giornoRoma = (d: Date = new Date()) => FMT.format(d);
/** scarto in minuti tra l'ora italiana e l'UTC in quell'istante (60 d'inverno, 120 d'estate) */
export function offsetRomaMinuti(d: Date): number {
	const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d);
	const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
	return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - d.getTime()) / 60000);
}
/** la mezzanotte italiana di un giorno (yyyy-mm-dd) come istante */
export function inizioGiornoRoma(giorno: string): Date {
	const base = new Date(`${giorno}T00:00:00Z`);
	return new Date(base.getTime() - offsetRomaMinuti(base) * 60000);
}
/** giorno + n (anche negativo), yyyy-mm-dd */
export function piuGiorni(giorno: string, n: number): string {
	const d = new Date(`${giorno}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}
/** gli ultimi n mesi (yyyy-mm) fino al mese dato compreso, dal piu' vecchio */
export function ultimiMesi(mese: string, n: number): string[] {
	const [y, m] = mese.split('-').map(Number);
	const out: string[] = [];
	for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(d.toISOString().slice(0, 7)); }
	return out;
}
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const meseBreve = (mese: string) => MESI_BREVI[Number(mese.slice(5, 7)) - 1];
export const meseLungo = (mese: string) => new Date(`${mese}-01T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
