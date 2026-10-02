/**
 * Analisi margini — quanto MATERIALE consuma una riga d'ordine, quanto costa e quanto ci si guadagna.
 *
 * Lo Studio non salva in database cosa ha stampato (scrive i file nella cartella di rete), quindi il
 * consumo si ricostruisce impaginando la riga ESATTAMENTE come fa lo Studio con le regolazioni di partenza:
 *   - bobina da 70 cm, pagina larga 68,8 cm, crocini e codice a barre Graphtec ai bordi;
 *   - +8% di pezzi per gli scarti di produzione;
 *   - sciolti (personalizzati, rilievo, vetrofanie, kit): 8 mm fra i pezzi, strisce alte al massimo 45 cm;
 *   - fogli (resinati, etichette): fogli circa A4, resinati a multipli dei 10 aghi, strisce alte 36 cm;
 *   - fogli di adesivi: il foglio del cliente e' il pezzo, 10 mm fra un foglio e l'altro;
 *   - 5 cm di stacco fra una striscia e l'altra (codice a barre + taglio).
 * Da qui escono i consumi: metri di bobina (vinile), metri quadri di lamina, grammi di resina,
 * metri quadri stampati, sfrido. I costi unitari sono quelli dei preventivatori (Setup), qui non si ripetono.
 *
 * Ordini manuali: misura, sagoma e materiale non hanno colonne proprie, stanno nella descrizione della riga
 * (il calcolatore 🧮 scrive "Sagomato · Bianco · Lucida · 50×50 mm"; a mano si scrive "10×10 cm, trasparente").
 * Si leggono da li' e si dice sempre da dove viene ogni dato. Se nell'ordine sono stati completati dalla
 * pagina dei margini, valgono quelli.
 *
 * Regola: non si inventa mai un numero. Senza misura il consumo "manca" (con il motivo scritto);
 * quando un dato e' presunto (materiale non scritto, unita' di misura mancante) il calcolo e' una "stima".
 */
import { type EngineConfig } from '$lib/pricing/engine';
import { kitN } from '$lib/pricing/kit';
import { KIT_CAVALLOTTO } from '$lib/studio/products';
import { STRIP_MATERIALS, STRIP_OVERHEAD, SHEET_RULES, layoutLoose, layoutSheets, type Strip } from '$lib/studio/layout';
import { MARKED_MARGIN, pageWidthFor } from '$lib/studio/graphtec';
import { deliveryMode } from '$lib/dashboard/orders';

/* ------------------------------------------------------------------ parametri */

/** quanto ci costa una spedizione con il nostro corriere, IVA esclusa (Mattia, 2/10/2026: 7,50 € + IVA) */
export const COSTO_SPEDIZIONE_NETTO = 7.5;
/** costo del corriere per un ordine: solo se la spedizione e' a carico nostro */
export function costoSpedizione(g: { shipping_method: string | null; channel: string }): number {
	return deliveryMode(g) === 'ours' ? COSTO_SPEDIZIONE_NETTO : 0;
}

/** parametri di produzione: gli stessi di partenza dello Studio */
export interface ParametriCosto {
	bobina: { width: number; maxHSheets: number; maxHLoose: number };
	scarto: number;
	gap: number;
	gapFogli: number;
}
export const PARAMETRI: ParametriCosto = { bobina: STRIP_MATERIALS[0], scarto: 0.08, gap: 8, gapFogli: 10 };

/* ------------------------------------------------------------------ tipi */

export interface RigaCosto {
	product_slug: string;
	product_code?: string | null;
	description?: string | null;
	forma?: string | null;
	materiale?: string | null;
	finitura?: string | null;
	lamination?: string | null;
	width_mm?: number | string | null;
	height_mm?: number | string | null;
	qty: number;
	total_net?: number | string | null;
	discount_amount?: number | string | null;
}

