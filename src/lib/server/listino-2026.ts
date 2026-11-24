/**
 * Listino 2026: la fotografia dei preventivatori com'erano online il 19/11/2026, prima del listino 2027
 * (`listino-2026.json`, un config per prodotto con la regola vecchia: commercial range, price range, avvio).
 * Serve solo al confronto nella dashboard del preventivatore. Resta sul server (contiene i costi):
 * alla pagina arrivano solo i prezzi gia' calcolati.
 */
import { DEFAULT_ENGINES, PRODUCT_ENGINES, mergeConfig, quoteWith, type EngineConfig } from '$lib/pricing/engine';
import foto from './listino-2026.json';

export const FORMATI_CONFRONTO = [30, 50, 70, 100, 150]; // lato in mm (pezzo quadrato)
export const QTA_CONFRONTO = [15, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];

export type Confronto2026 = {
	slug: string; nome: string; kind: 'lamina' | 'resina'; minQty: number;
	/** una voce per "senza lamina" e una per "con lamina": materiale e finitura usati, e i prezzi 2026 IVA inclusa [formato][quantita'] */
	varianti: { lamina: boolean; materiale: string; finitura: string; laminata: boolean; prezzi: number[][] }[];
}[];

export function confronto2026(): Confronto2026 {
	const out: Confronto2026 = [];
	for (const p of PRODUCT_ENGINES) {
		const salvato = (foto as Record<string, unknown>)[p.slug];
		if (!salvato) continue;
		/* senza `listino` agganciato quoteWith usa la regola vecchia */
		const cfg: EngineConfig = { ...mergeConfig(DEFAULT_ENGINES[p.slug] ?? DEFAULT_ENGINES.adesivi_personalizzati, salvato), listino: undefined };
		const vis = cfg.finishes.filter((f) => f.visible);
		const mat = (cfg.materials.find((m) => m.id === 'bianco' && m.visible) ?? cfg.materials.find((m) => m.visible) ?? cfg.materials[0]).id;
		const forma = (cfg.shapes.find((s) => s.id === 'quadrato') ?? cfg.shapes[0]).id;
		const varianti = [false, true].map((lamina) => {
			const f = cfg.kind === 'resina' ? undefined : lamina ? (vis.find((x) => x.laminate) ?? vis[0]) : (vis.find((x) => !x.laminate) ?? vis[0]);
			const finitura = f?.id ?? 'nessuna';
			const prezzi = FORMATI_CONFRONTO.map((lato) => QTA_CONFRONTO.map((qty) => quoteWith(cfg, { w: lato, h: lato, forma, materiale: mat, finitura, qty, vatIncluded: true }).gross));
			return { lamina, materiale: mat, finitura, laminata: !!f?.laminate, prezzi };
		});
		out.push({ slug: p.slug, nome: p.name, kind: cfg.kind, minQty: cfg.quantities[0] ?? 1, varianti });
	}
	return out;
}
