import { error, fail } from '@sveltejs/kit';
import { groupOrders, type OrderRow } from '$lib/dashboard/orders';
import { contestoMargini, indiceFatture, margineOrdine, COLONNE_FATTURA, type FatturaMargine } from '$lib/server/margini';
import { pianoRiga, leggiRiga, slugListino, PARAMETRI, COSTO_SPEDIZIONE_NETTO } from '$lib/margini/costi';
import type { Strip } from '$lib/studio/layout';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f-]{36}$/i;
async function righe(supabase: App.Locals['supabase'], key: string): Promise<OrderRow[]> {
	const { data } = await supabase.from('orders').select('*').eq('checkout_group', key);
	if (data?.length) return data as OrderRow[];
	if (!UUID.test(key)) return [];
	const { data: uno } = await supabase.from('orders').select('*').eq('id', key);
	return (uno ?? []) as OrderRow[];
}

/** striscia da disegnare: solo quello che serve all'SVG */
export interface Disegno { w: number; h: number; pezzi: { x: number; y: number; w: number; h: number }[]; fogli: { x: number; y: number; w: number; h: number }[]; forma: string }
function disegno(st: Strip | undefined, pw: number, ph: number, forma: string, fogliMode: boolean): Disegno | null {
	if (!st) return null;
	const r1 = (v: number) => Math.round(v * 10) / 10;
	return {
		w: r1(st.w), h: r1(st.h), forma,
		/* i pezzi girati occupano ph × pw (nei fogli la rotazione e' rispetto al foglio) */
		pezzi: st.pieces.slice(0, 4000).map((p) => { const rot = fogliMode ? p.rot : false; return { x: r1(p.x), y: r1(p.y), w: r1(rot ? ph : pw), h: r1(rot ? pw : ph) }; }),
		fogli: (st.sheets ?? []).map((s) => ({ x: r1(s.x), y: r1(s.y), w: r1(s.w), h: r1(s.h) }))
	};
}

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const rows = await righe(supabase, params.key);
	if (!rows.length) error(404, 'Ordine non trovato');
	const g = groupOrders(rows)[0];
	const [ctx, { data: perGruppo }, { data: perNumero }] = await Promise.all([
		contestoMargini(supabase),
		supabase.from('invoices').select(COLONNE_FATTURA).eq('checkout_group', g.key).limit(3),
		supabase.from('invoices').select(COLONNE_FATTURA).overlaps('order_numbers', g.numbers).limit(3)
	]);
	const ordine = margineOrdine(g, ctx, indiceFatture([...(perGruppo ?? []), ...(perNumero ?? [])] as FatturaMargine[])(g));

	/* impaginazione da disegnare per ogni riga prodotto con la misura */
	const disegni: Record<string, { prima: Disegno | null; ultima: Disegno | null; strisce: number; cavallotti: Disegno | null }> = {};
	for (const i of g.items) {
		const slug = slugListino(i.product_slug);
		const cfg = ctx.engines[slug === 'kit_adesivi' ? 'adesivi_personalizzati' : slug];
		if (!cfg) continue;
		const lett = leggiRiga(i, cfg, i.product_code ? ctx.codici.get(i.product_code.toUpperCase()) : null);
		if (!lett) continue;
		const pi = pianoRiga(slug, lett.w, lett.h, Math.max(1, i.qty), i.forma ?? '');
		if (!pi.ok) continue;
		const fogli = pi.modo === 'fogli';
		const n = pi.strips.length;
		disegni[i.id] = {
			prima: disegno(pi.strips[0], pi.pw, pi.ph, lett.forma, fogli),
			ultima: n > 1 ? disegno(pi.strips[n - 1], pi.pw, pi.ph, lett.forma, fogli) : null,
			strisce: n,
			cavallotti: pi.cavallotti ? disegno(pi.cavallotti.strips[0], 80, 40, 'rettangolare', false) : null
		};
	}
	/* scelte per completare le righe dei manuali */
	const scelte = Object.fromEntries(Object.entries(ctx.engines).map(([slug, cfg]) => [slug, {
		forme: cfg.shapes.filter((s) => s.visible).map((s) => ({ id: s.id, label: s.label })),
		materiali: cfg.materials.filter((m) => m.visible).map((m) => ({ id: m.id, label: m.label }))
	}]));
	return { ordine, disegni, scelte, parametri: { bobina: PARAMETRI.bobina.width, scarto: PARAMETRI.scarto, spedizione: COSTO_SPEDIZIONE_NETTO } };
};

export const actions: Actions = {
	/** completa misura, sagoma e materiale di una riga (ordini manuali: di solito stanno solo nella descrizione) */
	completa: async ({ request, params, locals: { supabase } }) => {
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const rows = await righe(supabase, params.key);
		const row = rows.find((r) => r.id === id);
		if (!row) return fail(404, { error: 'Riga non trovata.' });
		const w = Number(String(f.get('w') ?? '').replace(',', '.')), h = Number(String(f.get('h') ?? '').replace(',', '.'));
		if (!(w > 0 && w <= 5000 && h > 0 && h <= 5000)) return fail(400, { error: 'Misura non valida: scrivi larghezza e altezza in millimetri.', id });
		const forma = String(f.get('forma') ?? '').trim() || null, materiale = String(f.get('materiale') ?? '').trim() || null;
		const { error: e } = await supabase.from('orders').update({ width_mm: w, height_mm: h, forma, materiale }).eq('id', id);
		if (e) return fail(400, { error: e.message, id });
		return { ok: true, id, message: `${row.number}: misura ${w}×${h} mm${materiale ? ', ' + materiale : ''} salvata. Consumo ricalcolato.` };
	}
};
