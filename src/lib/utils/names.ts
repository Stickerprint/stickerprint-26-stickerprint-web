/** "Mattia Bianchi" → "Mattia B." (nome e iniziale del cognome, come nell'area personale o al checkout) */
export function shortName(full: string | null | undefined): string {
	const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return 'Cliente verificato';
	if (parts.length === 1) return parts[0];
	return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
