/**
 * productionRoutingService: dal prodotto acquistato alle fasi di produzione.
 *
 * REGOLE ATTUALI DI STICKERPRINT (configurazione in ROUTES, non sparsa nelle pagine):
 *  - con lamina protettiva → stampa eco-solvente (SG3), asciugatura configurabile, laminazione, taglio;
 *  - senza protezione (adesivi, etichette, kit, fogli) → stampa UV (LG2), taglio se serve; MAI la laminatrice;
 *  - vetrofanie → stampa UV; taglio solo se previsto dal prodotto;
 *  - adesivi resinati → stampa eco-solvente (SG3), taglio basi, resinatura, maturazione (passiva); MAI la LG2;
 *    la laminazione sui resinati resta una scelta esplicita dell'ordine (non si deduce);
 *  - adesivi in rilievo → stampa UV, taglio;
 *  - campioni → nessuna lavorazione: vanno direttamente in spedizione.
 * Finita l'ultima fase l'ordine passa in Spedizioni: niente controllo qualita' ne' confezionamento come fasi.
 * Le durate vengono dai parametri dei macchinari (Setup → Macchinari). Se un parametro manca ("Da configurare")
 * vale la durata di riserva del template, e la fase e' segnata come non stimata.
 */
import { COMPLEXITY, MACHINE_TYPES, usable, type Capability, type Department, type Machine, type MachineProfile, type RoutedPhase, type RoutingInput } from './types';

/* ---------- area ---------- */
export interface Area { pieceSqm: number; totalSqm: number; qty: number; known: boolean }
/** area in metri quadrati da millimetri (gestisce anche cm e m se i valori arrivano gia' convertiti in mm) */
export function areaOf(i: Pick<RoutingInput, 'qty' | 'width_mm' | 'height_mm' | 'imposed_sqm'>): Area {
	const qty = Math.max(1, Math.round(Number(i.qty) || 1));
	if (i.imposed_sqm && i.imposed_sqm > 0) return { pieceSqm: i.imposed_sqm / qty, totalSqm: i.imposed_sqm, qty, known: true };
	const w = Number(i.width_mm) || 0, h = Number(i.height_mm) || 0;
	if (w > 0 && h > 0) { const piece = (w / 1000) * (h / 1000); return { pieceSqm: piece, totalSqm: piece * qty, qty, known: true }; }
	return { pieceSqm: 0, totalSqm: 0, qty, known: false };
}

/* ---------- template dei percorsi ---------- */
interface Tpl { stage: Department; label: string; capability: Capability; machine_types: string[]; fallback: (a: Area) => number; passive?: number | 'machine' }
const mins = (v: number, lo = 5, hi = 600) => Math.max(lo, Math.min(hi, Math.round(v)));
/* durate di RISERVA: valgono solo finche' la macchina non e' configurata (non sono velocita' reali) */
const T = {
	stampaEco: (): Tpl => ({ stage: 'stampa', label: 'Stampa eco-solvente', capability: 'stampa_ecosolvente', machine_types: ['stampante_ecosolvente'], fallback: (a) => mins(15 + a.totalSqm * 25) }),
	asciugatura: (): Tpl => ({ stage: 'stampa', label: 'Asciugatura', capability: 'stampa_ecosolvente', machine_types: [], fallback: () => 0, passive: 'machine' }),
	stampaUV: (): Tpl => ({ stage: 'stampa', label: 'Stampa UV', capability: 'stampa_uv', machine_types: ['stampante_uv'], fallback: (a) => mins(20 + a.totalSqm * 30) }),
	laminazione: (): Tpl => ({ stage: 'laminazione', label: 'Laminazione', capability: 'laminazione', machine_types: ['laminatrice'], fallback: (a) => mins(10 + a.totalSqm * 8) }),
	taglio: (label = 'Taglio'): Tpl => ({ stage: 'taglio', label, capability: 'taglio', machine_types: ['plotter_taglio'], fallback: (a) => mins(10 + a.totalSqm * 12 + a.qty * 0.02) }),
	resinatura: (): Tpl => ({ stage: 'resinatura', label: 'Resinatura', capability: 'resinatura', machine_types: ['resinatrice'], fallback: (a) => mins(20 + a.qty * 0.35) }),
	maturazione: (): Tpl => ({ stage: 'resinatura', label: 'Maturazione resina', capability: 'resinatura', machine_types: [], fallback: () => 0, passive: 'machine' })
};
const MATURAZIONE_DEFAULT = 12 * 60;   // se la resinatrice non ha un tempo passivo configurato
const CUT_BY_DEFAULT: Record<string, boolean> = { adesivi_personalizzati: true, etichette: true, kit_adesivi: true, fogli_adesivi: true, adesivi_rilievo: true, adesivi_resinati: true, vetrofanie: false, campioni: false };

