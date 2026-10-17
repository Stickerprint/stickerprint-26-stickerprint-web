import { error, redirect } from '@sveltejs/kit';
import { gmailApiConfigurata, gmailApiMancanti, urlConsenso } from '$lib/server/posta/gmail-api';
import type { RequestHandler } from './$types';

/** "Collega Gmail": solo staff; manda alla schermata di consenso di Google e torna su /api/posta/gmail/callback */
export const GET: RequestHandler = async ({ url, cookies, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/dashboard/login');
	const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
	if (!p || !['admin', 'staff'].includes(p.role)) error(403, 'Solo lo staff');
	if (!gmailApiConfigurata()) error(500, `Su Vercel mancano ${gmailApiMancanti().join(', ')}`);
	const state = crypto.randomUUID();
	cookies.set('posta_gmail_state', state, { path: '/api/posta/gmail', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
	redirect(303, urlConsenso(url.origin, state));
};
