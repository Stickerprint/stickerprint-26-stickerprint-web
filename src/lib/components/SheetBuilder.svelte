<script lang="ts">
	/**
	 * Fogli di adesivi: il cliente sceglie il foglio (verticale/orizzontale, tre formati), un materiale per
	 * tutto il foglio, lo sfondo (colore o immagine) e carica i design (6 / 8 / 12 a seconda del formato).
	 * Ogni file passa dal motore degli adesivi (popup: sagoma, bordo, misura), poi cade sul foglio dove si
	 * sposta col mouse. Un adesivo che esce dal bordo trasforma il foglio in "sagomato": il taglio lo segue.
	 * In alternativa: "ho gia' il foglio impaginato" → un solo file, senza anteprima.
	 */
	import '$lib/styles/kit.css';
	import '$lib/styles/sheet.css';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { track } from '$lib/tracking';
	import { klaviyo } from '$lib/klaviyo';
	import FreeShippingBar from './FreeShippingBar.svelte';
	import EnginePreview from './EnginePreview.svelte';
	import { addToCart, cartGross as cartGrossOf, onCartChange } from '$lib/cart';
	import { saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { quoteWith, type EngineConfig } from '$lib/pricing/engine';
	import { matKindOf, paintSheetBackground } from '$lib/material-texture';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';
	import { mmToUnit, unitToMm, snapMm } from '$lib/i18n';
	const { t, lang, locale, prezzo, prezzoUnit, numero, path, unit, misuraU, misure } = usaLingua();
	const inU = (mm: number) => (unit === 'in' ? Math.round(mmToUnit(mm, unit) * 100) / 100 : mm);
	/** etichetta di una voce del listino (materiale, lamina, sagoma, orientamento, formato) nella lingua: dal catalogo se c'e', altrimenti quella del listino */
	const opz = (id: string, campo: 'label' | 'description' | 'tag', fallback?: string) => { const k = `fogli.opzioni.${id}.${campo}`; const v = t(k); return v === k ? (fallback ?? '') : v; };
	/* soglia della spedizione gratuita del locale (50 € IT, 69 € UE, 99 $ USA), mai scritta a mano */
	const soglia = formatAmount(locale.freeShipping, locale, 0);

	let { cfg, shipDate }: { cfg: EngineConfig; shipDate: string } = $props();
	let cartGross = $state(0);
	onMount(() => { cartGross = cartGrossOf(); return onCartChange(() => { cartGross = cartGrossOf(); }); });

	/* ---- formati del foglio (misure in mm, lato corto × lato lungo) e quanti design ci stanno ---- */
	/* le etichette (Piccolo / Medio / Grande) stanno nel catalogo: fogli.opzioni.S/M/L */
	const FORMATI = [
		{ id: 'S', a: 100, b: 150, max: 6, cols: 2, rows: 3 },
		{ id: 'M', a: 148, b: 210, max: 8, cols: 2, rows: 4 },
		{ id: 'L', a: 213, b: 275, max: 12, cols: 3, rows: 4 }
	] as const;
	type FormatoId = (typeof FORMATI)[number]['id'];
	let orientamento = $state<'verticale' | 'orizzontale'>('verticale');
	let formato = $state<FormatoId>('M');
	const fmt = $derived(FORMATI.find((f) => f.id === formato) ?? FORMATI[1]);
	const sheetW = $derived(orientamento === 'verticale' ? fmt.a : fmt.b);
	const sheetH = $derived(orientamento === 'verticale' ? fmt.b : fmt.a);
	const cols = $derived(orientamento === 'verticale' ? fmt.cols : fmt.rows);
	const rows = $derived(orientamento === 'verticale' ? fmt.rows : fmt.cols);
	const MAX = $derived(fmt.max);
	const MARGIN = 6; // mm dal bordo alle celle
	const cellW = $derived((sheetW - 2 * MARGIN) / cols);
	const cellH = $derived((sheetH - 2 * MARGIN) / rows);

	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	let materiale = $state('bianco');
	let finitura = $state('');
	$effect(() => { if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco'; if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => !f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna'; });
	const material = $derived(MATERIALS.find((m) => m.id === materiale));
	/* il materiale si vede sotto lo sfondo: la stampa non e' coprente (olografico → foglio olografico, blu su glitter → blu glitterato) */
	const matKind = $derived(matKindOf(materiale));
	const finish = $derived(FINISHES.find((f) => f.id === finitura));
	/* sagome del popup: etichette dal catalogo (fogli.opzioni.<id>.label) */
	const SHAPES = ['sagomato', 'tondo', 'quadrato', 'ovale', 'rettangolare'];

	/* ---- sfondo del foglio: colore o immagine ---- */
	let bgColor = $state('#ffffff');
	let bgFile = $state<File | null>(null);
	let bgUrl = $state<string | null>(null);
	function pickBg(e: Event) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (!f || !/^image\//.test(f.type)) return; if (bgUrl) URL.revokeObjectURL(bgUrl); bgFile = f; bgUrl = URL.createObjectURL(f); }
	function clearBg() { if (bgUrl) URL.revokeObjectURL(bgUrl); bgFile = null; bgUrl = null; }
	const PRESET_COLORS = ['#ffffff', '#fff7d6', '#ffe4ec', '#e6f4ff', '#e9fbe5', '#f3e8ff', '#0b0b3b', '#111111'];

	/* ---- gli adesivi sul foglio ---- */
	type View = { zoom: number; dx: number; dy: number };
	type Cut = { x: number; y: number; w: number; h: number };
	type Render = { png: string; w: number; h: number; view: View | null; cut: Cut | null };
	type Slot = { file: File | null; png: string | null; w: number; h: number; cfgW: number; cfgH: number; misura: number; forma: string; x: number; y: number; rot: number; busy: boolean };
	const blank = (): Slot => ({ file: null, png: null, w: 0, h: 0, cfgW: 0, cfgH: 0, misura: 40, forma: 'sagomato', x: 0, y: 0, rot: 0, busy: false });
	let slots = $state<Slot[]>(Array.from({ length: 12 }, blank));
	const filled = $derived(slots.slice(0, MAX).filter((s) => s.file));
	const n = $derived(filled.length);
	const FREE_MIN = 10;
	const freeMax = $derived(Math.round(Math.max(cellW, cellH) * 1.6));
	const clampMM = (v: number) => snapMm(Math.max(FREE_MIN, Math.min(freeMax, v || 0)), unit);
	/** un adesivo sporge dal foglio: il foglio diventa sagomato e il taglio lo segue */
	const bbox = (s: Slot) => { const a = (s.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), n = Math.abs(Math.sin(a)); return { w: s.w * c + s.h * n, h: s.w * n + s.h * c }; };
	const overhang = (s: Slot) => { if (!s.png) return false; const b = bbox(s); return s.x - b.w / 2 < 0 || s.y - b.h / 2 < 0 || s.x + b.w / 2 > sheetW || s.y + b.h / 2 > sheetH; };
	const sagomato = $derived(filled.some(overhang));
	const forma = $derived(sagomato ? 'sagomato' : orientamento);

	/* ---- prezzo: dal listino dei fogli, per formato e quantita' ---- */
	// svelte-ignore state_referenced_locally
	let qty = $state(cfg.recommendedQty || 100);
	let vatIncluded = $state(true);
	const QTY = $derived(cfg.quantities.length ? cfg.quantities : [15, 50, 100, 200, 300, 500, 1000]);
	const q = $derived(quoteWith(cfg, { w: sheetW, h: sheetH, forma, materiale, finitura, qty, vatIncluded }));

	/* ---- passaggi ---- */
	let pronto = $state(false);   // "ho gia' il foglio impaginato": un solo file, niente anteprima
	let step = $state<'foglio' | 'materiale' | 'sfondo' | 'adesivi' | 'qty'>('foglio');
	const STEPS = $derived(pronto ? (['foglio', 'materiale', 'adesivi', 'qty'] as const) : (['foglio', 'materiale', 'sfondo', 'adesivi', 'qty'] as const));
	const stepNo = (s: string) => STEPS.indexOf(s as never) + 1;
	const progress = $derived((stepNo(step) / STEPS.length) * 100);
	$effect(() => { if (!STEPS.includes(step as never)) step = 'adesivi'; });
	let adding = $state(false);
	let flash = $state('');
	let readyFile = $state<File | null>(null);
	let readyUrl = $state<string | null>(null);
	function pickReady(e: Event) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (!f || !ok(f)) return; if (readyUrl) URL.revokeObjectURL(readyUrl); readyFile = f; readyUrl = /^image\//.test(f.type) ? URL.createObjectURL(f) : null; }
	onMount(() => { setTimeout(() => track.viewItem({ product: 'fogli_adesivi', productName: 'Fogli di adesivi', forma: orientamento, w: sheetW, h: sheetH, materiale, finitura, qty, gross: q.gross }), 500); });

	/* ---- popup con il motore (stesso schema del kit: un motore per file, sempre montato) ---- */
	type Pop = { key: string; index: number; file: File; misura: number; forma: string; w: number; h: number; ratio: number; last: Render | null; busy: boolean; forced: number };
	let pop = $state<Pop | null>(null);
	type Eng = { key: string; index: number; file: File };
	let engines = $state<Eng[]>([]);
	let engRefs = $state<Record<string, EnginePreview | undefined>>({});
	const keyOf = (i: number) => `s${i}`;
	function engForma(e: Eng) { return pop?.key === e.key ? pop.forma : (slots[e.index]?.forma ?? 'sagomato'); }
	function engW(e: Eng) { return pop?.key === e.key ? pop.w : (slots[e.index]?.cfgW || 0); }
	function engH(e: Eng) { return pop?.key === e.key ? pop.h : (slots[e.index]?.cfgH || 0); }
	const equal = (f: string) => f === 'tondo' || f === 'quadrato';
	const ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf';
	function ok(f: File) { return /^image\//.test(f.type) || /\.(pdf|svg|png|jpe?g|webp)$/i.test(f.name); }
	function openPop(index: number, file: File) {
		if (!ok(file)) return;
		const misura = slots[index]?.misura || Math.round(Math.min(cellW, cellH) * 0.85);
		const f = slots[index]?.forma || 'sagomato';
		const key = keyOf(index);
		pop = { key, index, file, misura, forma: f, w: misura, h: Math.round(misura * 0.8), ratio: 0, last: null, busy: true, forced: 0 };
		setPopSize(misura);
		const e = engines.find((x) => x.key === key);
		if (!e) engines.push({ key, index, file });
		else if (e.file !== file) e.file = file;
		else setTimeout(() => engRefs[key]?.post('snapshot'), 150);
	}
	type R = { png: string | null; name?: string | null; shape?: string | null; w: number; h: number; view?: View | null; cut?: Cut | null };
	const ENGINE_SHAPE: Record<string, string> = { sagomato: 'diecut', tondo: 'circle', quadrato: 'square', ovale: 'ellipse', rettangolare: 'rect' };
	const baseName = (f: File) => f.name.replace(/\.[^.]+$/, '');
	function engRender(e: Eng, r: R) {
		if (!r.png) return;
		if (r.name && r.name !== baseName(e.file)) return;
		if (pop && pop.key === e.key) { popRender(r); return; }
		const s = slots[e.index]; if (!s || s.file !== e.file) return;
		cropCut(r.png, r.cut ?? null).then((png) => { if (slots[e.index]?.file === e.file) { slots[e.index].png = png; slots[e.index].w = r.w; slots[e.index].h = r.h; slots[e.index].busy = false; } });
	}
	function popRender(r: R) {
		if (!pop || !r.png) return;
		if (r.shape && ENGINE_SHAPE[pop.forma] && r.shape !== ENGINE_SHAPE[pop.forma]) return;
		if (pop.forma !== 'sagomato' && pop.forced < 3 && (Math.abs(r.w - pop.w) > 0.6 || Math.abs(r.h - pop.h) > 0.6)) {
			pop.forced++;
			engRefs[pop.key]?.post('config', { config: { forma: pop.forma, w: pop.w, h: pop.h, materiale, lamina: finitura, prodotto: 'sticker' } });
			return;
		}
		pop.last = { png: r.png, w: r.w, h: r.h, view: r.view ?? null, cut: r.cut ?? null }; pop.busy = false;
		if (pop.forma === 'sagomato' && r.w > 0 && r.h > 0 && !pop.ratio) { pop.ratio = r.w / r.h; setPopSize(pop.misura); }
	}
	function setPopSize(m: number) {
		if (!pop) return;
		m = clampMM(m); pop.misura = m;
		if (equal(pop.forma)) { pop.w = m; pop.h = m; }
		else if (pop.forma === 'sagomato') { const r = pop.ratio || 1.25; if (r >= 1) { pop.w = m; pop.h = Math.round((m / r) * 2) / 2; } else { pop.h = m; pop.w = Math.round(m * r * 2) / 2; } }
		else { pop.w = m; pop.h = Math.round(m * 0.66 * 2) / 2; }
		pop.busy = true;
	}
	function setPopWH(w: number, h: number) { if (!pop) return; pop.w = clampMM(w); pop.h = clampMM(h); pop.misura = Math.max(pop.w, pop.h); pop.busy = true; }
	function setPopShape(f: string) { if (!pop) return; pop.forma = f; pop.ratio = 0; pop.forced = 0; pop.last = null; setPopSize(pop.misura); }
	async function cropCut(png: string, cut: Cut | null): Promise<string> {
		if (!cut || cut.w < 2 || cut.h < 2) return png;
		try {
			const im = await load(png); const c = document.createElement('canvas'); c.width = Math.round(cut.w); c.height = Math.round(cut.h);
			const g = c.getContext('2d'); if (!g) return png;
			g.drawImage(im, cut.x, cut.y, cut.w, cut.h, 0, 0, c.width, c.height); return c.toDataURL('image/png');
		} catch { return png; }
	}
	/** posizione libera piu' vicina alla cella k della griglia (gli altri adesivi non si spostano) */
	function cellCenter(k: number): [number, number] {
		const c = k % cols, r = Math.floor(k / cols);
		return [MARGIN + cellW * (c + 0.5), MARGIN + cellH * (r + 0.5)];
	}
	function confirmPop() {
		if (!pop?.last) return;
		const p = pop, last = pop.last; pop = null;
		const s = slots[p.index];
		const isNew = !s.file;
		s.file = p.file; s.w = last.w; s.h = last.h; s.cfgW = p.w; s.cfgH = p.h; s.misura = p.misura; s.forma = p.forma; s.busy = true;
		if (isNew) { const [cx, cy] = cellCenter(p.index); s.x = cx; s.y = cy; }
		cropCut(last.png, last.cut).then((png) => { if (slots[p.index]?.file === p.file) { slots[p.index].png = png; slots[p.index].busy = false; } });
		if (filled.length + 1 >= MAX && step === 'adesivi') step = 'qty';
	}
	function cancelPop() {
		if (!pop) return;
		const key = pop.key, index = pop.index; pop = null;
		const confirmed = slots[index]?.file;
		const i = engines.findIndex((x) => x.key === key);
		if (i < 0) return;
		if (confirmed) engines[i].file = confirmed; else engines.splice(i, 1);
	}
	function pickSlot(e: Event, i: number) { const f = (e.currentTarget as HTMLInputElement).files?.[0]; (e.currentTarget as HTMLInputElement).value = ''; if (f) openPop(i, f); }
	function removeSticker(i: number) { if (selected === i) selected = null; slots[i] = blank(); const k = engines.findIndex((x) => x.key === keyOf(i)); if (k >= 0) engines.splice(k, 1); }
	let over = $state(false);
	let pending: File[] = [];
	function onDrop(e: DragEvent) {
		e.preventDefault(); over = false;
		if (pronto) return;
		const list = Array.from(e.dataTransfer?.files ?? []).filter(ok);
		if (!list.length) return;
		pending = list; nextPending();
	}
	function nextPending() {
		if (pop) return;
		const f = pending.shift(); if (!f) return;
		const i = slots.slice(0, MAX).findIndex((s) => !s.file);
		if (i < 0) { flash = t('fogli.builder.design.pieno', { max: MAX }); pending = []; return; }
		openPop(i, f);
	}
	$effect(() => { if (!pop && pending.length) setTimeout(nextPending, 250); });
	/* materiale o lamina cambiati: i motori ridisegnano da soli, qui solo lo stato "aggiorno" */
	let lastMat = '';
	$effect(() => {
		const key = `${materiale}|${finitura}`;
		if (key === lastMat) return;
		const first = lastMat === ''; lastMat = key;
		if (first) return;
		slots.forEach((sl) => { if (sl.file) sl.busy = true; });
		setTimeout(() => slots.forEach((sl) => { sl.busy = false; }), 15000);
	});
	/* formato o orientamento cambiati: gli adesivi oltre il nuovo numero massimo escono, gli altri si riallineano alla griglia */
	let lastFmt = '';
	$effect(() => {
		const key = `${formato}|${orientamento}`;
		if (key === lastFmt) return;
		const first = lastFmt === ''; lastFmt = key;
		if (first) return;
		slots.forEach((s, i) => { if (i >= MAX && s.file) removeSticker(i); });
		slots.forEach((s, i) => { if (s.file) { const [cx, cy] = cellCenter(i); s.x = cx; s.y = cy; } });
	});

	/* ---- il foglio a schermo: scala mm → px, trascinamento ---- */
	let bgCanvas = $state<HTMLCanvasElement | undefined>();
	$effect(() => {
		const c = bgCanvas; const k = matKind; const col = bgColor; const W = sheetW; const H = sheetH;
		if (!c) return;
		c.width = Math.round(W * 4); c.height = Math.round(H * 4);
		const g = c.getContext('2d'); if (!g) return;
		g.clearRect(0, 0, c.width, c.height);
		if (k === 'white') { g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); }
		else paintSheetBackground(g, 0, 0, c.width, c.height, k, col);
	});
	let stage = $state<HTMLDivElement | undefined>();
	let stageW = $state(520);
	onMount(() => { const ro = new ResizeObserver(() => { if (stage) stageW = stage.clientWidth; }); if (stage) ro.observe(stage); return () => ro.disconnect(); });
	const PAD = 22; // mm di aria attorno al foglio (dove gli adesivi possono sporgere)
	const scale = $derived(stageW / (sheetW + 2 * PAD));
	const px = (mm: number) => mm * scale;
	/* barra con rotazione e misura: resta sempre dentro l'anteprima. Vicino ai bordi laterali si ferma al margine,
	   vicino al bordo alto passa sotto il design (prima usciva dalla pagina e spariva, soprattutto su telefono) */
	let toolsW = $state(290);
	function toolsPos(s: Slot) {
		const half = toolsW / 2 + 4;
		const left = stageW <= half * 2 ? stageW / 2 : Math.min(Math.max(px(PAD + s.x), half), stageW - half);
		const above = px(PAD + s.y - bbox(s).h / 2) - 46;
		const top = above < 4 ? px(PAD + s.y + bbox(s).h / 2) + 10 : above;
		return { left, top };
	}
	let drag: { i: number; sx: number; sy: number; x0: number; y0: number } | null = null;
	let top = $state(10);
	function down(e: PointerEvent, i: number) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		selected = i;
		drag = { i, sx: e.clientX, sy: e.clientY, x0: slots[i].x, y0: slots[i].y };
		top += 1; (e.currentTarget as HTMLElement).style.zIndex = String(top);
		e.preventDefault();
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const s = slots[drag.i];
		const x = drag.x0 + (e.clientX - drag.sx) / scale, y = drag.y0 + (e.clientY - drag.sy) / scale;
		/* puo' uscire dal foglio, ma resta con almeno meta' adesivo dentro: cosi' il foglio sagomato ha sempre un aggancio */
		const b = bbox(s);
		s.x = Math.max(b.w * 0.25, Math.min(sheetW - b.w * 0.25, x));
		s.y = Math.max(b.h * 0.25, Math.min(sheetH - b.h * 0.25, y));
	}
	function up() { drag = null; }
	/* adesivo selezionato: sopra compare la barra con rotazione e misura */
	let selected = $state<number | null>(null);
	function rotate(i: number, deg: number) { const s = slots[i]; s.rot = ((s.rot + deg) % 360 + 360) % 360; }
	function resize(i: number, k: number) {
		const s = slots[i]; const long = Math.max(s.w, s.h);
		const target = Math.round(Math.max(FREE_MIN, Math.min(freeMax, long * k)) * 2) / 2;
		const f = target / long; s.w = Math.round(s.w * f * 10) / 10; s.h = Math.round(s.h * f * 10) / 10; s.misura = Math.max(s.w, s.h);
		/* anche il motore passa alla nuova misura: cosi' l'adesivo viene ridisegnato alla risoluzione giusta e la misura resta quando cambia il materiale */
		if (s.cfgW && s.cfgH) { s.cfgW = Math.round(s.cfgW * f * 2) / 2; s.cfgH = Math.round(s.cfgH * f * 2) / 2; s.busy = true; setTimeout(() => { if (slots[i]?.busy) slots[i].busy = false; }, 15000); }
	}
	function centerAll() { slots.forEach((s, i) => { if (s.file) { const [cx, cy] = cellCenter(i); s.x = cx; s.y = cy; } }); }

	/* ---- file di stampa e anteprima: il foglio composto (sfondo + adesivi) a 12 px/mm, trasparente fuori dal taglio ---- */
	const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
	async function sheetPng(ppm: number): Promise<Blob | null> {
		const extra = sagomato ? PAD : 0;
		const W = Math.round((sheetW + 2 * extra) * ppm), H = Math.round((sheetH + 2 * extra) * ppm);
		const c = document.createElement('canvas'); c.width = W; c.height = H;
		const g = c.getContext('2d'); if (!g) return null;
		const ox = extra * ppm, oy = extra * ppm, r = 4 * ppm;
		const rr = (x: number, y: number, w: number, h: number, rad: number) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
		g.save(); rr(ox, oy, sheetW * ppm, sheetH * ppm, r); g.clip();
		if (matKind === 'white') { g.fillStyle = bgColor; g.fillRect(ox, oy, sheetW * ppm, sheetH * ppm); }
		else paintSheetBackground(g, ox, oy, sheetW * ppm, sheetH * ppm, matKind, bgColor);
		if (bgUrl) { try { const im = await load(bgUrl); const k = Math.max((sheetW * ppm) / im.width, (sheetH * ppm) / im.height); const dw = im.width * k, dh = im.height * k; g.drawImage(im, ox + (sheetW * ppm - dw) / 2, oy + (sheetH * ppm - dh) / 2, dw, dh); } catch { /* senza sfondo */ } }
		g.restore();
		for (const s of filled) {
			if (!s.png) continue;
			try { const im = await load(s.png); g.save(); g.translate(ox + s.x * ppm, oy + s.y * ppm); g.rotate((s.rot * Math.PI) / 180); g.drawImage(im, (-s.w / 2) * ppm, (-s.h / 2) * ppm, s.w * ppm, s.h * ppm); g.restore(); } catch { /* adesivo saltato */ }
		}
		return new Promise((res) => c.toBlob(res, 'image/png'));
	}
	const readyToAdd = $derived(pronto ? !!readyFile : n > 0 && slots.every((s) => !s.busy));
	async function addSheet() {
		if (!readyToAdd || adding) return;
		adding = true;
		try {
			const quote = quoteWith(cfg, { w: sheetW, h: sheetH, forma, materiale, finitura, qty, vatIncluded: true });
			const fmtLabel = `${sheetW}×${sheetH} mm`;
			if (pronto && readyFile) {
				const item = addToCart({ product: 'fogli_adesivi', productName: t('checkout.carrello.fogliNome'), engineProduct: 'sticker', forma: orientamento, materiale, finitura, w: sheetW, h: sheetH, qty, net: quote.net, gross: quote.gross, fileName: readyFile.name, note: t('checkout.carrello.foglioPronto') });
				await saveCartFile(item.id, readyFile);
				if (readyUrl) { try { const b = await fetch(readyUrl).then((r) => r.blob()); await saveCartPreview(item.id, b); } catch { /* niente anteprima */ } }
			} else {
				/* nome del file e nota nella lingua del cliente (le vede al checkout); l'impaginato per la produzione sta in layout.json */
				const design = t(n === 1 ? 'checkout.carrello.designUno' : 'checkout.carrello.designTanti', { n });
				const item = addToCart({ product: 'fogli_adesivi', productName: t('checkout.carrello.fogliNome'), engineProduct: 'sticker', forma, materiale, finitura, w: sheetW, h: sheetH, qty, net: quote.net, gross: quote.gross, fileName: t('checkout.carrello.foglioFile', { formato: fmtLabel, design }), note: t('checkout.carrello.foglioNota', { orientamento: opz(orientamento, 'label', orientamento).toLowerCase(), formato: fmtLabel, sagomato: sagomato ? t('checkout.carrello.foglioSagomato') : '', design, sfondo: bgFile ? t('checkout.carrello.sfondoImmagine') : bgColor }) });
				const print = await sheetPng(12);
				if (print) { const pf = new File([print], 'foglio.png', { type: 'image/png' }); await saveCartFile(item.id, pf); await saveCartFile(`${item.id}:foglio`, pf); }
				const preview = await sheetPng(3);
				if (preview) await saveCartPreview(item.id, preview);
				if (bgFile) await saveCartFile(`${item.id}:bg`, bgFile);
				let k = 0; for (const s of filled) if (s.file) { k++; await saveCartFile(`${item.id}:s${k}`, s.file); }
				const layout = { sheet: { w: sheetW, h: sheetH, orientamento, formato, sagomato, bgColor, bgImage: !!bgFile, materiale, finitura }, stickers: filled.map((s, i) => ({ n: i + 1, file: s.file?.name, forma: s.forma, w: s.w, h: s.h, x: s.x, y: s.y, rot: s.rot })) };
				await saveCartFile(`${item.id}:layout`, new File([JSON.stringify(layout, null, 2)], 'layout.json', { type: 'application/json' }));
			}
			track.addToCart({ product: 'fogli_adesivi', productName: 'Fogli di adesivi', forma, w: sheetW, h: sheetH, materiale, finitura, qty, gross: quote.gross });
			klaviyo.addedToCart({ productId: `fogli_adesivi_${forma}`, productName: `Fogli di adesivi ${fmtLabel}`, quantity: qty, dimension: fmtLabel, material: materiale, price: quote.gross });
			await goto(path('/checkout'));
		} finally { adding = false; }
	}
</script>

<section class="cfg kitcfg sheetcfg" id="configura">
	<!-- ANTEPRIMA: il foglio -->
	<div class="cfg__preview kit__preview">
		<div class="sheet__stage" class:is-over={over} bind:this={stage} style="height:{px(sheetH + 2 * PAD)}px" role="region" aria-label={t('fogli.builder.anteprima')} ondragover={(e) => { e.preventDefault(); over = true; }} ondragleave={() => (over = false)} ondrop={onDrop} onpointermove={move} onpointerup={up} onpointercancel={up}>
			{#if pronto}
				<div class="sheet" class:is-dark={!readyUrl} style="left:{px(PAD)}px;top:{px(PAD)}px;width:{px(sheetW)}px;height:{px(sheetH)}px;background:#fff">
					{#if readyUrl}<img class="sheet__ready" src={readyUrl} alt="" />{:else}<p class="sheet__hint">{readyFile ? t('fogli.builder.prontoCosi', { file: readyFile.name }) : t('fogli.builder.prontoHint')}</p>{/if}
				</div>
			{:else}
				<div class="sheet" class:is-cut={sagomato} style="left:{px(PAD)}px;top:{px(PAD)}px;width:{px(sheetW)}px;height:{px(sheetH)}px;background:{bgColor}">
					<canvas class="sheet__bg" bind:this={bgCanvas}></canvas>
					{#if bgUrl}<img class="sheet__bg" src={bgUrl} alt="" />{/if}
					{#if !n}<p class="sheet__hint">{t('fogli.builder.trascina')}<br /><small>{t('fogli.builder.trascinaSub', { max: MAX })}</small></p>{/if}
				</div>
				{#each slots.slice(0, MAX) as s, i (i)}
					{#if s.png}
						<img class="sheet__stk" class:is-out={overhang(s)} class:is-sel={selected === i} class:busy={s.busy} src={s.png} alt={t('fogli.builder.designAlt', { n: i + 1 })} draggable="false" style="left:{px(PAD + s.x - s.w / 2)}px;top:{px(PAD + s.y - s.h / 2)}px;width:{px(s.w)}px;height:{px(s.h)}px;transform:rotate({s.rot}deg)" onpointerdown={(e) => down(e, i)} />
						{#if selected === i}
							<div class="sheet__tools" bind:clientWidth={toolsW} style="left:{toolsPos(s).left}px;top:{toolsPos(s).top}px">
								<button type="button" title={t('fogli.builder.ruotaSx')} onclick={() => rotate(i, -15)}>↺</button>
								<button type="button" title={t('fogli.builder.ruotaDx')} onclick={() => rotate(i, 15)}>↻</button>
								<span class="sheet__tools-sep"></span>
								<button type="button" title={t('fogli.builder.riduci')} onclick={() => resize(i, 0.9)}>−</button>
								<span class="sheet__tools-mm">{misure(s.w, s.h)}</span>
								<button type="button" title={t('fogli.builder.ingrandisci')} onclick={() => resize(i, 1.1)}>+</button>
								<span class="sheet__tools-sep"></span>
								<button type="button" title={t('fogli.builder.chiudi')} onclick={() => (selected = null)}>✕</button>
							</div>
						{/if}
					{/if}
				{/each}
			{/if}
			<div class="sheet__size">{misure(sheetW, sheetH)}{#if sagomato} · {t('fogli.builder.sagomato')}{/if}</div>
		</div>
		{#if n && !pronto}<p class="kit__tip">{t('fogli.builder.tip')} <button type="button" class="link-btn" onclick={centerAll}>{t('fogli.builder.riallinea')}</button></p>{/if}
	</div>

	<!-- PASSAGGI -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div><p class="eyebrow">{t('fogli.builder.eyebrow')}</p><h2 class="cfg__title">{t('fogli.builder.titolo')}</h2></div>
			<span class="cfg__stepcount">{t('fogli.builder.passaggio', { n: stepNo(step), tot: STEPS.length })}</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- 1 foglio -->
		<div class="step" class:is-open={step === 'foglio'}>
			<button class="step__head" type="button" onclick={() => (step = 'foglio')} aria-expanded={step === 'foglio'}>
				<span class="step__n">{#if stepNo(step) > 1}✓{:else}1{/if}</span>
				<span class="step__title">{t('fogli.builder.foglio.titolo')} {#if step !== 'foglio'}<em>{opz(orientamento, 'label', orientamento)} · {opz(fmt.id, 'label', fmt.id)} {sheetW}×{sheetH} mm</em>{/if}</span>
				<span class="step__edit">{step === 'foglio' ? '' : t('fogli.builder.modifica')}</span>
			</button>
			{#if step === 'foglio'}
				<div class="step__body">
					<p class="step__hint">{t('fogli.builder.foglio.orientamento')}</p>
					<div class="sheet__opts">
						<button type="button" class="sheet__opt" class:is-active={orientamento === 'verticale'} onclick={() => (orientamento = 'verticale')}><i class="sheet__ico sheet__ico--v"></i><b>{opz('verticale', 'label', 'Verticale')}</b></button>
						<button type="button" class="sheet__opt" class:is-active={orientamento === 'orizzontale'} onclick={() => (orientamento = 'orizzontale')}><i class="sheet__ico sheet__ico--h"></i><b>{opz('orizzontale', 'label', 'Orizzontale')}</b></button>
					</div>
					<p class="step__hint" style="margin-top:12px">{t('fogli.builder.foglio.formato')}</p>
					<div class="sheet__opts sheet__opts--3">
						{#each FORMATI as f (f.id)}
							<button type="button" class="sheet__opt" class:is-active={formato === f.id} onclick={() => (formato = f.id)}><b>{opz(f.id, 'label', f.id)}</b><span>{orientamento === 'verticale' ? misure(f.a, f.b) : misure(f.b, f.a)}</span><small>{t('fogli.builder.foglio.finoA', { max: f.max })}</small></button>
						{/each}
					</div>
					<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px" onclick={() => (step = 'materiale')}>{t('fogli.builder.foglio.avanti')}</button>
				</div>
			{/if}
		</div>

		<!-- 2 materiale -->
		<div class="step" class:is-open={step === 'materiale'}>
			<button class="step__head" type="button" onclick={() => (step = 'materiale')} aria-expanded={step === 'materiale'}>
				<span class="step__n">{#if stepNo(step) > 2}✓{:else}2{/if}</span>
				<span class="step__title">{t('fogli.builder.materiale.titolo')} {#if step !== 'materiale'}<em>{material ? opz(material.id, 'label', material.label) : ''}{#if finish && FINISHES.length > 1}, {opz(finish.id, 'label', finish.label)}{/if}</em>{/if}</span>
				<span class="step__edit">{step === 'materiale' ? '' : t('fogli.builder.modifica')}</span>
			</button>
			{#if step === 'materiale'}
				<div class="step__body">
					<p class="step__hint">{t('fogli.builder.materiale.hint')}</p>
					<div class="pic-grid pic-grid--3 pic-grid--sm">
						{#each MATERIALS as m (m.id)}
							<button type="button" class="pic" class:is-active={materiale === m.id} onclick={() => { materiale = m.id; step = pronto ? 'adesivi' : 'sfondo'; }}>
								<img src={m.img} alt="" /><b>{opz(m.id, 'label', m.label)}</b>{#if m.tag}<span class="pic__tag">{opz(m.id, 'tag', m.tag)}</span>{/if}
							</button>
						{/each}
					</div>
					{#if FINISHES.length > 1}
						<p class="step__hint" style="margin-top:12px">{lang === 'it' && cfg.finishTitle ? cfg.finishTitle : t('fogli.builder.materiale.lamina')}</p>
						<div class="kit__chips">{#each FINISHES as f (f.id)}<button type="button" class="chip" class:is-on={finitura === f.id} onclick={() => (finitura = f.id)}>{opz(f.id, 'label', f.label)}</button>{/each}</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- 3 sfondo (solo con l'anteprima) -->
		{#if !pronto}
			<div class="step" class:is-open={step === 'sfondo'}>
				<button class="step__head" type="button" onclick={() => (step = 'sfondo')} aria-expanded={step === 'sfondo'}>
					<span class="step__n">{#if stepNo(step) > 3}✓{:else}3{/if}</span>
					<span class="step__title">{t('fogli.builder.sfondo.titolo')} {#if step !== 'sfondo'}<em>{bgFile ? t('fogli.builder.sfondo.immagine') : bgColor === '#ffffff' ? t('fogli.builder.sfondo.bianco') : bgColor}</em>{/if}</span>
					<span class="step__edit">{step === 'sfondo' ? '' : t('fogli.builder.modifica')}</span>
				</button>
				{#if step === 'sfondo'}
					<div class="step__body">
						<p class="step__hint">{t('fogli.builder.sfondo.hint')}{#if matKind !== 'white' && material} {t('fogli.builder.sfondo.hintMateriale', { materiale: opz(material.id, 'label', material.label).toLowerCase() })}{/if}</p>
						<div class="sheet__colors">
							{#each PRESET_COLORS as c (c)}<button type="button" class="sheet__color" class:is-on={bgColor === c && !bgFile} style="background:{c}" aria-label={t('fogli.builder.sfondo.colore', { colore: c })} onclick={() => { bgColor = c; clearBg(); }}></button>{/each}
							<label class="sheet__color sheet__color--free" title={t('fogli.builder.sfondo.coloreTuo')}><input type="color" value={bgColor} oninput={(e) => { bgColor = (e.currentTarget as HTMLInputElement).value; clearBg(); }} /></label>
						</div>
						<label class="kit__cav sheet__bgpick" class:has={!!bgFile}>
							<input type="file" hidden accept="image/png,image/jpeg,image/webp" onchange={pickBg} />
							{#if bgUrl}<img src={bgUrl} alt="" /><span>{bgFile?.name}</span><b>{t('fogli.builder.sfondo.cambia')}</b>{:else}<span class="kit__plus">+</span><span>{t('fogli.builder.sfondo.caricaImmagine')}</span>{/if}
						</label>
						{#if bgFile}<button type="button" class="link-btn" style="margin-top:6px" onclick={clearBg}>{t('fogli.builder.sfondo.togliImmagine')}</button>{/if}
						<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px" onclick={() => (step = 'adesivi')}>{t('fogli.builder.sfondo.avanti')}</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- 4 design -->
		<div class="step" class:is-open={step === 'adesivi'}>
			<button class="step__head" type="button" onclick={() => (step = 'adesivi')} aria-expanded={step === 'adesivi'}>
				<span class="step__n">{#if (pronto ? !!readyFile : n > 0) && step !== 'adesivi'}✓{:else}{stepNo('adesivi')}{/if}</span>
				<span class="step__title">{pronto ? t('fogli.builder.design.tuoFoglio') : t('fogli.builder.design.titolo')} {#if step !== 'adesivi'}<em>{pronto ? (readyFile?.name ?? t('fogli.builder.design.daCaricare')) : t('fogli.builder.design.nDi', { n, max: MAX })}</em>{/if}</span>
				<span class="step__edit">{step === 'adesivi' ? '' : t('fogli.builder.modifica')}</span>
			</button>
			{#if step === 'adesivi'}
				<div class="step__body">
					{#if pronto}
						<p class="step__hint">{t('fogli.builder.design.prontoHint')}</p>
						<label class="kit__cav" class:has={!!readyFile}>
							<input type="file" hidden accept={ACCEPT} onchange={pickReady} />
							{#if readyUrl}<img src={readyUrl} alt="" />{:else if readyFile}<span class="kit__plus">📄</span>{:else}<span class="kit__plus">+</span>{/if}
							<span>{readyFile ? readyFile.name : t('fogli.builder.design.caricaFile')}</span>{#if readyFile}<b>{t('fogli.builder.design.cambia')}</b>{/if}
						</label>
						<button type="button" class="link-btn" style="margin-top:10px" onclick={() => { pronto = false; step = 'adesivi'; }}>{t('fogli.builder.design.preferisco')}</button>
						{#if readyFile}<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px;display:block" onclick={() => (step = 'qty')}>{t('fogli.builder.design.avanti')}</button>{/if}
					{:else}
						<p class="step__hint">{t('fogli.builder.design.hint', { max: MAX })}</p>
						<div class="kit__slots sheet__slots" style="--n:{cols * 2}">
							{#each slots.slice(0, MAX) as s, i (i)}
								<label class="slot" class:has={!!s.file} class:busy={s.busy}>
									<input type="file" hidden accept={ACCEPT} onchange={(e) => pickSlot(e, i)} />
									{#if s.png}<img src={s.png} alt="" />{:else}<span class="slot__plus">+</span>{/if}
									<em>{i + 1}</em>
									{#if s.file}<button type="button" class="slot__x" aria-label={t('fogli.builder.design.togli')} onclick={(e) => { e.preventDefault(); removeSticker(i); }}>✕</button>{/if}
								</label>
							{/each}
						</div>
						{#if flash}<p class="kit__flash">{flash}</p>{/if}
						{#if n}<button type="button" class="btn btn--blue btn--sm" style="margin-top:12px" onclick={() => (step = 'qty')}>{t('fogli.builder.design.avanti')}</button>{/if}
						<div class="sheet__ready">
							<b>{t('fogli.builder.design.haiGia')}</b>
							<button type="button" class="btn btn--ghost btn--sm" onclick={() => { pronto = true; step = 'adesivi'; }}>{t('fogli.builder.design.caricaQui')}</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- 5 quantita' -->
		<div class="step step--qty" class:is-open={step === 'qty'}>
			<button class="step__head" type="button" onclick={() => (step = 'qty')} aria-expanded={step === 'qty'}>
				<span class="step__n">{stepNo('qty')}</span>
				<span class="step__title">{t('fogli.builder.qty.titolo')} <em>{t('fogli.builder.qty.riepilogo', { n: numero(qty), prezzo: prezzo(vatIncluded ? q.gross : q.net, 0) })}</em></span>
				<span class="step__edit">{step === 'qty' ? '' : t('fogli.builder.modifica')}</span>
			</button>
			{#if step === 'qty'}
				<div class="step__body">
					<div class="qty-grid">
						{#each QTY as k (k)}
							{@const qq = quoteWith(cfg, { w: sheetW, h: sheetH, forma, materiale, finitura, qty: k, vatIncluded })}
							<button type="button" class="qty" class:is-active={qty === k} onclick={() => (qty = k)}>
								<span class="qty__top"><b>{numero(k)}</b><b>{prezzo(vatIncluded ? qq.gross : qq.net, 0)}</b></span>
								<span class="qty__bottom">{t('fogli.builder.qty.perFoglio', { prezzo: prezzoUnit(qq.perPiece) })}</span>
							</button>
						{/each}
					</div>
					<p class="step__hint">{t('fogli.builder.qty.hint')}</p>
				</div>
			{/if}
		</div>
	</aside>

	<!-- RIEPILOGO -->
	<div class="cfg__freeship"><FreeShippingBar gross={cartGross + q.gross} compact prefix={cartGross > 0 ? t('fogli.builder.riepilogo.conCarrello') : t('fogli.builder.riepilogo.conOrdine')} /></div>
	<div class="cfg__summary">
		<div class="sum sum--ship"><span class="sum__ico">🚀</span><div class="sum__text"><span class="sum__label">{t('fogli.builder.riepilogo.spedizione')}</span><span class="sum__value">{shipDate}</span><span class="sum__sub">{t('fogli.builder.riepilogo.spedizioneGratis', { soglia })}</span></div></div>
		<div class="sum sum--credit"><span class="sum__ico"><img src="/images/coin-sp.png" alt={t('fogli.builder.riepilogo.creditoAlt')} /></span><div class="sum__text"><span class="sum__label">{t('fogli.builder.riepilogo.credito')}</span><span class="sum__value">{prezzo(q.net * cfg.creditRate)}</span><span class="sum__sub">{t('fogli.builder.riepilogo.creditoSub')}</span></div></div>
		<div class="sum sum--total">
			<div class="sum__text">
				<span class="sum__label">{t('fogli.builder.riepilogo.totale')} {vatIncluded ? t('fogli.builder.riepilogo.ivaInclusa') : t('fogli.builder.riepilogo.ivaEsclusa')}</span>
				<span class="sum__value sum__value--big">{prezzo(vatIncluded ? q.gross : q.net, 0)}</span>
				<div class="vat-toggle"><span class:active={!vatIncluded}>{t('fogli.builder.riepilogo.ivaEsclusa')}</span><button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label={t('fogli.builder.riepilogo.mostraIva')} onclick={() => (vatIncluded = !vatIncluded)}><i></i></button><span class:active={vatIncluded}>{t('fogli.builder.riepilogo.ivaInclusa')}</span></div>
			</div>
			<span class="sum__per">{t('fogli.builder.qty.perFoglio', { prezzo: prezzoUnit(q.perPiece) })}</span>
		</div>
		<button class="btn btn--green btn--cart" type="button" onclick={addSheet} disabled={!readyToAdd || adding} title={readyToAdd ? '' : t('fogli.builder.riepilogo.serve')}>{adding ? t('fogli.builder.riepilogo.unAttimo') : readyToAdd ? t('fogli.builder.riepilogo.aggiungi') : pronto ? t('fogli.builder.riepilogo.caricaFile') : t('fogli.builder.riepilogo.caricaDesign')}</button>
	</div>
</section>

<!-- POPUP: il motore per il design appena caricato (sagoma, bordo, sfondo, zoom; misura qui sotto) -->
{#if engines.length}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('fogli.builder.popup.design')} hidden={!pop}>
		<div class="modal kit__modal">
			<button type="button" class="modal__close" aria-label={t('fogli.builder.popup.chiudi')} onclick={cancelPop}>✕</button>
			{#if pop}
				<h3>{t('fogli.builder.popup.titolo', { n: pop.index + 1 })} <small>{pop.file.name}</small></h3>
				<div class="kit__chips">{#each SHAPES as sh (sh)}<button type="button" class="chip" class:is-on={pop.forma === sh} onclick={() => setPopShape(sh)}>{opz(sh, 'label', sh)}</button>{/each}</div>
			{/if}
			{#each engines as e (e.key)}
				<div class="kit__modal-engine" hidden={pop?.key !== e.key}>
					<EnginePreview bind:this={engRefs[e.key]} file={e.file} forma={engForma(e)} {materiale} {finitura} prodotto="sticker" w={engW(e)} h={engH(e)} panel showCut hires noombra stage={300} onrender={(r) => engRender(e, r)} />
				</div>
			{/each}
			{#if pop}
				<div class="kit__row kit__row--size">
					<span class="step__hint">{t('fogli.builder.popup.misura', { max: misuraU(freeMax) })}</span>
					<label class="kit__free">
						<span>{t('fogli.builder.popup.misuraLabel')}</span>
						{#if pop.forma === 'ovale' || pop.forma === 'rettangolare'}
							<input type="number" min={inU(FREE_MIN)} max={inU(freeMax)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(pop.w)} onchange={(e) => setPopWH(unitToMm(+e.currentTarget.value, unit), pop?.h ?? 0)} aria-label={t('fogli.builder.popup.larghezza', { u: unit })} /> ×
							<input type="number" min={inU(FREE_MIN)} max={inU(freeMax)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(pop.h)} onchange={(e) => setPopWH(pop?.w ?? 0, unitToMm(+e.currentTarget.value, unit))} aria-label={t('fogli.builder.popup.altezza', { u: unit })} /> {unit}
						{:else}
							<input type="number" min={inU(FREE_MIN)} max={inU(freeMax)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(pop.misura)} onchange={(e) => setPopSize(unitToMm(+e.currentTarget.value, unit))} aria-label={t('fogli.builder.popup.latoLungo', { u: unit })} /> {unit}
							<small>{t('fogli.builder.popup.proporzioni')}</small>
						{/if}
					</label>
					{#if pop.last}<span class="step__hint">{t('fogli.builder.popup.esce', { misura: misure(pop.last.w, pop.last.h) })}</span>{/if}
				</div>
				<div class="kit__modal-actions">
					<button type="button" class="btn btn--sm" onclick={cancelPop}>{t('fogli.builder.popup.annulla')}</button>
					<button type="button" class="btn btn--green" disabled={pop.busy || !pop.last} onclick={confirmPop}>{pop.busy ? t('fogli.builder.popup.preparo') : t('fogli.builder.popup.conferma')}</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