export type StatoCosto = 'ok' | 'stima' | 'manca';
export type ModoImpagina = 'sciolti' | 'fogli' | 'foglio_intero' | 'kit' | 'fuori_misura';
/** da dove viene un dato: colonna dell'ordine, descrizione della riga, descrizione del codice prodotto, presunto */
export type Fonte = 'ordine' | 'descrizione' | 'codice' | 'presunto' | 'manca';

export interface Lettura {
	w: number;
	h: number;
	forma: string;
	materiale: string;
	materialeLabel: string;
	/** laminazione: 'nessuna', 'lucida', 'opaca', … */
	lamina: string;
	fonti: { misura: Fonte; materiale: Fonte; forma: Fonte; lamina: Fonte };
	/** cose presunte o non riconosciute, scritte per chi legge */
	note: string[];
}

export interface Consumo {
	modo: ModoImpagina;
	/** larghezza della bobina e metri lineari consumati (strisce + stacco) */
	bobinaLarghezzaMm: number;
	bobinaMm: number;
	bobinaM2: number;
	/** vinile usato */
	vinileId: string;
	vinileLabel: string;
	/** lamina: tipo e metri quadri (tutta la bobina consumata), null se non laminato */
	laminaTipo: string | null;
	laminaM2: number;
	/** resina colata sui pezzi */
	resinaCm2: number;
	resinaG: number;
	/** area stampata (inchiostro) e area dei pezzi ordinati */
	stampaM2: number;
	utileM2: number;
	/** bobina che non diventa adesivo venduto (margini, spazi, scarti, stacco) */
	sfridoM2: number;
	resaPct: number;
	pezzi: number;
	pezziDaFare: number;
	strisce: number;
	perStriscia: number;
	fogli: number;
	perFoglio: number;
	/** kit: cavallotti stampati a parte */
	cavallotti: number;
}

export interface CostoRiga {
	/** 'servizio' = riga senza materiale (spedizione, grafica, impianto…) */
	tipo: 'prodotto' | 'servizio';
	/** il servizio e' una spedizione addebitata al cliente */
	spedizione: boolean;
	stato: StatoCosto;
	motivo: string | null;
	listino: string;
	lettura: Lettura | null;
	consumo: Consumo | null;
	costi: { vinile: number; stampa: number; lamina: number; resina: number; totale: number };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ZERO = { vinile: 0, stampa: 0, lamina: 0, resina: 0, totale: 0 };

/** slug del listino per una riga (ordini vecchi e manuali scrivono il prodotto in modi diversi) */
export function slugListino(slug: string | null | undefined): string {
	const s = (slug ?? '').trim().toLowerCase().replace(/-/g, '_');
	if (s === 'fogli') return 'fogli_adesivi';
	if (s === 'kit' || s === 'kit_adesivi') return 'kit_adesivi';
	return s;
}

/** ricavo netto della riga: listino meno il codice sconto (IVA esclusa), come nella scheda ordine */
export const ricavoRiga = (r: Pick<RigaCosto, 'total_net' | 'discount_amount'>) => r2(num(r.total_net) - num(r.discount_amount));

/* ------------------------------------------------------------------ lettura della descrizione */

const ALIAS_MATERIALI: [string, RegExp][] = [
	['super', /super\s*adesiv|\bsuper\b/i],
	['trasparente', /traspar|\bclear\b|cristallo/i],
	['olografico', /olograf|holo/i],
	['glitterato', /glitter/i],
	['argento', /argent|silver|cromo\s*arg/i],
	['oro', /\boro\b|\bgold\b|cromo\s*oro/i],
	['bianco', /bianc|white/i]
];
const ALIAS_FORME: [string, RegExp][] = [
	['sagomato', /sagomat|fustellat|forma\s*libera|die\s*cut/i],
	['tondo', /\btond|rotond|cerchi|circolar|ø|diametro/i],
	['quadrato', /quadrat/i],
	['ovale', /oval/i],
	['rettangolare', /rettangol/i]
];

export interface Letto { w?: number; h?: number; unita?: 'mm' | 'cm' | 'presunta-mm' | 'presunta-cm'; forma?: string; materiale?: string; lamina?: string; materialeScritto?: string }

/** misura, sagoma, materiale e lamina scritti in un testo libero */
export function leggiTesto(testo: string | null | undefined): Letto {
	const t = String(testo ?? '');
	const out: Letto = {};
	if (!t.trim()) return out;
	const unitOf = (u: string | undefined, a: number, b: number): [number, Letto['unita']] => {
		if (/cm/i.test(u ?? '')) return [10, 'cm'];
		if (/mm/i.test(u ?? '')) return [1, 'mm'];
		// unita' non scritta: un adesivo sotto il centimetro non esiste, quindi valori piccoli sono centimetri
		const altrove = /\bcm\b/i.test(t) && !/\bmm\b/i.test(t);
		if (altrove || Math.max(a, b) < 10) return [10, 'presunta-cm'];
		return [1, 'presunta-mm'];
	};
	const m = t.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?/i);
	if (m) {
		const a = Number(m[1].replace(',', '.')), b = Number(m[3].replace(',', '.'));
		const [k, u] = unitOf(m[4] ?? m[2], a, b);
		out.w = a * k; out.h = b * k; out.unita = u;
	} else {
		const d = t.match(/(?:ø|diam(?:etro)?\.?)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?/i) ?? t.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm)\s*(?:di\s*)?diam/i);
		if (d) { const a = Number(d[1].replace(',', '.')); const [k, u] = unitOf(d[2], a, a); out.w = a * k; out.h = a * k; out.unita = u; out.forma = 'tondo'; }
	}
	for (const [id, re] of ALIAS_FORME) if (re.test(t)) { out.forma ??= id; break; }
	for (const [id, re] of ALIAS_MATERIALI) if (re.test(t)) { out.materiale = id; break; }
	if (!out.materiale) {
		const altro = t.match(/\b(pp|polipropilene|carta|pvc|vinile\s+\w+|poliestere|pet)\b/i);
		if (altro) out.materialeScritto = altro[1];
	}
	if (/lucid/i.test(t)) out.lamina = 'lucida';
	else if (/opac/i.test(t)) out.lamina = 'opaca';
	return out;
}

