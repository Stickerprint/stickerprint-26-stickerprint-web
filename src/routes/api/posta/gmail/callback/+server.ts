import { redirect } from '@sveltejs/kit';
import { adminClient } from '$lib/server/admin';
import { completaCollegamento } from '$lib/server/posta/gmail-api';
import type { RequestHandler } from './$types';

/** ritorno da Google dopo il "Consenti": salva il permesso e torna alla pagina Posta */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const back = (q: string): never => redirect(303, `/dashboard/richieste/posta?${q}`);
	const state = cookies.get('posta_gmail_state');
	cookies.delete('posta_gmail_state', { path: '/api/posta/gmail' });
	if (url.searchParams.get('error')) back(`gmail=errore&msg=${encodeURIComponent(url.searchParams.get('error')!)}`);
	if (!state || state !== url.searchParams.get('state')) back('gmail=errore&msg=stato+non+valido');
	const code = url.searchParams.get('code');
	const db = adminClient();
	if (!code || !db) back('gmail=errore&msg=codice+o+chiave+di+servizio+mancante');
	const r = await completaCollegamento(db!, url.origin, code!);
	if (!r.ok) back(`gmail=errore&msg=${encodeURIComponent(r.errore)}`);
	return back(`gmail=ok&email=${encodeURIComponent((r as { email: string }).email)}`);
};
