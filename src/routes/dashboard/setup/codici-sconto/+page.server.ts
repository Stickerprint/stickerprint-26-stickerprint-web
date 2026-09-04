import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: codes, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
	return { codes: codes ?? [], dbError: error?.message ?? null };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, user } }) => {
		const f = await request.formData();
		const code = String(f.get('code') ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
		const kind = f.get('kind') === 'fixed' ? 'fixed' : 'percent';
		const value = Number(f.get('value'));
		const min_order = Number(f.get('min_order') || 0);
		const max_uses = f.get('max_uses') ? Number(f.get('max_uses')) : null;
		const valid_from = f.get('valid_from') ? new Date(String(f.get('valid_from'))).toISOString() : null;
		const valid_to = f.get('valid_to') ? new Date(String(f.get('valid_to'))).toISOString() : null;
		const description = String(f.get('description') ?? '').trim() || null;

		if (code.length < 3) return fail(400, { error: 'Il codice deve avere almeno 3 caratteri (lettere e numeri).' });
		if (!(value > 0)) return fail(400, { error: 'Inserisci un valore maggiore di zero.' });
		if (kind === 'percent' && value > 100) return fail(400, { error: 'La percentuale non può superare 100.' });

		const { error } = await supabase.from('discount_codes').insert({ code, kind, value, min_order, max_uses, valid_from, valid_to, description, created_by: user?.id });
		if (error) return fail(400, { error: error.code === '23505' ? 'Esiste già un codice con questo nome.' : error.message });
		return { ok: true };
	},
	toggle: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		const active = f.get('active') === 'true';
		const { error } = await supabase.from('discount_codes').update({ active }).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('discount_codes').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