const SERVIZIO = /spedizion|trasport|corrier|consegna|grafic|impiant|progettaz|montaggi|posa\b|urgen|express|file\b|bozzett|fustella\b/i;
const SPEDIZIONE = /spedizion|trasport|corrier|consegna/i;

/* ------------------------------------------------------------------ impaginazione */

export interface Piano {
	ok: boolean;
	errore?: string;
	avviso?: string;
	modo: ModoImpagina;
	strips: Strip[];
	/** misure del pezzo come sta sulla striscia (sciolti) o nel foglio (fogli) */
	pw: number;
	ph: number;
	/** fogli: misure del foglio e se sta girato sulla striscia */
	foglio?: { w: number; h: number; rot: boolean; pezzi: number };
	pezziDaFare: number;
	perStriscia: number;
	fogli: number;
	/** kit: strisce dei cavallotti */
	cavallotti?: { strips: Strip[]; n: number };
}

/** impagina una riga come lo Studio (le strisce servono anche a disegnarla) */
export function pianoRiga(slug: string, w: number, h: number, qty: number, forma: string, par: ParametriCosto = PARAMETRI): Piano {
	const stripW = pageWidthFor(par.bobina.width);
	const margin = MARKED_MARGIN.x, marginY = MARKED_MARGIN.y;
	const pezziDaFare = Math.ceil(qty * (1 + par.scarto));
	const vuoto = (modo: ModoImpagina, errore: string, n = pezziDaFare): Piano => ({ ok: false, errore, modo, strips: [], pw: w, ph: h, pezziDaFare: n, perStriscia: 0, fogli: 0 });

	if (slug === 'adesivi_resinati' || slug === 'etichette') {
		const rules = SHEET_RULES[slug === 'adesivi_resinati' ? 'resinati' : 'etichette'];
		const o = { stripW, stripH: par.bobina.maxHSheets, margin, marginY, sheetGap: par.gapFogli };
		const probe = layoutSheets(w, h, rules, { ...o, sheets: 0 });
		if (!probe.ok || !probe.sheet) return vuoto('fuori_misura', probe.error ?? 'il pezzo non entra in un foglio');
		const fogli = Math.ceil(pezziDaFare / probe.sheet.grid.n);
		const res = layoutSheets(w, h, rules, { ...o, sheets: fogli });
		return { ok: true, avviso: probe.warning, modo: 'fogli', strips: res.strips, pw: probe.sheet.pw, ph: probe.sheet.ph, foglio: { w: probe.sheet.w, h: probe.sheet.h, rot: probe.sheetRot, pezzi: probe.sheet.grid.n }, pezziDaFare: fogli * probe.sheet.grid.n, perStriscia: res.piecesPerStrip, fogli };
	}
	if (slug === 'fogli_adesivi') {
		const res = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gapFogli, qty: pezziDaFare });
		if (!res.ok) return vuoto('fuori_misura', res.error ?? 'il foglio non entra nella striscia');
		return { ok: true, modo: 'foglio_intero', strips: res.strips, pw: res.pw, ph: res.ph, pezziDaFare, perStriscia: res.perStrip, fogli: pezziDaFare };
	}
	if (slug === 'kit_adesivi') {
		const n = kitN(forma || '1');
		const pezzi = Math.ceil(qty * n * (1 + par.scarto));
		const nCav = pezziDaFare;
		const a = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: pezzi });
		if (!a.ok) return vuoto('fuori_misura', a.error ?? 'gli adesivi del kit non entrano nella striscia', pezzi);
		const c = layoutLoose(KIT_CAVALLOTTO.w, KIT_CAVALLOTTO.h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: nCav });
		return { ok: true, modo: 'kit', strips: a.strips, pw: a.pw, ph: a.ph, pezziDaFare: pezzi, perStriscia: a.perStrip, fogli: 0, cavallotti: c.ok ? { strips: c.strips, n: nCav } : undefined };
	}
	const res = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: pezziDaFare });
	if (!res.ok) return vuoto('fuori_misura', res.error ?? 'il pezzo non entra nella striscia');
	return { ok: true, modo: 'sciolti', strips: res.strips, pw: res.pw, ph: res.ph, pezziDaFare, perStriscia: res.perStrip, fogli: 0 };
}

