import { json } from '@sveltejs/kit';
import { LOCALE_COOKIE, activeLocales, detectLocale } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** diagnostica del redirect per paese: cosa vede il server per questa richiesta (nessun dato sensibile) */
export const GET: RequestHandler = ({ request, cookies, locals }) => {
	const paese = request.headers.get('x-vercel-ip-country');
	const lingue = request.headers.get('accept-language');
	return json({
		paese_ip: paese,
		citta_ip: request.headers.get('x-vercel-ip-city'),
		lingue_browser: lingue,
		cookie_lingua: cookies.get(LOCALE_COOKIE) ?? null,
		lingue_online: activeLocales(),
		lingua_suggerita: detectLocale(paese, lingue, activeLocales()),
		lingua_pagina: locals.locale,
		user_agent: request.headers.get('user-agent')
	}, { headers: { 'cache-control': 'no-store' } });
};
