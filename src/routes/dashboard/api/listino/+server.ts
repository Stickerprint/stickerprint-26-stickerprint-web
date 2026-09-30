import { json } from '@sveltejs/kit';
import { loadEngine } from '$lib/server/pricing';
import { quoteWith, PRODUCT_ENGINES } from '$lib/pricing/engine';
import type { RequestHandler } from './$types';

/** Prezzo dal listino del sito per una riga di ordine/preventivo (solo staff: la route sta sotto /dashboard).
    Ritorna il prezzo unitario netto e il totale, piu' le opzioni disponibili per il prodotto (per le tendine). */
export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	const b = await request.json().catch(() => ({}));
	const slug = String(b.product ?? '');
	if (!PRODUCT_ENGINES.some((p) => p.slug === slug)) return json({ error: 'Prodotto non nel listino' }, { status: 400 });
	const { config: cfg } = await loadEngine(supabase, slug);
	const opts = {
		shapes: cfg.shapes.filter((s) => s.visible).map((s) => ({ id: s.id, label: s.label })),
		materials: cfg.materials.filter((m) => m.visible).map((m) => ({ id: m.id, label: m.label })),
		finishes: cfg.finishes.filter((f) => f.visible).map((f) => ({ id: f.id, label: f.label })),
		quantities: cfg.quantities, minMm: cfg.size.minMm, maxMm: cfg.size.maxMm
	};
	const w = Number(b.w), h = Number(b.h || b.w), qty = Math.round(Number(b.qty));
	if (!(w > 0) || !(h > 0) || !(qty > 0)) return json({ opts });
	const forma = opts.shapes.some((s) => s.id === b.forma) ? String(b.forma) : opts.shapes[0]?.id ?? 'sagomato';
	const materiale = opts.materials.some((m) => m.id === b.materiale) ? String(b.materiale) : opts.materials[0]?.id ?? 'bianco';
	const finitura = opts.finishes.some((f) => f.id === b.finitura) ? String(b.finitura) : opts.finishes[0]?.id ?? 'nessuna';
	const q = quoteWith(cfg, { w, h, forma, materiale, finitura, qty, vatIncluded: false });
	const label = (arr: { id: string; label: string }[], id: string) => arr.find((x) => x.id === id)?.label ?? id;
	const description = [label(opts.shapes, forma), label(opts.materials, materiale), finitura !== 'nessuna' ? label(opts.finishes, finitura) : '', `${w}×${h} mm`].filter(Boolean).join(' · ');
	return json({ opts, forma, materiale, finitura, net: q.net, gross: q.gross, unitNet: Math.round((q.net / qty) * 10000) / 10000, description, minQty: cfg.quantities[0] });
};
