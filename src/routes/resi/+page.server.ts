import { fail } from '@sveltejs/kit';
import { saveRequest } from '$lib/server/requests';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		if (!s('order_number')) return fail(400, { error: 'Il numero d’ordine è obbligatorio.' });
		const file = f.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Allega almeno una foto del problema.' });
		const r = await saveRequest(supabase, 'reso', f, { email: s('email'), order_number: s('order_number'), message: s('message') });
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true };
	}
};