/** il percorso (senza durate ne' macchine) per un ordine */
export function routeTemplate(i: RoutingInput): Tpl[] {
	const cut = i.needs_cut ?? CUT_BY_DEFAULT[i.product_slug] ?? true;
	switch (i.product_slug) {
		case 'campioni': return [];
		case 'adesivi_resinati':
			return [T.stampaEco(), ...(i.laminated ? [T.laminazione()] : []), T.taglio('Taglio basi'), T.resinatura(), T.maturazione()];
		case 'vetrofanie':
			return [T.stampaUV(), ...(cut ? [T.taglio()] : [])];
		case 'adesivi_rilievo':
			return [T.stampaUV(), T.taglio('Taglio e finitura')];
		default: {
			// adesivi personalizzati, etichette, kit, fogli
			const uv = i.print_tech === 'uv' || (i.print_tech !== 'ecosolvente' && !i.laminated);
			if (uv) return [T.stampaUV(), ...(cut ? [T.taglio()] : [])];
			return [T.stampaEco(), T.asciugatura(), T.laminazione(), ...(cut ? [T.taglio()] : [])];
		}
	}
}

/* ---------- durate dai parametri dei macchinari ---------- */
function profileFor(m: Machine, profiles: MachineProfile[], i: RoutingInput, cap: Capability): MachineProfile | null {
	const ok = profiles.filter((p) => p.machine_id === m.id && p.is_active && (!p.capability || p.capability === cap) && (!p.product_slug || p.product_slug === i.product_slug) && (!p.material || p.material === (i.material ?? '')));
	// il profilo piu' specifico vince (prodotto + materiale > prodotto > generico)
	return ok.sort((a, b) => (+!!b.product_slug + +!!b.material) - (+!!a.product_slug + +!!a.material))[0] ?? null;
}
/** minuti di lavoro attivo su una macchina; null = macchina non configurata */
export function machineMinutes(m: Machine, cap: Capability, a: Area, i: RoutingInput, profiles: MachineProfile[]): number | null {
	const p = profileFor(m, profiles, i, cap);
	const setup = p?.setup_minutes ?? m.setup_minutes ?? 0;
	const waste = m.waste_coefficient && m.waste_coefficient > 0 ? m.waste_coefficient : 1;
	const sqm = a.totalSqm * waste;
	const coef = p?.coefficient ?? 1;
	if (cap === 'resinatura') {
		const perPiece = p?.minutes_per_piece ?? m.minutes_per_piece ?? (m.pieces_per_hour ? 60 / m.pieces_per_hour : null);
		if (perPiece == null) return null;
		return Math.max(1, Math.round(setup + a.qty * perPiece * coef + (m.cleanup_minutes ?? 0)));
	}
	if (!a.known) return null;   // senza misure non si puo' calcolare l'area: durata di riserva
	const perSqm = p?.minutes_per_sqm ?? m.minutes_per_sqm ?? ((p?.sqm_per_hour ?? m.sqm_per_hour) ? 60 / (p?.sqm_per_hour ?? m.sqm_per_hour!) : null);
	if (perSqm == null) return null;
	const cx = cap === 'taglio' ? COMPLEXITY[i.complexity ?? 'standard']?.coefficient ?? 1 : 1;
	return Math.max(1, Math.round(setup + sqm * perSqm * coef * cx));   // nessun tetto: una tiratura lunga dura quanto deve (si spalma sui giorni)
}

