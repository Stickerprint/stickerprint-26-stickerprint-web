/**
 * Stickerprint Studio — montaggio di piu' soggetti sulla stessa striscia.
 *
 * Capita spesso che un ordine abbia tre lavori diversi da 50 pezzi l'uno: stamparli su tre strisce
 * separate spreca materiale e tre avviamenti di macchina. Qui i soggetti si mettono UNO ACCANTO
 * ALL'ALTRO sulla stessa striscia.
 *
 * Ogni soggetto diventa un BLOCCO rettangolare:
 *   - prodotti a fogli (resinati, etichette): il blocco e' il foglio, col passante sul bordo e le
 *     etichette in mezzo mezzo-tagliate; se i pezzi non stanno in un foglio solo ne nascono piu' d'uno;
 *   - prodotti sciolti (personalizzati, rilievo, vetrofanie): il blocco e' il gruppo dei pezzi,
 *     tutti a taglio passante, senza bordo.
 *
 * Le regole dei singoli fogli non cambiano di una virgola rispetto a quelle di `layout.ts`: bordo,
 * stacco minimo e testa di resinatura sono gli stessi. Quello che il montatore sceglie in piu' e' la
 * GRIGLIA di ogni blocco, perche' la stessa quantita' sta in fogli di forma diversa (50 tondi stanno
 * in 5x10 o in 10x5) e fra tutte le combinazioni si cerca quella che consuma meno striscia.
 */
import { versiDi, type Grid, type Placement, type SheetRules, type Verso } from './layout';

/** un soggetto da montare: il suo taglio, quanti pezzi servono e come si produce */
export interface Soggetto {
	/** indice della grafica nel file di stampa (Artwork) */
	nome: string;
	cutW: number;
	cutH: number;
	/** pezzi da fare in tutto (scarti compresi) */
	qty: number;
	/** 'fogli' = etichette dentro un foglio squadrato; 'sciolti' = sagome libere */
	modo: 'fogli' | 'sciolti';
	/** regole del foglio (solo modo fogli) */
	rules?: SheetRules;
	/** stacco fra i pezzi nel modo sciolti (di solito 8 mm) */
	gap?: number;
	/** verso dei pezzi, se l'operatore lo forza */
	verso?: Verso;
}

/** un blocco piazzato sulla striscia */
export interface Blocco {
	/** quale soggetto (indice nell'elenco passato) */
	soggetto: number;
	x: number;
	y: number;
	w: number;
	h: number;
	/** pezzi in coordinate della striscia */
	pieces: Placement[];
	/** bordo del foglio da tagliare col passante (solo modo fogli) */
	foglio?: { x: number; y: number; w: number; h: number; rot: boolean };
	grid: Grid;
}

export interface StripMontata {
	w: number;
	h: number;
	blocchi: Blocco[];
}

export interface MontaOptions {
	/** larghezza della pagina stampata (crocini compresi) */
	pageW: number;
	/** altezza massima che l'operatore accetta per una striscia */
	maxH: number;
	/** margine laterale (fuori dai bracci dei crocini) */
	margin: number;
	/** margine sopra e sotto (fasce dei codici a barre) */
	marginY: number;
	/** stacco fra un blocco e l'altro */
	gapBlocchi: number;
}

export interface MontaResult {
	ok: boolean;
	error?: string;
	strips: StripMontata[];
	/** quanto e' alta la striscia montata */
	altezza: number;
	/** avvisi da mostrare all'operatore (es. soggetto spezzato su piu' strisce) */
	note: string[];
}

const EPS = 1e-6;

/** quanta striscia occupa in larghezza un soggetto con questa griglia, stacchi compresi */
const ingombro = (c: Cand) => c.w * c.quanti;

/** candidato: un modo di impaginare un soggetto in uno o piu' blocchi tutti uguali */
interface Cand {
	/** misure del blocco */
	w: number;
	h: number;
	grid: Grid;
	/** quanti blocchi servono per fare tutti i pezzi */
	quanti: number;
	/** pezzi dentro il blocco, rispetto al suo angolo */
	dentro: Placement[];
	foglio: boolean;
}

