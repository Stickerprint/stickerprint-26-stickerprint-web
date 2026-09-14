import { fail } from '@sveltejs/kit';
import { listTemplates } from '$lib/server/helpdesk';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => ({ templates: await listTemplates(supabase) });

export const actions: Actions = {
	salva: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const row = { title: String(f.get('title') ?? '').trim(), body: String(f.get('body') ?? '').trim(), sort: Number(f.get('sort')) || 0 };
		if (!row.title || !row.body) return fail(400, { error: 'Titolo e testo sono obbligatori.' });
		const { error } = id ? await supabase.from('reply_templates').update(row).eq('id', id) : await supabase.from('reply_templates').insert(row);
		return error ? fail(400, { error: error.message }) : { ok: true, message: 'Risposta salvata.' };
	},
	elimina: async ({ request, locals: { supabase } }) => {
		const { error } = await supabase.from('reply_templates').delete().eq('id', String((await request.formData()).get('id')));
		return error ? fail(400, { error: error.message }) : { ok: true, message: 'Risposta eliminata.' };
	}
};