/* ---------- servizio ---------- */
export interface RoutingResult { phases: RoutedPhase[]; area: Area; total_minutes: number; unconfigured: string[] }
/**
 * Restituisce le fasi con tipologie compatibili, macchinario proposto (quello con meno lavoro in coda tra
 * quelli usabili: la scelta definitiva, senza sovrapposizioni, la fa il pianificatore) e durata stimata.
 */
export function routeOrder(i: RoutingInput, machines: Machine[], profiles: MachineProfile[] = [], load: Record<string, number> = {}): RoutingResult {
	const a = areaOf(i);
	const unconfigured = new Set<string>();
	const phases: RoutedPhase[] = routeTemplate(i).map((t, k) => {
		if (t.passive) {
			// tempo passivo: dal macchinario della fase precedente (asciugatura dopo la stampa, maturazione dopo la resinatrice)
			const prevCap = t.capability;
			const m = candidates(machines, prevCap)[0];
			const wait = m?.passive_minutes ?? (t.label === 'Maturazione resina' ? MATURAZIONE_DEFAULT : 0);
			return { seq: k + 1, stage: t.stage, label: t.label, capability: t.capability, machine_types: [], machine_id: null, minutes: 0, wait_minutes: wait, passive: true, estimated: m?.passive_minutes != null };
		}
		const cands = candidates(machines, t.capability).filter((m) => t.machine_types.length === 0 || t.machine_types.includes(m.machine_type));
		const best = cands.sort((x, y) => (load[x.id] ?? 0) - (load[y.id] ?? 0) || x.sort - y.sort)[0] ?? null;
		let minutes = best ? machineMinutes(best, t.capability, a, i, profiles) : null;
		const estimated = minutes != null;
		if (minutes == null) { minutes = t.fallback(a); if (t.machine_types.length) unconfigured.add(best?.name ?? MACHINE_TYPES[t.machine_types[0]]?.label ?? t.capability); }
		return { seq: k + 1, stage: t.stage, label: t.label, capability: t.capability, machine_types: t.machine_types, machine_id: best?.id ?? null, minutes, wait_minutes: 0, passive: false, estimated, complexity: t.capability === 'taglio' ? (i.complexity ?? 'standard') : null };
	}).filter((p) => !(p.passive && p.wait_minutes === 0));   // un tempo passivo a zero non e' una fase
	phases.forEach((p, k) => (p.seq = k + 1));
	return { phases, area: a, total_minutes: phases.reduce((s, p) => s + p.minutes, 0), unconfigured: [...unconfigured] };
}
/** macchine usabili con quella lavorazione */
export function candidates(machines: Machine[], cap: Capability): Machine[] {
	return machines.filter((m) => usable(m) && m.capabilities.includes(cap)).sort((a, b) => a.sort - b.sort);
}
/** dalla riga d'ordine ai dati che servono al routing */
export function routingInputFrom(o: { product_slug: string; finitura?: string | null; lamination?: string | null; qty: number; width_mm: number | null; height_mm: number | null; materiale?: string | null }): RoutingInput {
	const prot = o.lamination && o.lamination !== 'nessuna' ? o.lamination : o.finitura && o.finitura !== 'nessuna' ? o.finitura : 'nessuna';
	// le vernici UV del rilievo non sono una lamina; i resinati non deducono niente: contano solo le scelte esplicite
	const laminated = prot !== 'nessuna' && !/^uv/i.test(prot);
	return { product_slug: o.product_slug, laminated, protection: prot, qty: o.qty, width_mm: o.width_mm, height_mm: o.height_mm, material: o.materiale ?? null };
}