/** tutte le griglie sensate per un soggetto, dalla piu' stretta alla piu' larga */
function candidati(s: Soggetto, o: MontaOptions): Cand[] {
	const out: Cand[] = [];
	const maxW = o.pageW - 2 * o.margin;
	const maxH = o.maxH - 2 * o.marginY;
	const bordo = s.modo === 'fogli' ? (s.rules?.margin ?? 0) : 0;
	const gap = s.modo === 'fogli' ? (s.rules?.gap ?? 2) : (s.gap ?? 8);
	const testa = s.modo === 'fogli' ? (s.rules?.testa ?? null) : null;

	for (const rot of versiDi(s.verso)) {
		const pw = rot ? s.cutH : s.cutW, ph = rot ? s.cutW : s.cutH;
		const maxCols = Math.max(1, Math.floor((maxW - 2 * bordo + gap + EPS) / (pw + gap)));
		const maxRows = Math.max(1, Math.floor((maxH - 2 * bordo + gap + EPS) / (ph + gap)));
		for (let cols = 1; cols <= maxCols; cols++) {
			for (let rows = 1; rows <= maxRows; rows++) {
				const n = cols * rows;
				/* testa di resinatura: le colonne si dividono gli aghi e il foglio e' un multiplo della testa */
				if (testa && (testa % cols || n % testa)) continue;
				const w = cols * pw + (cols - 1) * gap + 2 * bordo;
				const h = rows * ph + (rows - 1) * gap + 2 * bordo;
				if (w > maxW + EPS || h > maxH + EPS) continue;
				const quanti = Math.ceil(s.qty / n);
				/* niente griglie assurde: se un blocco tiene piu' del doppio dei pezzi che servono
				   si sta sprecando materiale (vale solo quando basta un blocco solo) */
				if (quanti === 1 && n > s.qty * 2 && n - s.qty > (testa ?? 1)) continue;
				const dentro: Placement[] = [];
				for (let r = 0; r < rows; r++)
					for (let c = 0; c < cols; c++)
						dentro.push({ x: bordo + c * (pw + gap), y: bordo + r * (ph + gap), rot });
				out.push({ w, h, grid: { cols, rows, n, rot, w: w - 2 * bordo, h: h - 2 * bordo }, quanti, dentro, foglio: s.modo === 'fogli' });
			}
		}
	}
	return out;
}

/** scelta per un soggetto, nella combinazione in esame */
interface Scelta { cand: Cand; }

/**
 * Monta i soggetti su una striscia sola, affiancati. Si prova ogni combinazione di griglie e vince
 * quella che fa la striscia PIU' BASSA (meno materiale); a pari altezza, quella piu' stretta.
 * Se tutti i blocchi non entrano in larghezza, si passa alla striscia successiva.
 */
