import { fail } from '@sveltejs/kit';
import { saveRequest } from '$lib/server/requests';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const r = await saveRequest(supabase, 'support', f, { name: s('name'), email: s('email'), order_number: s('order_number'), message: s('message') });
		if (!r.ok) return fail(400, { error: r.error });
		return { ok: true };
	}
};
