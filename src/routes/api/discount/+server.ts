import { json } from '@sveltejs/kit';
import { checkDiscount } from '$lib/server/discount';
import { isLocale } from '$lib/i18n';
import type { RequestHandler } from './$types';

/** POST { code, subtotalNet, email?, locale? }: i messaggi sono nella lingua indicata dalla pagina, altrimenti in quella del cookie */
export const POST: RequestHandler = async ({ request, locals: { supabase, locale, user } }) => {
	const { code, subtotalNet, email, locale: dalBrowser } = await request.json().catch(() => ({}));
	return json(await checkDiscount(supabase, String(code ?? ''), Number(subtotalNet ?? 0), email ? String(email) : null, isLocale(dalBrowser) ? dalBrowser : locale, user?.id ?? null));
};
