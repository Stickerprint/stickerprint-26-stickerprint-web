import { fail } from '@sveltejs/kit';
import { loadCustomers } from '$lib/server/customers';
import { upsertContact } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => ({ customers: await loadCustomers(supabase) });

export const actions: Actions = {
	/** Nuova anagrafica inserita a mano */
	create: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const r = await upsertContact(supabase, { name: s('name'), first_name: s('first_name'), last_name: s('last_name'), address: s('address'), city: s('city'), cap: s('cap'), province: s('province'), country: s('country') || 'IT', piva: s('piva'), cf: s('cf'), sdi: s('sdi'), pec: s('pec'), email: s('email'), phone: s('phone') });
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, created: r.id };
	}
};