const lunghezza = (strips: Strip[]) => strips.reduce((s, st) => s + st.h + STRIP_OVERHEAD, 0);

/* ------------------------------------------------------------------ lettura della riga */

/** misura, sagoma, materiale e lamina di una riga: colonne dell'ordine, poi descrizione, poi codice prodotto */
export function leggiRiga(r: RigaCosto, cfg: EngineConfig, testoCodice?: string | null): Lettura | null {
	const slug = slugListino(r.product_slug);
	const note: string[] = [];
	const dDesc = leggiTesto(r.description), dCod = leggiTesto(testoCodice);
	const fonti: Lettura['fonti'] = { misura: 'manca', materiale: 'manca', forma: 'manca', lamina: 'ordine' };

	/* misura */
	let w = num(r.width_mm), h = num(r.height_mm);
	if (w > 0 && h > 0) fonti.misura = 'ordine';
	else if (w > 0 && slug === 'kit_adesivi') { h = Math.round(w * 0.8); fonti.misura = 'ordine'; }
	else {
		const d = dDesc.w ? dDesc : dCod.w ? dCod : null;
		if (d?.w && d.h) {
			w = d.w; h = d.h; fonti.misura = d === dDesc ? 'descrizione' : 'codice';
			if (d.unita === 'presunta-cm') note.push(`unità non scritta: letta in centimetri (${w / 10}×${h / 10} cm)`);
			if (d.unita === 'presunta-mm') note.push(`unità non scritta: letta in millimetri (${w}×${h} mm)`);
		}
	}
	if (!(w > 0 && h > 0)) return null;

	/* materiale */
	const visibili = cfg.materials.filter((m) => m.visible);
	const trova = (id: string | undefined) => (id ? cfg.materials.find((m) => m.id === id) : undefined);
	let mat = trova((r.materiale ?? '').trim().toLowerCase());
	if (mat) fonti.materiale = 'ordine';
	else if ((mat = trova(dDesc.materiale))) fonti.materiale = 'descrizione';
	else if ((mat = trova(dCod.materiale))) fonti.materiale = 'codice';
	else {
		mat = visibili[0] ?? cfg.materials[0];
		fonti.materiale = 'presunto';
		const scritto = r.materiale || dDesc.materialeScritto || dCod.materialeScritto;
		note.push(scritto ? `materiale "${scritto}" non è nel listino: calcolato come ${mat.label}` : `materiale non scritto: calcolato come ${mat.label}`);
	}

	/* sagoma */
	let forma = (r.forma ?? '').trim().toLowerCase();
	if (forma) fonti.forma = 'ordine';
	else if (dDesc.forma) { forma = dDesc.forma; fonti.forma = 'descrizione'; }
	else if (dCod.forma) { forma = dCod.forma; fonti.forma = 'codice'; }
	else { forma = cfg.shapes[0]?.id ?? 'sagomato'; fonti.forma = 'presunto'; }

	/* lamina: colonna laminazione, poi finitura, poi descrizione */
	const scritta = [r.lamination, r.finitura].map((v) => (v ?? '').trim().toLowerCase()).find((v) => v && v !== 'nessuna');
	let lamina = scritta ?? '';
	if (!lamina && (dDesc.lamina || dCod.lamina)) { lamina = (dDesc.lamina ?? dCod.lamina)!; fonti.lamina = dDesc.lamina ? 'descrizione' : 'codice'; }
	lamina ||= 'nessuna';

	return { w, h, forma, materiale: mat.id, materialeLabel: mat.label, lamina, fonti, note };
}

