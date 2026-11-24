import { error } from '@sveltejs/kit';
import pagina from '$lib/dashboard/simulatore-listino.html?raw';
import { loadListino } from '$lib/server/pricing';
import type { RequestHandler } from './$types';

/**
 * Il preventivatore unico (listino 2027) e' una pagina a se', mostrata in iframe da `/dashboard/preventivatori`.
 * Qui il server ci mette dentro il listino online; le modifiche tornano alla pagina con postMessage e
 * vanno online solo con il bottone Salva. Contiene costi e margini: solo staff (controllo qui, perche'
 * il layout della dashboard non protegge le route `+server`).
 */
export const GET: RequestHandler = async ({ locals: { supabase, user } }) => {
	if (!user) error(401, 'Accesso riservato');
	const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
	if (!profile || !['admin', 'staff'].includes(profile.role)) error(403, 'Accesso riservato');
	const { listino } = await loadListino(supabase);
	const json = JSON.stringify(listino).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
	const html = pagina.replace('/*__LISTINO__*/undefined', () => json);
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
};
