import { createHash } from 'node:crypto';
import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { isPrivatePath, isProductionHost } from '$lib/seo';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { LOCALE_COOKIE, detectLocale, isLocale } from '$lib/i18n';

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
const DASHBOARD_LOGIN = '/dashboard/login';

/** Lingua/valuta: dal cookie, altrimenti rilevata da paese e lingua del browser (modificabile dal footer) */
const locale: Handle = async ({ event, resolve }) => {
	const saved = event.cookies.get(LOCALE_COOKIE);
	if (isLocale(saved)) event.locals.locale = saved;
	else {
		event.locals.locale = detectLocale(event.request.headers.get('x-vercel-ip-country'), event.request.headers.get('accept-language'));
		event.cookies.set(LOCALE_COOKIE, event.locals.locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
	}
	return resolve(event);
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const path = event.url.pathname;

	/* Prove di stampa del vecchio sito (/proof/<token> nelle email di prima del cambio). Il vecchio sito e' ancora acceso
	   e ci si puo' ordinare: mandarci TUTTI i link vecchi ha fatto nascere due ordini la' (1/10/2026, clienti che hanno
	   riaperto un'email di prova gia' approvata). Ora ci va solo chi ha una prova ANCORA da approvare (elenco chiuso,
	   impronte dei token: il repository e' pubblico); tutti gli altri restano qui, nella loro area personale. */
	if (path.startsWith('/proof/')) {
		const token = path.slice(7).split('/')[0];
		const h = token ? createHash('sha256').update(token).digest('hex').slice(0, 24) : '';
		if (OPEN_LEGACY_PROOFS.has(h)) redirect(302, `https://stickerprint.pages.dev${path}${event.url.search}`);
		redirect(302, '/account/ordini');
	}

	if (!session && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
		redirect(303, `/login?next=${encodeURIComponent(path)}`);
	}
	// area amministratore: login dedicato
	if (!session && path.startsWith('/dashboard') && path !== DASHBOARD_LOGIN) {
		redirect(303, DASHBOARD_LOGIN);
	}
	// Stickerprint Studio: stesso login dell'area amministratore, poi si torna nello studio
	if (!session && path.startsWith('/studio') && !(dev && privateEnv.STUDIO_DEV_OPEN === '1')) {
		redirect(303, `${DASHBOARD_LOGIN}?next=${encodeURIComponent(path + event.url.search)}`);
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
	/* SEO: fuori dal dominio definitivo (anteprime Vercel, meett.it) e sulle pagine private niente indicizzazione */
	if (!isProductionHost(event.url.host) || isPrivatePath(event.url.pathname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
};

/** prove del vecchio sito ancora in attesa dell'approvazione del cliente al 2/10/2026 (SPIT00235, 270, 286, 306, 321, 337, 360, 361) */
const OPEN_LEGACY_PROOFS = new Set(['20147273cc8ab8b69eebbcb8', '28b067e47214272428591818', '7c7258e2bd828c6d93389e91', '90f4682156dcc304e4d9e564', '1bc9e664209f0025d5c2450b', '9f7ca5d2a91f0e5190fec332', '4648fe1d1325f20acb7b5883', '55ca1961fa661c86925b7038']);

export const handle = sequence(supabase, locale, authGuard, securityHeaders);
