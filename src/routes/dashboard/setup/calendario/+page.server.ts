import { fail } from '@sveltejs/kit';
import { isAdmin, loadSetup, recalcAll, saveCalendar } from '$lib/server/produzione';
import { italianHolidays } from '$lib/production/calendar';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const { calendar } = await loadSetup(supabase);
	const y = new Date().getFullYear();
	return { calendar, fixed: [...italianHolidays(y), ...italianHolidays(y + 1)], admin: await isAdmin(supabase, user) };
};
export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!(await isAdmin(locals.supabase, locals.user))) return fail(403, { error: 'Solo l’amministratore può modificare il calendario.' });
		const err = await saveCalendar(locals.supabase, await request.formData());
		if (err) return fail(400, { error: err });
		await recalcAll(locals.supabase);
		return { ok: true, message: 'Calendario salvato: pianificazione ricalcolata.' };
	}
};
