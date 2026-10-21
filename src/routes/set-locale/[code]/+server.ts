import { redirect } from '@sveltejs/kit';
import { LOCALE_COOKIE, PREVIEW_COOKIE, isLocale, localizePath } from '$lib/i18n';
import type { RequestHandler } from './$types';

/**
 * Scelta di lingua e valuta dal footer: cookie + ritorno alla stessa pagina nella lingua scelta.
 * /set-locale/anteprima accende l'anteprima delle lingue non ancora online (per lo staff); /set-locale/fine la spegne.
 */
export const GET: RequestHandler = ({ params, cookies, request, url }) => {
	const origin = new URL(request.url).origin;
	const back = request.headers.get('referer');
	const torna = url.searchParams.get('torna');
	const backPath = torna && torna.startsWith('/') && !torna.startsWith('//') ? torna : back && back.startsWith(origin) ? new URL(back).pathname : '/';
	if (params.code === 'anteprima') { cookies.set(PREVIEW_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' }); redirect(303, backPath); }
	if (params.code === 'fine') { cookies.delete(PREVIEW_COOKIE, { path: '/' }); cookies.set(LOCALE_COOKIE, 'it', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }); redirect(303, '/'); }
	if (!isLocale(params.code)) redirect(303, backPath);
	cookies.set(LOCALE_COOKIE, params.code, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
	redirect(303, localizePath(backPath, params.code));
};
