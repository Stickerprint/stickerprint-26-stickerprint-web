import { fail, redirect } from '@sveltejs/kit';
import { duplicateMachine, isAdmin, loadSetup, machineFromForm, recalcAll, removeMachine, saveMachine, saveProfile, setMachineActive } from '$lib/server/produzione';
import type { Actions, PageServerLoad } from './$types';

/** Setup → Macchinari: il parco macchine con i parametri produttivi (solo amministratore per le modifiche) */
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	const setup = await loadSetup(supabase);
	const { data: used } = await supabase.from('production_tasks').select('machine_id').not('machine_id', 'is', null);
	const usedIds = new Set((used ?? []).map((u) => u.machine_id as string));
	return { ...setup, usedIds: [...usedIds], admin: await isAdmin(supabase, user) };
};
const guard = async (locals: App.Locals) => { if (!(await isAdmin(locals.supabase, locals.user))) return fail(403, { error: 'Solo l’amministratore può modificare i macchinari.' }); return null; };
export const actions: Actions = {
	save: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		const f = await request.formData();
		const id = String(f.get('id') ?? '') || null;
		const r = await saveMachine(locals.supabase, id, machineFromForm(f));
		if (r.error) return fail(400, { error: r.error });
		await recalcAll(locals.supabase);   // velocita' o stato cambiati → le stime si ricalcolano
		return { ok: true, message: id ? 'Macchinario aggiornato: stime ricalcolate.' : 'Macchinario aggiunto.' };
	},
	duplica: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		const r = await duplicateMachine(locals.supabase, String((await request.formData()).get('id')));
		if (r.error) return fail(400, { error: r.error });
		return { ok: true, message: 'Copia creata (disattivata): rinominala e attivala quando è pronta.' };
	},
	attiva: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		const f = await request.formData();
		const err = await setMachineActive(locals.supabase, String(f.get('id')), f.get('on') === '1');
		if (err) return fail(400, { error: err });
		await recalcAll(locals.supabase);
		return { ok: true, message: f.get('on') === '1' ? 'Macchinario attivato.' : 'Macchinario disattivato: non riceve più lavori.' };
	},
	rimuovi: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		const r = await removeMachine(locals.supabase, String((await request.formData()).get('id')));
		if (r.error) return fail(400, { error: r.error });
		await recalcAll(locals.supabase);
		return { ok: true, message: r.archived ? 'Macchinario archiviato: era già nella cronologia di produzione, le vecchie commesse continuano a mostrarlo.' : 'Macchinario eliminato.' };
	},
	profilo: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		const f = await request.formData();
		const err = await saveProfile(locals.supabase, String(f.get('machine_id')), String(f.get('id') ?? '') || null, f);
		if (err) return fail(400, { error: err });
		await recalcAll(locals.supabase);
		return { ok: true, message: 'Profilo salvato.' };
	},
	profiloElimina: async ({ request, locals }) => {
		const g = await guard(locals); if (g) return g;
		await locals.supabase.from('production_machine_profiles').delete().eq('id', String((await request.formData()).get('id')));
		await recalcAll(locals.supabase);
		return { ok: true, message: 'Profilo eliminato.' };
	}
};
