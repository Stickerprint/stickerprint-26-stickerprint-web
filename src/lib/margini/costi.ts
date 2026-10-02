/**
 * Analisi margini — quanto COSTA produrre una riga d'ordine e quanto ci si guadagna.
 *
 * Il costo si ricava dal materiale che se ne va davvero in produzione, non dal prezzo di vendita:
 *   1. la riga si impagina come fa Stickerprint Studio (stesse strisce, stessi margini dei crocini,
 *      stesso 8% di pezzi in piu' per gli scarti, stessi fogli da 10 aghi per i resinati);
 *   2. la bobina consumata e' l'altezza delle strisce piu' lo stacco fra una e l'altra, per la
 *      larghezza della bobina: e' il MATERIALE (vinile) al costo d'acquisto del listino (€/m², senza ricarico);
 *   3. l'INCHIOSTRO si paga sull'area stampata (i pezzi), la LAMINA sulla striscia intera
 *      (il film copre tutta la bobina), la RESINA sui centimetri quadrati dei pezzi colati
 *      (costo al kg × grammi per cm², dal listino dei resinati).
 * I costi unitari sono quelli di `pricing_engines` (quelli che si modificano da Preventivatori):
 * cambiando il costo di un materiale la', cambia il costo di produzione qui.
 * Manodopera, corriere e imballo NON sono dentro: si vedranno in un secondo passaggio.
 * Regola: non si inventa mai un numero. Se una riga non si puo' calcolare (manca la misura,
 * il prodotto non ha listino) il costo e' "manca", con il motivo scritto; se e' approssimato e' "stima".
 */
import { type EngineConfig } from '$lib/pricing/engine';
import { kitN } from '$lib/pricing/kit';
import { KIT_CAVALLOTTO } from '$lib/studio/products';
import { STRIP_MATERIALS, STRIP_OVERHEAD, SHEET_RULES, layoutLoose, layoutSheets, type Strip } from '$lib/studio/layout';
import { MARKED_MARGIN, pageWidthFor } from '$lib/studio/graphtec';

