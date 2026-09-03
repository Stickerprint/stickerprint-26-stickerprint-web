import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const [{ data: profile }, { data: addresses }] = await Promise.all([
		supabase.from('profiles').select('full_name, phone, company_name, vat_number, fiscal_code, sdi_code, pec, email').eq('id', user!.id).maybeSingle(),
		supabase.from('addresses').select('*').eq('user_id', user!.id).order('is_default', { ascending: false }).order('created_at')
	]);
	return { profile, addresses: addresses ?? [] };
};

export const actions: Actions = {
	profile: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim() || null;
		const { error } = await supabase.from('profiles').update({ full_name: s('full_name'), phone: s('phone'), company_name: s('company_name'), vat_number: s('vat_number'), fiscal_code: s('fiscal_code'), sdi_code: s('sdi_code'), pec: s('pec') }).eq('id', user!.id);
		if (error) return fail(400, { error: error.message });
		return { ok: 'profile' };
	},
	address: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const s = (k: string) => String(f.get(k) ?? '').trim();
		const row = { user_id: user!.id, kind: s('kind') === 'billing' ? 'billing' : 'shipping', label: s('label') || null, first_name: s('first_name'), last_name: s('last_name'), company: s('company') || null, street: s('street'), city: s('city'), zip: s('zip'), province: s('province').toUpperCase().slice(0, 2), country: s('country') || 'IT', phone: s('phone') || null, is_default: f.get('is_default') === 'on' };
		if (!row.first_name || !row.last_name || !row.street || !row.city || !row.zip || !row.province) return fail(400, { error: 'Compila nome, cognome, via, città, CAP e provincia.' });
		if (row.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', user!.id).eq('kind', row.kind);
		const { error } = await supabase.from('addresses').insert(row);
		if (error) return fail(400, { error: error.message });
		return { ok: 'address' };
	},
	remove: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		await supabase.from('addresses').delete().eq('id', String(f.get('id'))).eq('user_id', user!.id);
		return { ok: 'remove' };
	}
};
