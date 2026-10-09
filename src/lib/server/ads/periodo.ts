/** Periodi in date locali (yyyy-mm-dd): mai toISOString, che in Italia di notte torna il giorno prima. */
import { isoData, piuGiorni } from '$lib/marketing/formato';
export interface Periodo { da: string; a: string }
export function ultimiGiorni(n: number, fino = piuGiorni(new Date(), -1)): Periodo {
	return { da: isoData(piuGiorni(fino, -(n - 1))), a: isoData(fino) };
}
export function giorniDi(p: Periodo): string[] {
	const out: string[] = []; const fine = new Date(p.a + 'T12:00:00');
	for (let d = new Date(p.da + 'T12:00:00'); d <= fine; d = piuGiorni(d, 1)) out.push(isoData(d));
	return out;
}
export const nGiorni = (p: Periodo) => giorniDi(p).length;
export function periodoPrima(p: Periodo): Periodo {
	const n = nGiorni(p); const fine = piuGiorni(new Date(p.da + 'T12:00:00'), -1);
	return { da: isoData(piuGiorni(fine, -(n - 1))), a: isoData(fine) };
}
