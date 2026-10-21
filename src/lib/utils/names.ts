import type { Lang } from '$lib/i18n';
import { t, perLingua } from '$lib/traduzioni';

/** "Mattia Bianchi" → "Mattia B." (nome e iniziale del cognome, come nell'area personale o al checkout); senza nome: "Cliente verificato" nella lingua */
export function shortName(full: string | null | undefined, lang: Lang = 'it'): string {
	const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return t(perLingua(lang), 'recensioni.clienteVerificato');
	if (parts.length === 1) return parts[0];
	return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
