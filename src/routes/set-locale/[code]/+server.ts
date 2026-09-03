import { redirect } from '@sveltejs/kit';
import { LOCALE_COOKIE, isLocale } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** Scelta manuale di lingua e valuta dal footer */
export const GET: RequestHandler = ({ params, cookies, request }) => {
	if (isLocale(params.code)) cookies.set(LOCALE_COOKIE, params.code, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
	const back = request.headers.get('referer');
	redirect(303, back && back.startsWith(new URL(request.url).origin) ? back : '/');
};
