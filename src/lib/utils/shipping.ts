/**
 * Data di spedizione stimata: N giorni lavorativi (lun–ven) a partire da oggi.
 * Coerente con quanto dichiara il sito attuale (3–5 gg dalla prova approvata).
 */
export function estimatedShipDate(businessDays = 5, from = new Date()): Date {
	const d = new Date(from);
	let added = 0;
	while (added < businessDays) {
		d.setDate(d.getDate() + 1);
		const day = d.getDay();
		if (day !== 0 && day !== 6) added++;
	}
	return d;
}

export function formatItDate(d: Date): string {
	return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