/** la riga e' laminata con un film (il rilievo ha la vernice UV, non la lamina; i resinati solo se scritto) */
function laminata(slug: string, cfg: EngineConfig, lamina: string): boolean {
	if (!lamina || lamina === 'nessuna' || slug === 'adesivi_rilievo' || lamina.startsWith('uv')) return false;
	if (cfg.kind === 'resina') return true;
	const fin = cfg.finishes.find((f) => f.id === lamina);
	return fin ? fin.laminate : /lucid|opac|lamin|plastific/.test(lamina);
}

/* ------------------------------------------------------------------ costo della riga */

/**
 * Consumo e costo di produzione di una riga d'ordine.
 * `engines`: i listini per slug (da `loadEngine`); il kit usa quello degli adesivi personalizzati.
 * `testoCodice`: descrizione del codice prodotto (Setup → Codici prodotto), usata se la riga non dice la misura.
 */
export function costoRiga(r: RigaCosto, engines: Record<string, EngineConfig>, testoCodice?: string | null, par: ParametriCosto = PARAMETRI): CostoRiga {
	const slug = slugListino(r.product_slug);
	const base = { tipo: 'prodotto' as const, spedizione: false, listino: slug, lettura: null, consumo: null, costi: ZERO };
	const testo = `${r.product_code ?? ''} ${r.description ?? ''}`;
	const cfg = engines[slug === 'kit_adesivi' ? 'adesivi_personalizzati' : slug];

	if (!cfg && slug !== 'campioni' && SERVIZIO.test(testo)) return { ...base, tipo: 'servizio', spedizione: SPEDIZIONE.test(testo), stato: 'ok', motivo: null };
	if (slug === 'campioni') return { ...base, stato: 'manca', motivo: 'Kit campioni: il consumo del kit non è ancora configurato.' };
	if (!cfg) return { ...base, stato: 'manca', motivo: `Codice "${r.product_code || r.product_slug || '—'}" senza listino: non so che materiale consuma.` };

	const lett = leggiRiga(r, cfg, testoCodice);
	if (!lett) return { ...base, stato: 'manca', motivo: r.description ? `Misura non trovata nella descrizione "${r.description}": scrivila in "Completa misura e materiale".` : 'Manca la misura (larghezza × altezza): scrivila in "Completa misura e materiale".' };

	const qty = Math.max(1, Math.round(num(r.qty) || 1));
	const { w, h } = lett;
	const note = [...lett.note];
	let stato: StatoCosto = lett.fonti.materiale === 'presunto' || lett.note.some((n) => n.startsWith('unità')) ? 'stima' : 'ok';
	const pi = pianoRiga(slug, w, h, qty, r.forma ?? '', par);

	const W = par.bobina.width;
	let bobinaMm: number, stampaMm2: number, strisce: number;
	if (pi.ok) {
		bobinaMm = lunghezza(pi.strips) + (pi.cavallotti ? lunghezza(pi.cavallotti.strips) : 0);
		strisce = pi.strips.length + (pi.cavallotti?.strips.length ?? 0);
		stampaMm2 = w * h * pi.pezziDaFare + (pi.cavallotti ? KIT_CAVALLOTTO.w * KIT_CAVALLOTTO.h * pi.cavallotti.n : 0);
		if (pi.avviso) { note.push(pi.avviso); stato = 'stima'; }
		if (pi.modo === 'kit') { note.push(`kit da ${kitN(r.forma ?? '1')} adesivi + cavallotto: bustina e confezionamento non contati`); stato = 'stima'; }
	} else {
		/* piu' grande della striscia: si stampa a pannelli, area dei pezzi + un quarto di sfrido */
		stampaMm2 = w * h * pi.pezziDaFare;
		bobinaMm = (stampaMm2 * 1.25) / W;
		strisce = 0;
		note.push(`non entra nella striscia (${(pi.errore ?? '').replace(/\.$/, '')}): area dei pezzi + 25% di sfrido`);
		stato = 'stima';
	}
	const resinato = cfg.kind === 'resina';
	const lam = laminata(slug, cfg, lett.lamina);
	const bobinaM2 = (bobinaMm * W) / 1_000_000;
	const stampaM2 = stampaMm2 / 1_000_000;
	const utileM2 = (w * h * qty) / 1_000_000;
	const resinaCm2 = resinato ? (w * h / 100) * pi.pezziDaFare : 0;
	const resinaG = resinaCm2 * num(cfg.resin.gramsPerCm2);
	const mat = cfg.materials.find((m) => m.id === lett.materiale)!;

	const consumo: Consumo = {
		modo: pi.ok ? pi.modo : 'fuori_misura',
		bobinaLarghezzaMm: W, bobinaMm: Math.round(bobinaMm), bobinaM2: r3(bobinaM2),
		vinileId: mat.id, vinileLabel: mat.label,
		laminaTipo: lam ? lett.lamina : null, laminaM2: lam ? r3(bobinaM2) : 0,
		resinaCm2: Math.round(resinaCm2), resinaG: Math.round(resinaG),
		stampaM2: r3(stampaM2), utileM2: r3(utileM2), sfridoM2: r3(Math.max(0, bobinaM2 - utileM2)),
		resaPct: bobinaM2 > 0 ? Math.round((utileM2 / bobinaM2) * 1000) / 10 : 0,
		pezzi: pi.modo === 'kit' ? qty * kitN(r.forma ?? '1') : qty, pezziDaFare: pi.pezziDaFare, strisce, perStriscia: pi.perStriscia,
		fogli: pi.fogli, perFoglio: pi.foglio?.pezzi ?? 0, cavallotti: pi.cavallotti?.n ?? 0
	};
	const vinile = r2(bobinaM2 * num(mat.costM2));
	const stampa = r2(stampaM2 * num(cfg.print.costM2));
	const lamina = lam ? r2(bobinaM2 * num(cfg.laminate.costM2)) : 0;
	const resina = r2(resinaG * (num(cfg.resin.costKg) / 1000));
	return {
		...base, stato, motivo: note.length ? note.join(' · ') : null, lettura: lett, consumo,
		costi: { vinile, stampa, lamina, resina, totale: r2(vinile + stampa + lamina + resina) }
	};
}
