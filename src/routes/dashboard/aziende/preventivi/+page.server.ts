import { fail } from '@sveltejs/kit';
import { listQuotes, remindDueQuotes, remindQuote } from '$lib/server/richieste';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	remindDueQuotes(supabase, url.origin).catch(() => {}); // solleciti automatici (anche dal cron giornaliero)
	const year = Number(url.searchParams.get('anno')) || new Date().getFullYear();
	return { year, quotes: await listQuotes(supabase, year) };
};

export const actions: Actions = {
	sollecita: async ({ request, url, locals: { supabase } }) => {
		const r = await remindQuote(supabase, String((await request.formData()).get('id')), url.origin);
		return r.ok ? { ok: true, message: r.message } : fail(400, { error: r.message });
	}
};
