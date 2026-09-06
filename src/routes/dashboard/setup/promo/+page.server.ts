import { fail } from '@sveltejs/kit';
import { loadPromos, parseLines } from '$lib/server/promos';
import { loadEngine } from '$lib/server/pricing';
import { PRODUCT_ENGINES } from '$lib/pricing/engine';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const promos = await loadPromos(supabase, true);
	// materiali e finiture di ogni prodotto, per i menu a tendina dell'offerta
	const opzioni: Record<string, { materials: { id: string; label: string }[]; finishes: { id: string; label: string }[] }> = {};
	for (const e of PRODUCT_ENGINES) {
		const { config } = await loadEngine(supabase, e.slug);
		opzioni[e.slug] = { materials: config.materials.filter((m) => m.visible).map((m) => ({ id: m.id, label: m.label })), finishes: config.finishes.filter((f) => f.visible).map((f) => ({ id: f.id, label: f.label })) };
	}
	return { promos, opzioni };
};

function leggi(f: FormData) {
	const s = (k: string) => String(f.get(k) ?? '').trim();
	const num = (k: string) => { const v = Number(String(f.get(k) ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
	const qty = Math.round(num('qty') ?? 0);
	const price = num('price');
	if (!(qty > 0)) return { error: 'Inserisci la quantità di pezzi.' } as const;
	if (!(price !== null && price > 0)) return { error: 'Inserisci il prezzo dell\'offerta.' } as const;
	const ends = s('ends_at');
	return {
		row: {
			qty, price,
			price_normal: num('price_normal'),
			product_slug: s('product_slug') || 'adesivi_personalizzati',
			product_label: s('product_label') || 'adesivi personalizzati',
			subtitle: s('subtitle') || null,
			// fine giornata in Italia (21:59 UTC = 23:59 ora legale), cosi' la data non slitta al giorno dopo
			ends_at: ends ? new Date(ends + 'T21:59:59Z').toISOString() : null,
			forma: s('forma') || 'sagomato', materiale: s('materiale') || 'bianco', finitura: s('finitura') || null,
			chips: s('chips').split('\n').map((c) => c.trim()).filter(Boolean),
			includes: parseLines(s('includes'), ['label', 'normally']),
			perks: parseLines(s('perks'), ['label', 'saves']),
			save_text: s('save_text') || null,
			sizes: [],
			w_mm: num('w_mm') ?? 50, h_mm: num('h_mm') ?? num('w_mm') ?? 50,
			cta: s('cta') || 'Carica il file per continuare',
			sort: Math.round(num('sort') ?? 0),
			active: f.get('active') === 'on',
			updated_at: new Date().toISOString()
		}
	} as const;
}

export const actions: Actions = {
	save: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const r = leggi(f);
		if ('error' in r) return fail(400, { error: r.error });
		const id = String(f.get('id') ?? '');
		const q = id ? supabase.from('promos').update(r.row).eq('id', id) : supabase.from('promos').insert(r.row);
		const { error } = await q;
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	toggle: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('promos').update({ active: f.get('active') === 'true' }).eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	},
	delete: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const { error } = await supabase.from('promos').delete().eq('id', String(f.get('id')));
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