export function montaStriscia(soggetti: Soggetto[], o: MontaOptions): MontaResult {
	const note: string[] = [];
	if (!soggetti.length) return { ok: false, error: 'Nessun soggetto da montare.', strips: [], altezza: 0, note };

	const liste = soggetti.map((s) => candidati(s, o));
	for (const [i, l] of liste.entries())
		if (!l.length) return { ok: false, error: `"${soggetti[i].nome}" non ci sta nella striscia: controlla misure e altezza massima.`, strips: [], altezza: 0, note };

	/* Di ogni soggetto si tengono solo le griglie che offrono un VERO compromesso fra larghezza e
	   altezza (fronte di Pareto): se una griglia e' insieme piu' stretta e piu' bassa di un'altra,
	   l'altra non serve a niente. Cosi' restano pochi candidati senza buttare via la soluzione buona
	   — tenere solo le piu' strette faceva perdere i montaggi ben bilanciati. */
	const CAP = 18;
	const potate = liste.map((l) => {
		const ord = [...l].sort((a, b) => ingombro(a) - ingombro(b) || a.h - b.h);
		const keep: Cand[] = [];
		let minH = Infinity;
		for (const c of ord) {
			if (c.h >= minH - EPS) continue;        // piu' larga E non piu' bassa: dominata
			minH = c.h;
			keep.push(c);
			if (keep.length >= CAP) break;
		}
		return keep;
	});

	const maxW = o.pageW - 2 * o.margin;
	let best: { scelte: Scelta[]; h: number; w: number } | null = null;
	const scelte: Scelta[] = [];
	const cerca = (i: number) => {
		if (i === potate.length) {
			const larghezze = scelte.map((s, k) => s.cand.w * s.cand.quanti + o.gapBlocchi * (s.cand.quanti - 1) + (k ? o.gapBlocchi : 0));
			const w = larghezze.reduce((a, b) => a + b, 0);
			if (w > maxW + EPS) return;                       // non entra: scartata
			const h = Math.max(...scelte.map((s) => s.cand.h));
			if (!best || h < best.h - EPS || (Math.abs(h - best.h) < EPS && w < best.w - EPS)) best = { scelte: [...scelte], h, w };
			return;
		}
		for (const c of potate[i]) { scelte.push({ cand: c }); cerca(i + 1); scelte.pop(); }
	};
	cerca(0);

	/* tutti insieme non entrano: si riempiono piu' strisce, in ordine, con la griglia piu' stretta */
	if (!best) {
		note.push('I soggetti non entrano tutti in una striscia: li ho divisi su piu' + '’' + ' strisce.');
		return piuStrisce(soggetti, potate, o, note);
	}

	const scelto = best as { scelte: Scelta[]; h: number; w: number };
	const h = Math.round((scelto.h + 2 * o.marginY) * 10) / 10;
	const blocchi: Blocco[] = [];
	let x = o.margin + (maxW - scelto.w) / 2;                  // il montaggio sta in mezzo alla striscia
	soggetti.forEach((s, i) => {
		const c = scelto.scelte[i].cand;
		let restano = s.qty;
		for (let k = 0; k < c.quanti; k++) {
			const quanti = Math.min(restano, c.grid.n);
			blocchi.push(bloccoA(i, c, x, o.marginY, quanti));
			restano -= quanti;
			x += c.w + o.gapBlocchi;
		}
	});
	return { ok: true, strips: [{ w: o.pageW, h, blocchi }], altezza: h, note };
}

function bloccoA(soggetto: number, c: Cand, x: number, y: number, quanti: number): Blocco {
	return {
		soggetto, x, y, w: c.w, h: c.h, grid: c.grid,
		pieces: c.dentro.slice(0, quanti).map((p) => ({ x: p.x + x, y: p.y + y, rot: p.rot })),
		foglio: c.foglio ? { x, y, w: c.w, h: c.h, rot: false } : undefined
	};
}

/** ripiego: i soggetti non entrano in una striscia sola, si riempiono piu' strisce in ordine */
function piuStrisce(soggetti: Soggetto[], potate: Cand[][], o: MontaOptions, note: string[]): MontaResult {
	const maxW = o.pageW - 2 * o.margin;
	const coda = soggetti.map((s, i) => ({ i, s, c: potate[i][0], restano: s.qty }));
	const strips: StripMontata[] = [];
	let riga: Blocco[] = [], usata = 0, altaMax = 0;
	const chiudi = () => {
		if (!riga.length) return;
		const h = Math.round((altaMax + 2 * o.marginY) * 10) / 10;
		const dx = o.margin + (maxW - usata) / 2 - (riga[0]?.x ?? 0);
		strips.push({ w: o.pageW, h, blocchi: riga.map((b) => ({ ...b, x: b.x + dx, pieces: b.pieces.map((p) => ({ ...p, x: p.x + dx })) })) });
		riga = []; usata = 0; altaMax = 0;
	};
	for (const e of coda) {
		while (e.restano > 0) {
			const serve = e.c.w + (riga.length ? o.gapBlocchi : 0);
			if (usata + serve > maxW + EPS) { chiudi(); continue; }
			const x = o.margin + usata + (riga.length ? o.gapBlocchi : 0);
			const quanti = Math.min(e.restano, e.c.grid.n);
			riga.push(bloccoA(e.i, e.c, x, o.marginY, quanti));
			usata += serve;
			altaMax = Math.max(altaMax, e.c.h);
			e.restano -= quanti;
		}
	}
	chiudi();
	if (!strips.length) return { ok: false, error: 'Non riesco a montare i soggetti: non ci stanno nella striscia.', strips: [], altezza: 0, note };
	return { ok: true, strips, altezza: Math.max(...strips.map((s) => s.h)), note };
}
