import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/admin';
import { elabora } from '$lib/server/bot/conversazioni';
import type { RequestHandler } from './$types';

/**
 * Chat dell'assistente sul sito: POST { sessione, messaggio }.
 * Finché BOT_SITE non è "on" risponde solo allo staff loggato (serve per provare il bot online senza esporlo).
 */
export const POST: RequestHandler = async ({ request, url, locals: { supabase, user } }) => {
	const db = adminClient();
	if (!db) return json({ errore: 'bot non configurato' }, { status: 503 });
	if (env.BOT_SITE !== 'on') {
		if (!user) return json({ errore: 'chat non ancora attiva' }, { status: 403 });
		const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
		if (!p || !['admin', 'staff'].includes(p.role)) return json({ errore: 'chat non ancora attiva' }, { status: 403 });
	}
	const b = (await request.json().catch(() => null)) as { sessione?: string; messaggio?: string } | null;
	const sessione = String(b?.sessione ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
	const messaggio = String(b?.messaggio ?? '').trim().slice(0, 2000);
	if (!sessione || !messaggio) return json({ errore: 'messaggio vuoto' }, { status: 400 });
	const t0 = Date.now();
	const r = await elabora(db, { canale: 'sito', externalId: sessione, testo: messaggio, origin: url.origin });
	return json({ risposta: r.risposta, passata: r.conv.handed_off, ms: Date.now() - t0 });
};
