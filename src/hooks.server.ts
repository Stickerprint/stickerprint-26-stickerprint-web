import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * 1) Crea un client Supabase per ogni richiesta, con sessione letta/scritta nei cookie.
 */
const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	/**
	 * getSession() legge il cookie senza validarlo; getUser() lo verifica sul server Supabase.
	 * Usiamo entrambi così la sessione restituita è sempre affidabile.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/**
 * 2) Protezione delle route: area cliente (/account) e futura area interna (/admin).
 */
const PROTECTED_PREFIXES = ['/account', '/admin'];
const GUEST_ONLY = ['/login', '/signup'];

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const path = event.url.pathname;

	if (!session && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
		redirect(303, `/login?next=${encodeURIComponent(path)}`);
	}
	if (session && GUEST_ONLY.includes(path)) {
		redirect(303, '/account');
	}

	return resolve(event);
};

/**
 * 3) Header di sicurezza (mancavano nel sito attuale).
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
	return response;
};

export const handle = sequence(supabase, authGuard, securityHeaders);