/** la riga d'ordine come sta in `orders` (solo i campi che servono) */
export interface RigaCosto {
	product_slug: string;
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

/** parametri di produzione: gli stessi di default dello studio */
export interface ParametriCosto {
	/** bobina usata per impaginare (70 cm) */
	bobina: { width: number; maxHSheets: number; maxHLoose: number };
	/** pezzi in piu' stampati per coprire gli scarti (8%) */
	scarto: number;
	/** spazio fra i pezzi sciolti, da taglio a taglio */
	gap: number;
	/** spazio fra un foglio e l'altro sulla striscia */
	gapFogli: number;
}
export const PARAMETRI: ParametriCosto = { bobina: STRIP_MATERIALS[0], scarto: 0.08, gap: 8, gapFogli: 10 };

export type StatoCosto = 'ok' | 'stima' | 'manca';
export type ModoCosto = 'sciolti' | 'fogli' | 'foglio_intero' | 'kit' | 'nessuno';

export interface Impaginazione {
	modo: ModoCosto;
	/** pezzi stampati davvero (quantita' + scarto) */
	pezziDaFare: number;
	/** quante strisce e quanti millimetri di bobina in tutto (stacco compreso) */
	strisce: number;
	bobinaMm: number;
	/** pezzi per striscia piena */
	perStriscia: number;
	/** modo fogli: fogli stampati e pezzi per foglio */
	fogli?: number;
	perFoglio?: number;
	/** misura del pezzo impaginato (mm) */
	w: number;
	h: number;
}

export interface CostoRiga {
	stato: StatoCosto;
	/** perche' il costo e' una stima o manca (sempre scritto quando non e' 'ok') */
	motivo: string | null;
	/** bobina consumata (m²) e area stampata (m²) */
	mq: number;
	mqStampa: number;
	/** voci di costo, in euro */
	materiale: number;
	stampa: number;
	lamina: number;
	resina: number;
	totale: number;
	laminato: boolean;
	resinato: boolean;
	impaginazione: Impaginazione | null;
	/** costi unitari usati (dal listino): per far vedere da dove viene il numero */
	unitari: { materialeId: string; materialeLabel: string; materialeM2: number; stampaM2: number; laminaM2: number; resinaCm2: number };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** slug del listino per una riga (gli ordini vecchi e quelli manuali scrivono il prodotto in modi diversi) */
export function slugListino(slug: string | null | undefined): string {
	const s = (slug ?? '').trim().toLowerCase().replace(/-/g, '_');
	if (s === 'fogli') return 'fogli_adesivi';
	if (s === 'kit' || s === 'kit_adesivi') return 'kit_adesivi';
	return s;
}

/** ricavo netto della riga: listino meno il codice sconto (IVA esclusa), come nella scheda ordine */
export const ricavoRiga = (r: Pick<RigaCosto, 'total_net' | 'discount_amount'>) => r2(num(r.total_net) - num(r.discount_amount));

/** millimetri di bobina consumati dalle strisce (altezza + stacco fra una e l'altra) */
function bobinaMm(strips: Strip[]): number {
	return strips.reduce((s, st) => s + st.h + STRIP_OVERHEAD, 0);
}

const vuoto = (motivo: string, extra: Partial<CostoRiga> = {}): CostoRiga => ({
	stato: 'manca', motivo, mq: 0, mqStampa: 0, materiale: 0, stampa: 0, lamina: 0, resina: 0, totale: 0, laminato: false, resinato: false, impaginazione: null,
	unitari: { materialeId: '', materialeLabel: '—', materialeM2: 0, stampaM2: 0, laminaM2: 0, resinaCm2: 0 }, ...extra
});

/**
 * Costo di produzione di una riga d'ordine.
 * `engines`: i listini per slug (da `loadEngine`); il kit usa quello degli adesivi personalizzati.
 */
export function costoRiga(r: RigaCosto, engines: Record<string, EngineConfig>, par: ParametriCosto = PARAMETRI): CostoRiga {
	const slug = slugListino(r.product_slug);
	if (slug === 'campioni') return vuoto('Kit campioni: il costo fisso del kit non è ancora configurato.');
	const cfg = engines[slug === 'kit_adesivi' ? 'adesivi_personalizzati' : slug];
	if (!cfg) return vuoto(`Prodotto "${r.product_slug}" senza listino: non so cosa consuma.`);

	const qty = Math.max(1, Math.round(num(r.qty) || 1));
	const w = num(r.width_mm), h0 = num(r.height_mm);
	/* kit: la misura salvata e' il lato lungo dell'adesivo, l'altezza segue la proporzione del kit tipo (50×40) */
	const h = h0 > 0 ? h0 : slug === 'kit_adesivi' && w > 0 ? Math.round(w * 0.8) : 0;
	if (!(w > 0 && h > 0)) return vuoto('Manca la misura (larghezza × altezza): senza non si può impaginare.');

	/* materiale: quello della riga; se non e' nel listino si usa il primo visibile e lo si dice */
	const matId = (r.materiale ?? '').trim().toLowerCase();
	let mat = cfg.materials.find((m) => m.id === matId);
	let stato: StatoCosto = 'ok';
	const motivi: string[] = [];
	if (!mat) {
		mat = cfg.materials.find((m) => m.visible) ?? cfg.materials[0];
		stato = 'stima';
		motivi.push(matId ? `materiale "${r.materiale}" non nel listino: uso ${mat.label}` : `materiale non indicato: uso ${mat.label}`);
	}

	/* lamina: sui resinati solo se scritta nell'ordine (non si deduce); sul rilievo mai (e' vernice UV, non film) */
	const prot = (r.lamination && r.lamination !== 'nessuna' ? r.lamination : r.finitura ?? 'nessuna').trim().toLowerCase();
	const fin = cfg.finishes.find((f) => f.id === prot);
	const laminato = cfg.kind === 'resina'
		? !!(r.lamination && r.lamination !== 'nessuna')
		: slug !== 'adesivi_rilievo' && (fin ? fin.laminate : /lucid|opac|lamin|plastific/.test(prot));
	const resinato = cfg.kind === 'resina';

	const stripW = pageWidthFor(par.bobina.width);
	const margin = MARKED_MARGIN.x, marginY = MARKED_MARGIN.y;
	const pezziDaFare = Math.ceil(qty * (1 + par.scarto));

	let imp: Impaginazione;
	let mmBobina = 0;
	let mm2Stampa = 0; // area stampata (mm²)
	let cm2Resina = 0;

	if (slug === 'adesivi_resinati' || slug === 'etichette') {
		const rules = SHEET_RULES[slug === 'adesivi_resinati' ? 'resinati' : 'etichette'];
		const o = { stripW, stripH: par.bobina.maxHSheets, margin, marginY, sheetGap: par.gapFogli };
		const probe = layoutSheets(w, h, rules, { ...o, sheets: 0 });
		if (probe.ok && probe.sheet) {
			const fogli = Math.ceil(pezziDaFare / probe.sheet.grid.n);
			const res = layoutSheets(w, h, rules, { ...o, sheets: fogli });
			mmBobina = bobinaMm(res.strips);
			imp = { modo: 'fogli', pezziDaFare, strisce: res.strips.length, bobinaMm: mmBobina, perStriscia: res.piecesPerStrip, fogli, perFoglio: probe.sheet.grid.n, w, h };
			if (probe.warning) { stato = 'stima'; motivi.push(probe.warning); }
		} else {
			return stimaGrezza(probe.error ?? 'il pezzo non entra in un foglio');
		}
		mm2Stampa = w * h * pezziDaFare;
		cm2Resina = (w * h / 100) * pezziDaFare;
	} else if (slug === 'fogli_adesivi') {
		/* il foglio e' gia' impaginato dal cliente: sulla striscia vanno i fogli interi */
		const res = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gapFogli, qty: pezziDaFare });
		if (!res.ok) return stimaGrezza(res.error ?? 'il foglio non entra nella striscia');
		mmBobina = bobinaMm(res.strips);
		imp = { modo: 'foglio_intero', pezziDaFare, strisce: res.strips.length, bobinaMm: mmBobina, perStriscia: res.perStrip, w, h };
		mm2Stampa = w * h * pezziDaFare;
	} else if (slug === 'kit_adesivi') {
		/* kit: n adesivi per kit × kit ordinati, piu' un cavallotto 80×40 per kit; bustina e confezionamento restano fuori */
		const n = kitN(r.forma ?? '1');
		const pezzi = Math.ceil(qty * n * (1 + par.scarto));
		const a = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: pezzi });
		const c = layoutLoose(KIT_CAVALLOTTO.w, KIT_CAVALLOTTO.h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: Math.ceil(qty * (1 + par.scarto)) });
		if (!a.ok) return stimaGrezza(a.error ?? 'gli adesivi del kit non entrano nella striscia');
		mmBobina = bobinaMm(a.strips) + (c.ok ? bobinaMm(c.strips) : 0);
		imp = { modo: 'kit', pezziDaFare: pezzi, strisce: a.strips.length + (c.ok ? c.strips.length : 0), bobinaMm: mmBobina, perStriscia: a.perStrip, w, h };
		mm2Stampa = w * h * pezzi + (c.ok ? KIT_CAVALLOTTO.w * KIT_CAVALLOTTO.h * Math.ceil(qty * (1 + par.scarto)) : 0);
		stato = 'stima';
		motivi.push(`kit da ${n}: bustina e confezionamento non conteggiati`);
	} else {
		/* adesivi personalizzati, rilievo, vetrofanie e tutto il resto: pezzi sciolti */
		const res = layoutLoose(w, h, { stripW, stripH: par.bobina.maxHLoose, margin, marginY, gap: par.gap, qty: pezziDaFare });
		if (!res.ok) return stimaGrezza(res.error ?? 'il pezzo non entra nella striscia');
		mmBobina = bobinaMm(res.strips);
		imp = { modo: 'sciolti', pezziDaFare, strisce: res.strips.length, bobinaMm: mmBobina, perStriscia: res.perStrip, w, h };
		mm2Stampa = w * h * pezziDaFare;
	}

	return conti(imp, mmBobina, mm2Stampa, cm2Resina, stato, motivi);

	/** il pezzo non si impagina (piu' grande della striscia): area dei pezzi con un quarto di sfrido, segnato come stima */
	function stimaGrezza(perche: string): CostoRiga {
		const pezzi = pezziDaFare;
		const area = w * h * pezzi;
		const mm = (area * 1.25) / par.bobina.width;
		const impG: Impaginazione = { modo: 'nessuno', pezziDaFare: pezzi, strisce: 0, bobinaMm: mm, perStriscia: 0, w, h };
		return conti(impG, mm, area, resinato ? (w * h / 100) * pezzi : 0, 'stima', [...motivi, `non impaginabile (${perche.replace(/\.$/, '')}): area dei pezzi + 25% di sfrido`]);
	}

	function conti(impC: Impaginazione, mm: number, mm2: number, cm2: number, st: StatoCosto, mot: string[]): CostoRiga {
		const m = mat!;
		const mq = (mm * par.bobina.width) / 1_000_000;
		const mqStampa = mm2 / 1_000_000;
		const materialeM2 = num(m.costM2), stampaM2 = num(cfg.print.costM2), laminaM2 = num(cfg.laminate.costM2);
		const resinaCm2 = (num(cfg.resin.costKg) / 1000) * num(cfg.resin.gramsPerCm2);
		const materiale = r2(mq * materialeM2);
		const stampa = r2(mqStampa * stampaM2);
		const lamina = laminato ? r2(mq * laminaM2) : 0;
		const resina = resinato ? r2(cm2 * resinaCm2) : 0;
		return {
			stato: st, motivo: mot.length ? mot.join(' · ') : null,
			mq: Math.round(mq * 1000) / 1000, mqStampa: Math.round(mqStampa * 1000) / 1000,
			materiale, stampa, lamina, resina, totale: r2(materiale + stampa + lamina + resina),
			laminato, resinato, impaginazione: impC,
			unitari: { materialeId: m.id, materialeLabel: m.label, materialeM2, stampaM2, laminaM2, resinaCm2 }
		};
	}
}

