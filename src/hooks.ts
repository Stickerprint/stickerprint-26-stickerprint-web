import type { Reroute } from '@sveltejs/kit';
import { localeFromPath } from '$lib/i18n';

/** /de/adesivi-personalizzati usa la stessa route di /adesivi-personalizzati: il prefisso della lingua si toglie qui, l'URL resta */
export const reroute: Reroute = ({ url }) => {
	const { code, rest } = localeFromPath(url.pathname);
	return code ? rest : undefined;
};
