// Logo dell'header: versione stagionale in un intervallo di date (ora italiana), altrimenti quello standard.
const STAGIONALI: { from: string; to: string; src: string }[] = [
	// Halloween 2026: dal 7 ottobre al 31 ottobre compreso; dal 1° novembre torna il logo standard da solo.
	{ from: '2026-10-07', to: '2026-10-31', src: '/images/splogo-halloween-400.png' },
	// Logo «VI» (Mattia, 10/11/2026): fino al 30 novembre compreso.
	{ from: '2026-11-10', to: '2026-11-30', src: '/images/splogo-vi-400.png' }
	// Natale: dal 1° dicembre, appena arriva il file del logo natalizio (aggiungere qui la riga con from '2026-12-01').
];
const STANDARD = '/images/splogo-400.png';
const giornoRoma = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(d); // YYYY-MM-DD
export function logoSrc(now = new Date()): string {
	const g = giornoRoma(now);
	return STAGIONALI.find((s) => g >= s.from && g <= s.to)?.src ?? STANDARD;
}