/** somme di un insieme di righe (ricavo, costo, margine); le righe senza costo contano nel ricavo ma non nel margine */
export interface Riepilogo { righe: number; conCosto: number; senzaCosto: number; stime: number; ricavo: number; ricavoConCosto: number; costo: number; margine: number; marginePct: number | null; mq: number }
export function riepilogo(righe: { ricavo: number; costo: CostoRiga }[]): Riepilogo {
	const out: Riepilogo = { righe: righe.length, conCosto: 0, senzaCosto: 0, stime: 0, ricavo: 0, ricavoConCosto: 0, costo: 0, margine: 0, marginePct: null, mq: 0 };
	for (const r of righe) {
		out.ricavo += r.ricavo;
		if (r.costo.stato === 'manca') { out.senzaCosto++; continue; }
		if (r.costo.stato === 'stima') out.stime++;
		out.conCosto++;
		out.ricavoConCosto += r.ricavo;
		out.costo += r.costo.totale;
		out.mq += r.costo.mq;
	}
	out.ricavo = r2(out.ricavo); out.ricavoConCosto = r2(out.ricavoConCosto); out.costo = r2(out.costo);
	out.margine = r2(out.ricavoConCosto - out.costo);
	out.marginePct = out.ricavoConCosto > 0 ? Math.round((out.margine / out.ricavoConCosto) * 1000) / 10 : null;
	out.mq = Math.round(out.mq * 100) / 100;
	return out;
}
