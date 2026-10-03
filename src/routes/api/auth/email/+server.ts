import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { sendEmail } from '$lib/server/email';
import { authEmail, type AuthMailKind } from '$lib/server/email-templates';
import type { RequestHandler } from './$types';

/**
 * Hook "Send Email" di Supabase Auth: invece del mailer di Supabase (mittente generico, finisce in spam, pochi invii l'ora)
 * le email di conferma account, reset password, magic link e cambio email le manda il sito con Postmark.
 * Supabase chiama questo endpoint firmando il corpo (Standard Webhooks); il segreto sta in SUPABASE_AUTH_HOOK_SECRET.
 * Il link porta a /auth/callback?token_hash=...&type=..., che verifica il codice e fa entrare il cliente.
 */
const SITE = PUBLIC_SITE_URL || 'https://stickerprint.it';

async function firmaValida(req: Request, body: string): Promise<boolean> {
	const secret = (env.SUPABASE_AUTH_HOOK_SECRET || '').trim();
	if (!secret) return false;
	const id = req.headers.get('webhook-id') ?? '', ts = req.headers.get('webhook-timestamp') ?? '', sigs = req.headers.get('webhook-signature') ?? '';
	if (!id || !ts || !sigs) return false;
	if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5 minuti di tolleranza
	const raw = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
	const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
	const atteso = btoa(String.fromCharCode(...new Uint8Array(mac)));
	return sigs.split(' ').some((s) => s.replace(/^v1,/, '') === atteso);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	if (!(await firmaValida(request, body))) return json({ error: { http_code: 401, message: 'firma non valida' } }, { status: 401 });
	let p: { user?: { email?: string; user_metadata?: Record<string, unknown>; new_email?: string }; email_data?: { token?: string; token_hash?: string; redirect_to?: string; email_action_type?: string; token_new?: string; token_hash_new?: string } };
	try { p = JSON.parse(body); } catch { return json({ error: { http_code: 400, message: 'json non valido' } }, { status: 400 }); }
	const email = p.user?.email, d = p.email_data ?? {};
	if (!email || !d.email_action_type) return json({ error: { http_code: 400, message: 'dati mancanti' } }, { status: 400 });
	const kind = (['signup', 'recovery', 'magiclink', 'email_change', 'invite', 'reauthentication', 'email'].includes(d.email_action_type) ? d.email_action_type : 'signup') as AuthMailKind;
	// il link torna sul sito: /auth/callback verifica token_hash+type (il redirect_to del sito contiene gia' ?next=...)
	const base = d.redirect_to && d.redirect_to.startsWith(SITE) ? d.redirect_to : `${SITE}/auth/callback`;
	const type = kind === 'email' ? 'signup' : kind;
	const href = `${base}${base.includes('?') ? '&' : '?'}token_hash=${encodeURIComponent(d.token_hash ?? '')}&type=${encodeURIComponent(type)}`;
	const meta = p.user?.user_metadata ?? {};
	const name = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (typeof meta.full_name === 'string' ? meta.full_name : null);
	// cambio email: la conferma va al NUOVO indirizzo
	const to = kind === 'email_change' && p.user?.new_email ? p.user.new_email : email;
	const mail = authEmail(kind, { name, email, href, code: d.token ?? null, newEmail: p.user?.new_email ?? null });
	const r = await sendEmail({ to, subject: mail.subject, html: mail.html, tag: mail.tag });
	if (!r.ok) { console.error('[auth email] invio fallito', r); return json({ error: { http_code: 500, message: 'invio fallito' } }, { status: 500 }); }
	return json({});
};
