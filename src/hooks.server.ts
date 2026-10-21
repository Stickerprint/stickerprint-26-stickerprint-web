import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { isPrivatePath, isProductionHost } from '$lib/seo';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { LOCALES, LOCALE_COOKIE, PREVIEW_COOKIE, activeLocales, detectLocale, isLocale, isLocalizable, localeFromPath, localizePath, stripLocale } from '$lib/i18n';

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

/**
 * Lingua/valuta. Comanda il prefisso dell'URL (/de, /us...); senza prefisso vale la scelta fatta dal footer (cookie),
 * e chi ha scelto una lingua viene riportato sul percorso con il prefisso. Le lingue non ancora online (PUBLIC_LOCALES)
 * tornano all'italiano, salvo anteprima dello staff (cookie sp-locale-preview). Nessun redirect dal paese: il paese
 * e la lingua del browser decidono la lingua alla PRIMA visita (redirect, cookie) e danno il suggerimento (locals.localeSuggerito) per l'avviso in pagina.
 */
/** crawler e anteprime dei link: niente redirect per paese (Googlebot arriva dagli USA) */
const isBot = (ua: string | null) => /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless|curl\/|wget/i.test(ua ?? '');

const locale: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const anteprima = event.cookies.get(PREVIEW_COOKIE) === '1';
	const online = activeLocales();
	const ammessa = (c: string): c is App.Locals['locale'] => isLocale(c) && (c === 'it' || anteprima || online.includes(c));
	const { code: inUrl, rest } = localeFromPath(path);
	const salvata = event.cookies.get(LOCALE_COOKIE);
	const metti = (c: string) => { if (salvata !== c) event.cookies.set(LOCALE_COOKIE, c, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }); };
	if (inUrl) {
		// prefisso di una lingua non online: si torna all'italiano
		if (!ammessa(inUrl)) { metti('it'); redirect(302, rest + event.url.search); }
		/* slug italiano sotto un prefisso estero (/es/offerte): un solo URL per pagina, quello in lingua (/es/ofertas) */
		if (inUrl !== 'it' && event.request.method === 'GET') { const giusto = localizePath(rest, inUrl); if (giusto !== path && isLocalizable(rest)) redirect(301, giusto + event.url.search); }
		event.locals.locale = inUrl;
		metti(inUrl);
	} else {
		/* PRIMA VISITA senza prefisso (Mattia, 21/10/2026): chi arriva dalla Francia vede /fr, dagli USA /us, ecc. Si decide
		   una volta sola (paese dell'IP dato da Vercel, poi lingua del browser) e si scrive il cookie: da li' in poi comanda
		   la scelta dell'utente (footer). Mai per i crawler: Google scansiona dagli USA e deve vedere l'italiano con gli hreflang. */
		if (!salvata && isLocalizable(path) && event.request.method === 'GET' && !isBot(event.request.headers.get('user-agent'))) {
			const suggerito = detectLocale(event.request.headers.get('x-vercel-ip-country'), event.request.headers.get('accept-language'), anteprima ? undefined : online);
			/* il cookie si scrive solo quando si cambia lingua: chi resta sull'italiano senza averlo scelto viene rivalutato
			   alla visita dopo (es. da un altro paese); "Resta qui" e il footer scrivono la scelta esplicita via /set-locale */
			if (suggerito !== 'it' && ammessa(suggerito)) { metti(suggerito); redirect(302, localizePath(path, suggerito) + event.url.search); }
		}
		const scelta = salvata && ammessa(salvata) ? salvata : 'it';
		// chi ha scelto una lingua resta nella sua lingua anche cliccando un link senza prefisso
		if (scelta !== 'it' && isLocalizable(path) && event.request.method === 'GET') redirect(302, localizePath(path, scelta) + event.url.search);
		event.locals.locale = scelta;
		if (salvata && !ammessa(salvata)) metti('it');
	}
	event.locals.localeSuggerito = detectLocale(event.request.headers.get('x-vercel-ip-country'), event.request.headers.get('accept-language'), anteprima ? undefined : online);
	const lang = LOCALES[event.locals.locale].lang;
	return resolve(event, { transformPageChunk: ({ html }) => html.replace('<html lang="it">', `<html lang="${lang}">`) });
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	/* percorso senza prefisso di lingua e con lo slug interno (/de/konto → /account): le regole valgono in tutte le lingue;
	   i redirect tornano nella lingua della pagina */
	const path = stripLocale(event.url.pathname);
	const inLingua = (p: string) => localizePath(p, event.locals.locale ?? 'it');

	/* Prove di stampa del vecchio sito (/proof/<token> nelle email di prima del cambio). Il vecchio sito e' ancora acceso
	   e ci si puo' ordinare: mandarci TUTTI i link vecchi ha fatto nascere due ordini la' (1/10/2026, clienti che hanno
	   riaperto un'email di prova gia' approvata). Ora ci va solo chi ha una prova ANCORA da approvare (elenco chiuso,
	   impronte dei token: il repository e' pubblico); tutti gli altri restano qui, nella loro area personale. */
	if (path.startsWith('/proof/')) {
		const token = path.slice(7).split('/')[0];
		const h = token ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24) : '';
		if (OPEN_LEGACY_PROOFS.has(h)) redirect(302, `https://stickerprint.pages.dev${path}${event.url.search}`);
		redirect(302, inLingua('/account/ordini'));
	}

	if (!session && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
		redirect(303, `${inLingua('/login')}?next=${encodeURIComponent(inLingua(path))}`);
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
		redirect(303, inLingua('/account'));
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
