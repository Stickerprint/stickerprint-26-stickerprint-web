// Logo dell'header: versione stagionale in un intervallo di date (ora italiana), altrimenti quello standard.
const STAGIONALI: { from: string; to: string; src: string }[] = [
	// Halloween 2026: dal 7 ottobre al 31 ottobre compreso; dal 1° novembre torna il logo standard da solo.
	{ from: '2026-10-07', to: '2026-10-31', src: '/images/splogo-halloween-400.png' }
];
const STANDARD = '/images/splogo-400.png';
const giornoRoma = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(d); // YYYY-MM-DD
export function logoSrc(now = new Date()): string {
	const g = giornoRoma(now);
	return STAGIONALI.find((s) => g >= s.from && g <= s.to)?.src ?? STANDARD;
}
