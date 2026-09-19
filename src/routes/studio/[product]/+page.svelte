<script lang="ts">
	import { onMount } from 'svelte';
	import EnginePreview from '$lib/components/EnginePreview.svelte';
	import { showFinishStep, showMaterialStep, minForShape, startSize, sizeProposals, roundHalf, proportionalSize } from '$lib/pricing/engine';
	import { KIT_CAVALLOTTO } from '$lib/studio/products';
	import { STRIP_MATERIALS, SHEET_RULES, layoutLoose, layoutSheets, type Strip } from '$lib/studio/layout';
	import { MARKED_MARGIN, pageWidthFor, DEFAULT_COND, markRects, barcodeRects } from '$lib/studio/graphtec';
	import { pickDataLink, savedDataLink, takenJobIds, writeXpf, type DataLinkDir } from '$lib/studio/datalink';
	import { SPOTS } from '$lib/studio/spots';

	let { data } = $props();
	const P = $derived(data.product);
	const ORD = $derived(data.order);
	const cfg = $derived(data.cfg);

	const SHAPES = $derived(cfg.shapes.filter((s) => s.visible));
	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	const showFinish = $derived(showFinishStep(cfg));
	const showMaterials = $derived(showMaterialStep(cfg));

	let file = $state<File | null>(null);
	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();
	let colInput = $state<HTMLInputElement | undefined>();
	let engine = $state<{ post: (type: string, detail?: Record<string, unknown>) => void; studio: (what: 'mockup' | 'print' | 'geom' | 'applica', opts?: Record<string, unknown>) => Promise<{ blob?: Blob; cutW?: number; cutH?: number; bleed?: number; pathD?: string; polys?: [number, number][][] | null; shape?: string; dpi?: number; border?: number }> }>();

	/* kit: si lavora un adesivo del kit oppure il cavallotto */
	let pezzo = $state<'adesivo' | 'cavallotto'>('adesivo');
	const cavallotto = $derived(!!P.kit && pezzo === 'cavallotto');

	let forma = $state('');
	let materiale = $state('');
	let finitura = $state('');
	/* misura: STESSE regole del configuratore del sito (partenza dal minimo della sagoma, proposte,
	   minimi e massimi del listino, mezzo millimetro), cosi' lo stesso file da' lo stesso pezzo */
	// svelte-ignore state_referenced_locally
	let w = $state(data.cfg.size.defaultMm ?? 50);
	// svelte-ignore state_referenced_locally
	let h = $state(data.cfg.size.defaultMm ?? 50);
	let cutRatio = $state<number | null>(null);
	let sizeKey = '';
	let showCut = $state(true);
	let palette = $state<{ hex: string; img?: string }[]>([]);
	let palIdx = $state(0);
	let rimuovi = $state(false);
	let rendered = $state(false);
	let lastPath = $state('');
	let jobName = $state('');

	$effect(() => {
		if (!SHAPES.some((s) => s.id === forma)) forma = SHAPES[0]?.id ?? 'sagomato';
		if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco';
		if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => !f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna';
	});

	const shape = $derived(SHAPES.find((s) => s.id === forma));
	// proporzione larghezza/altezza, come sul sito
	const ratio = $derived(shape?.equal ? 1 : (shape?.ratio ?? cutRatio ?? 1));
	const freeSize = $derived(cavallotto || forma === 'rettangolare' || forma === 'ovale');
	const MIN_MM = $derived(minForShape(cfg, forma));
	const MAX_MM = $derived(cfg.size.maxMm);
	const presets = $derived(sizeProposals(cfg, forma, ratio, shape?.presets?.length ? shape.presets : [30, 50, 70, 100]));
	const clamp = (v: number) => Math.min(MAX_MM, Math.max(MIN_MM, roundHalf(v || MIN_MM)));
	// cambio sagoma: si riparte dalla misura minima, come sul sito (non su un ordine: la misura e' quella ordinata)
	let lastForma = '';
	$effect(() => {
		if (forma === lastForma) return;
		lastForma = forma;
		if (!data.order) { const [pw, ph] = presets[0]; w = pw; h = ph; }
	});
	const eForma = $derived(cavallotto ? 'rettangolare' : forma);
	const eW = $derived(cavallotto ? KIT_CAVALLOTTO.w : w);
	const eH = $derived(cavallotto ? KIT_CAVALLOTTO.h : h);

	function pick(f: File | null | undefined) {
		if (!f) return;
		file = f;
		rendered = false;
		sizeKey = '';
		jobName = f.name.replace(/\.[^.]+$/, '');
		downloadErr = '';
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		pick(e.dataTransfer?.files?.[0]);
	}

	/* ------------------------------------------------------------ ordine dalla dashboard */
	/* stato: carico il file -> rimetto le regolazioni approvate -> confronto il tracciato */
	let ordStato = $state<'' | 'carico' | 'applico' | 'identico' | 'diverso' | 'senza' | 'errore'>('');
	let ordErr = $state('');
	onMount(async () => {
		const o = data.order;
		if (!o) return;
		if (!o.fileUrl) { ordStato = 'errore'; ordErr = o.folder ? 'Questo ordine ha più file (kit o foglio): caricali uno alla volta.' : 'L’ordine non ha il file del cliente.'; return; }
		ordStato = 'carico';
		try {
			const res = await fetch(o.fileUrl);
			if (!res.ok) throw new Error(`file non scaricabile (${res.status})`);
			const blob = await res.blob();
			const f = new File([blob], o.fileName ?? 'file-cliente', { type: blob.type });
			if (o.forma && SHAPES.some((x) => x.id === o.forma)) forma = o.forma;
			if (o.materiale && MATERIALS.some((x) => x.id === o.materiale)) materiale = o.materiale;
			if (o.finitura && FINISHES.some((x) => x.id === o.finitura)) finitura = o.finitura;
			pick(f);
			jobName = `${o.number}${o.fileName ? '_' + o.fileName.replace(/\.[^.]+$/, '') : ''}`;
			w = o.w; h = o.h;
			if (o.qty) qty = o.qty;
		} catch (e) { ordStato = 'errore'; ordErr = e instanceof Error ? e.message : String(e); }
	});
	async function applicaOrdine() {
		const st = data.order?.engineState;
		if (!st) { ordStato = 'senza'; return; }
		ordStato = 'applico';
		try {
			const r = await engine!.studio('applica', { stato: st });
			if (r.cutW && r.cutH) { w = Math.round(r.cutW * 10) / 10; h = Math.round(r.cutH * 10) / 10; }
			ordStato = r.pathD && r.pathD === st.pathD ? 'identico' : 'diverso';
		} catch (e) { ordStato = 'errore'; ordErr = e instanceof Error ? e.message : String(e); }
	}

	let renders = $state(0);
	/* misura VERA del taglio come la calcola il motore (sul sagomato l'altezza la decide il contorno,
	   non il campo misura): e' quella che conta per impaginare la striscia */
	let engCut = $state<{ w: number; h: number } | null>(null);
	function onRender(s: { w: number; h: number; palette?: { hex: string; img?: string }[]; palIdx?: number; rimuovi?: boolean; shape?: string | null }) {
		rendered = true;
		renders++;
		if (s.w > 0 && s.h > 0) engCut = { w: s.w, h: s.h };
		if (s.palette) palette = s.palette;
		palIdx = s.palIdx ?? 0;
		rimuovi = !!s.rimuovi;
		// primo disegno di un ordine: prima si rimettono le regolazioni del cliente, poi si lavora
		if (ordStato === 'carico') { applicaOrdine(); return; }
		if (ordStato === 'applico') return;
		if (cavallotto) return;
		// primo disegno di un file (o di una sagoma): misura di partenza del sito
		const key = `${file?.name ?? ''}|${file?.size ?? 0}|${forma}`;
		if (key === sizeKey) return;
		sizeKey = key;
		const r = shape?.equal ? 1 : (shape?.ratio ?? (s.h > 0 ? s.w / s.h : 1));
		cutRatio = r;
		if (data.order) return; // ordine: resta la misura ordinata
		const [w0, h0] = startSize(cfg, forma, r);
		w = w0; h = h0;
	}
	// stessa regola del sito: proporzione bloccata e nessun lato sotto il minimo
	function setW(v: number) {
		if (!(v > 0)) return;
		if (freeSize) { w = clamp(v); return; }
		[w, h] = proportionalSize(cfg, forma, v, ratio);
	}
	function setH(v: number) {
		if (!(v > 0)) return;
		if (freeSize) { h = clamp(v); return; }
		[w, h] = proportionalSize(cfg, forma, v * ratio, ratio);
	}

	/* ------------------------------------------------------------ esportazioni */
	let busy = $state<'' | 'mockup' | 'print' | 'strip' | 'dls'>('');
	let downloadErr = $state('');
	let dpi = $state<'auto' | number>('auto');
	let traceInfo = $state('');

	const safe = (s: string) => (s || 'lavoro').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
	const sizeTag = () => `${(engCut?.w ?? (cavallotto ? KIT_CAVALLOTTO.w : w)).toFixed(0)}x${(engCut?.h ?? (cavallotto ? KIT_CAVALLOTTO.h : h)).toFixed(0)}mm`;
	const baseName = () => `${safe(jobName)}_${P.id}${cavallotto ? '_cavallotto' : ''}_${sizeTag()}`;

	function download(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 60000);
	}

	async function run(kind: 'mockup' | 'print' | 'strip' | 'dls', fn: () => Promise<void>) {
		if (busy || !engine) return;
		busy = kind;
		downloadErr = '';
		try { await fn(); } catch (e) { downloadErr = e instanceof Error ? e.message : String(e); } finally { busy = ''; }
	}

	/* sagomato: il contorno del motore ha una curva per ogni punto (centinaia di nodi, il plotter
	   rallenta su ognuno); si riadatta con poche curve entro 0,12 mm. Le forme geometriche hanno
	   gia' il tracciato minimo (archi e lati). */
	async function tracciato(r: { pathD?: string; polys?: [number, number][][] | null; shape?: string; border?: number }) {
		if (r.shape === 'diecut' && r.pathD) {
			/* si parte dalla LINEA APPROVATA (quella che il cliente ha visto) e se ne scosta di circa un quarto del bordo (0,05–0,15 mm, misurato 0,14 mm su bordo piccolo): con il bordo piccolo il taglio non si avvicina al disegno */
			const [{ fitPathD, samplePath }, { parsePath }] = await Promise.all([import('$lib/studio/fit'), import('$lib/studio/path')]);
			const b = r.border && r.border > 0 ? r.border : 1;
			const tol = Math.min(0.15, Math.max(0.05, b * 0.25));
			const f = fitPathD(samplePath(parsePath(r.pathD)), { tolerance: tol, smooth: Math.min(0.15, Math.max(0.05, b * 0.12)) });
			if (f.d) return { d: f.d, nodes: f.nodes };
		}
		const d = r.pathD ?? '';
		return { d, nodes: (d.match(/[MLHVCAZmlhvcaz]/g) ?? []).filter((c) => !/[Zz]/.test(c)).length };
	}

	/* il tracciato leggero si ricava PRIMA e si ripassa al motore: mockup, grafica di stampa e
	   taglio usano lo stesso contorno liscio (niente bordo frastagliato nell'anteprima) */
	async function traccia() {
		const g = await engine!.studio('geom');
		if (!g.pathD) throw new Error('Il motore non ha restituito il tracciato di taglio.');
		const t = await tracciato(g);
		lastPath = t.d;
		return t;
	}

	async function artwork() {
		const t = await traccia();
		const r = await engine!.studio('print', { dpi, pathD: t.d });
		if (!r.cutW || !r.cutH) throw new Error('Il motore non ha restituito le misure del taglio.');
		traceInfo = `Tracciato: ${t.nodes} punti di ancoraggio · grafica a ${r.dpi ?? '?'} dpi`;
		if (!r.blob) throw new Error('Il motore non ha restituito la grafica.');
		return { png: new Uint8Array(await r.blob.arrayBuffer()), cutW: r.cutW, cutH: r.cutH, bleed: r.bleed ?? 0, pathD: t.d };
	}

	const scaricaAnteprima = () => run('mockup', async () => {
		const t = await traccia();
		const r = await engine!.studio('mockup', { px: 5000, pathD: t.d });
		if (!r.blob) throw new Error('Il motore non ha restituito l’anteprima.');
		download(r.blob, `${baseName()}_anteprima.png`);
	});

	const scaricaStampaTaglio = () => run('print', async () => {
		const { buildPdf, singleStrip } = await import('$lib/studio/pdf');
		const art = await artwork();
		const bytes = await buildPdf({ title: `${jobName} — stampa e taglio`, art, pages: [singleStrip(art)], pieceCut: P.pieceCut });
		download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName()}_stampa-taglio.pdf`);
	});

	/* ------------------------------------------------------------ striscia */
	let stripOpen = $state(false);
	let matId = $state(STRIP_MATERIALS[0].id);
	const mat = $derived(STRIP_MATERIALS.find((m) => m.id === matId) ?? STRIP_MATERIALS[0]);
	const maxH = $derived(P.mode === 'fogli' ? mat.maxHSheets : mat.maxHLoose);
	let stripH = $state(0);
	let qty = $state<number | ''>('');
	/* crocini e codice a barre Graphtec, SEMPRE: la pagina e' larga quanto quella di Cutting Master
	   (bobina meno 12 mm) e i pezzi stanno fuori dai bracci dei crocini e dalle fasce dei codici */
	const pageW = $derived(pageWidthFor(mat.width));
	const margin = MARKED_MARGIN.x;
	const marginY = MARKED_MARGIN.y;
	let gap = $state(8);
	/* fra un foglio e l'altro almeno 1 cm (resinati, etichette, fogli di adesivi) */
	const MIN_SHEET_GAP = 10;
	let sheetGap = $state(MIN_SHEET_GAP);
	const sGap = $derived(Math.max(MIN_SHEET_GAP, +sheetGap || 0));
	$effect(() => { if (!stripH || stripH > maxH) stripH = maxH; });

	const cutW = $derived(engCut?.w ?? (cavallotto ? KIT_CAVALLOTTO.w : w));
	const cutH = $derived(engCut?.h ?? (cavallotto ? KIT_CAVALLOTTO.h : h));
	const plan = $derived.by(() => {
		if (!(cutW > 0 && cutH > 0)) return null;
		const H = Math.min(stripH || maxH, maxH);
		if (P.mode === 'fogli') {
			const rules = SHEET_RULES[P.sheetRules ?? 'etichette'];
			const probe = layoutSheets(cutW, cutH, rules, { stripW: pageW, stripH: H, margin, marginY, sheetGap: sGap, sheets: 0 });
			if (!probe.ok || !probe.sheet) return { kind: 'fogli' as const, r: probe, sheets: 0 };
			const want = typeof qty === 'number' && qty > 0 ? Math.ceil(qty / probe.sheet.grid.n) : 0;
			return { kind: 'fogli' as const, r: want ? layoutSheets(cutW, cutH, rules, { stripW: pageW, stripH: H, margin, marginY, sheetGap: sGap, sheets: want }) : probe, sheets: want };
		}
		return { kind: 'sciolti' as const, r: layoutLoose(cutW, cutH, { stripW: pageW, stripH: H, margin, marginY, gap, qty: typeof qty === 'number' && qty > 0 ? qty : 0 }) };
	});
	const strips = $derived<Strip[]>(plan?.r.ok ? plan.r.strips : []);
	const preview = $derived(strips[0] ?? null);
	const previewMarks = $derived(preview ? [...markRects(preview.w, preview.h), ...barcodeRects(preview.w, preview.h, 'G1200PROV').rects] : []);

	const generaStriscia = () => run('strip', async () => {
		const { buildPdf } = await import('$lib/studio/pdf');
		const art = await artwork();
		// si rifa' l'impaginazione con le misure esatte del tracciato
		const H = Math.min(stripH || maxH, maxH);
		let pages: Strip[];
		if (P.mode === 'fogli') {
			const rules = SHEET_RULES[P.sheetRules ?? 'etichette'];
			const probe = layoutSheets(art.cutW, art.cutH, rules, { stripW: pageW, stripH: H, margin, marginY, sheetGap: sGap, sheets: 0 });
			if (!probe.ok || !probe.sheet) throw new Error(probe.error ?? 'Impaginazione non possibile');
			const want = typeof qty === 'number' && qty > 0 ? Math.ceil(qty / probe.sheet.grid.n) : 0;
			pages = (want ? layoutSheets(art.cutW, art.cutH, rules, { stripW: pageW, stripH: H, margin, marginY, sheetGap: sGap, sheets: want }) : probe).strips;
		} else {
			const r = layoutLoose(art.cutW, art.cutH, { stripW: pageW, stripH: H, margin, marginY, gap, qty: typeof qty === 'number' && qty > 0 ? qty : 0 });
			if (!r.ok) throw new Error(r.error ?? 'Impaginazione non possibile');
			pages = r.strips;
		}
		/* un codice del lavoro per ogni striscia DIVERSA (strisce uguali = stesso taglio = stesso codice) */
		const taken = dlDir ? await takenJobIds(dlDir).catch(() => new Set<string>()) : new Set<string>();
		const { newJobId } = await import('$lib/studio/graphtec');
		const bySig = new Map<string, string>();
		const ids = pages.map((pg) => {
			const sig = `${pg.h}|${pg.pieces.length}|${pg.sheets?.length ?? 0}`;
			let id = bySig.get(sig);
			if (!id) { id = newJobId(taken); taken.add(id); bySig.set(sig, id); }
			return id;
		});
		const bytes = await buildPdf({ title: `${jobName} — ${mat.label}`, art, pages, pieceCut: P.pieceCut, sheetCut: P.mode === 'fogli' ? P.sheetCut : undefined, graphtecIds: ids });
		const n = pages.reduce((a, s) => a + s.pieces.length, 0);
		lastJob = { ids, pages, art: { pathD: art.pathD, cutW: art.cutW, cutH: art.cutH }, name: baseName() };
		sent = '';
		download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName()}_striscia-${mat.width / 10}cm_${n}pz${pages.length > 1 ? `_${pages.length}strisce` : ''}.pdf`);
	});

	/* ------------------------------------------------------------ Data Link Server */
	/* l'ultimo PDF generato: il taglio da mandare al plotter deve essere ESATTAMENTE quello */
	let lastJob = $state<{ ids: string[]; pages: Strip[]; art: { pathD: string; cutW: number; cutH: number }; name: string } | null>(null);
	let dlDir = $state<DataLinkDir | null>(null);
	let dlName = $state('');
	let cutMode = $state<'tutto' | 'passante'>('tutto');
	let condHalf = $state(DEFAULT_COND.half);
	let condThrough = $state(DEFAULT_COND.through);
	let sent = $state('');
	onMount(async () => { try { dlDir = await savedDataLink(); dlName = dlDir?.name ?? ''; } catch { /* nessuna cartella salvata */ } });
	async function sceglieCartella() {
		try { dlDir = await pickDataLink(); dlName = dlDir.name; } catch (e) { if (e instanceof Error && e.name !== 'AbortError') downloadErr = e.message; }
	}
	function xpfJobs() {
		if (!lastJob) return [];
		const cond = (spot: 'Passante' | 'CutContour') => (spot === 'Passante' ? condThrough : condHalf);
		const seen = new Set<string>();
		return lastJob.pages.flatMap((pg, i) => {
			const id = lastJob!.ids[i];
			if (seen.has(id)) return [];
			seen.add(id);
			const onlyThrough = P.mode === 'fogli' && cutMode === 'passante';
			return [{ id, W: pg.w, H: pg.h, pathD: lastJob!.art.pathD, cutW: lastJob!.art.cutW, cutH: lastJob!.art.cutH, pieces: pg.pieces, sheets: pg.sheets, pieceCond: onlyThrough ? null : cond(P.pieceCut), sheetCond: P.mode === 'fogli' && P.sheetCut ? cond(P.sheetCut) : null }];
		});
	}
	const inviaDataLink = () => run('dls', async () => {
		if (!lastJob) throw new Error('Genera prima il PDF della striscia: il taglio deve essere quello stampato.');
		if (!dlDir) await sceglieCartella();
		if (!dlDir) return;
		const { buildXpf } = await import('$lib/studio/graphtec');
		const done: string[] = [];
		for (const j of xpfJobs()) { await writeXpf(dlDir, `SP_${j.id}.xpf`, buildXpf(j)); done.push(j.id); }
		sent = `Inviato a Data Link Server: ${done.join(', ')}. Sul plotter fai leggere il codice a barre.`;
	});
	const scaricaXpf = () => run('dls', async () => {
		if (!lastJob) throw new Error('Genera prima il PDF della striscia.');
		const { buildXpf } = await import('$lib/studio/graphtec');
		for (const j of xpfJobs()) download(new Blob([buildXpf(j) as BlobPart], { type: 'application/octet-stream' }), `SP_${j.id}.xpf`);
	});

	/* anteprima della striscia col contorno vero: il tracciato si chiede al motore (a bassa risoluzione) */
	let pathTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const go = stripOpen && renders > 0 && !busy;
		if (!go) return;
		clearTimeout(pathTimer);
		pathTimer = setTimeout(async () => {
			try { const r = await engine?.studio('geom'); if (r?.pathD) lastPath = (await tracciato(r)).d; } catch { /* resta il rettangolo */ }
		}, 250);
	});

	const pieceTf = (p: { x: number; y: number; rot: boolean }) => (p.rot ? `matrix(0 1 -1 0 ${p.x + cutH} ${p.y})` : `translate(${p.x} ${p.y})`);
	const cutColor = (s: 'Passante' | 'CutContour') => SPOTS[s].rgb;
</script>

<svelte:head><title>{P.name} · Stickerprint Studio</title></svelte:head>

<svelte:window ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={(e) => { if (!e.relatedTarget) dragging = false; }} ondrop={onDrop} />

<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />

<section class="st-work">
	<div class="st-head">
		<h1><span class="hl hl--yellow">{P.name}</span></h1>
		<p class="st-head__cut">
			Taglio: <span class="st-spot" style="--c:{cutColor(P.pieceCut)}">{P.pieceCut === 'Passante' ? 'Passante' : 'CutContour · mezzo taglio'}</span>
			{#if P.sheetCut}<span class="st-sep">+</span> foglio <span class="st-spot" style="--c:{cutColor(P.sheetCut)}">{P.sheetCut}</span>{/if}
		</p>
	</div>

	{#if ORD}
		<div class="st-ord" class:is-ok={ordStato === 'identico'} class:is-warn={ordStato === 'diverso' || ordStato === 'senza'} class:is-err={ordStato === 'errore'}>
			{#if ORD.previewUrl}<a class="st-ord__img" href={ORD.previewUrl} target="_blank" rel="noopener" title="Anteprima approvata dal cliente"><img src={ORD.previewUrl} alt="Anteprima approvata" /></a>{/if}
			<div class="st-ord__txt">
				<p class="st-ord__t">Ordine <b>{ORD.number}</b> · {ORD.productName} · {ORD.qty} pz · {ORD.w}×{ORD.h} mm</p>
				<p class="st-ord__s">
					{#if ordStato === 'carico'}Carico il file del cliente…
					{:else if ordStato === 'applico'}Rimetto le regolazioni approvate dal cliente…
					{:else if ordStato === 'identico'}✓ Regolazioni del cliente applicate: il tracciato è <b>identico</b> a quello che ha approvato.
					{:else if ordStato === 'diverso'}Regolazioni del cliente applicate, ma il tracciato non coincide al millesimo con quello approvato: confronta con l’anteprima qui a fianco prima di stampare.
					{:else if ordStato === 'senza'}Ordine fatto prima del salvataggio delle regolazioni: imposta bordo, zoom e sfondo guardando l’anteprima approvata qui a fianco.
					{:else if ordStato === 'errore'}Non riesco ad aprire l’ordine: {ordErr}
					{/if}
				</p>
			</div>
		</div>
	{/if}

	{#if !file}
		<button type="button" class="st-drop" class:is-over={dragging} onclick={() => fileInput?.click()}>
			<span class="st-drop__icon">⬆</span>
			<span class="st-drop__t">Trascina qui il file del cliente</span>
			<span class="st-drop__s">oppure clicca per sceglierlo · PNG, JPG, SVG, PDF</span>
		</button>
	{:else}
		<div class="st-bench">
			<div class="st-stage">
				<EnginePreview bind:this={engine} {file} forma={eForma} {materiale} finitura={showFinish ? finitura : 'lucida'} prodotto={P.engineProduct} foglio={!!P.foglio} rilievo={!!P.rilievo} vetro={!!P.vetro} noang={cavallotto} w={eW} h={eH} {showCut} panel stage={560} onrender={onRender} />
				<div class="st-bar">
					{#if !P.vetro}
						<span class="st-bar__label">Sfondo</span>
						<span class="st-dots">
							{#each palette as c, i (i)}
								<button type="button" class="st-dot" class:is-on={i === palIdx} style={c.img === 'checker' ? 'background:repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/10px 10px' : c.img ? `background-image:url(${c.img});background-size:cover` : `background:${c.hex}`} aria-label="Sfondo {c.hex}" onclick={() => engine?.post('bg', { idx: i })}></button>
							{/each}
							<button type="button" class="st-dot st-dot--arc" aria-label="Scegli un colore di sfondo" onclick={() => colInput?.click()}></button>
							<input bind:this={colInput} type="color" class="st-col" value={palette[palIdx]?.hex ?? '#ffffff'} oninput={(e) => engine?.post('bgcol', { hex: (e.currentTarget as HTMLInputElement).value })} />
						</span>
						<button type="button" class="st-tool" class:is-on={rimuovi} onclick={() => engine?.post('rimuovi')}>✨ Rimuovi sfondo</button>
					{/if}
					<button type="button" class="st-tool st-tool--blue" onclick={() => fileInput?.click()} title={file.name}>Cambia file</button>
					<button type="button" class="st-tool" class:is-on={showCut} onclick={() => (showCut = !showCut)}>{showCut ? 'Nascondi' : 'Mostra'} taglio</button>
				</div>
			</div>

			<aside class="st-side">
				<label class="st-field">
					<span>Nome lavoro / n. ordine</span>
					<input class="input" bind:value={jobName} placeholder="es. SP-1234 Rossi" />
				</label>

				{#if P.kit}
					<div class="st-block">
						<p class="st-label">Pezzo del kit</p>
						<div class="st-chips">
							<button type="button" class="st-chip" class:is-on={pezzo === 'adesivo'} onclick={() => (pezzo = 'adesivo')}>Adesivo</button>
							<button type="button" class="st-chip" class:is-on={pezzo === 'cavallotto'} onclick={() => (pezzo = 'cavallotto')}>Cavallotto {KIT_CAVALLOTTO.w}×{KIT_CAVALLOTTO.h}</button>
						</div>
					</div>
				{/if}

				{#if !cavallotto}
					<div class="st-block">
						<p class="st-label">Sagoma</p>
						<div class="st-chips">
							{#each SHAPES as s (s.id)}
								<button type="button" class="st-chip" class:is-on={forma === s.id} onclick={() => { forma = s.id; }}>{s.label}</button>
							{/each}
						</div>
					</div>

					<div class="st-block">
						<p class="st-label">Misura (mm)</p>
						<div class="st-size">
							<label><span>Larghezza</span><input class="input" type="number" min="5" max="1000" step="0.5" value={w || ''} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setW(+el.value); el.value = String(w); }} /></label>
							<span class="st-x">×</span>
							<label><span>Altezza</span><input class="input" type="number" min="5" max="1000" step="0.5" value={h || ''} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setH(+el.value); el.value = String(h); }} /></label>
						</div>
						<div class="st-chips">
							{#each presets as [pw, ph] (pw + 'x' + ph)}
								<button type="button" class="st-chip" class:is-on={Math.abs(w - pw) < 0.3 && Math.abs(h - ph) < 0.3} onclick={() => { w = pw; h = ph; }}>{pw}×{ph}</button>
							{/each}
						</div>
						<p class="st-note">Stesse misure del sito: minimo {MIN_MM} mm, massimo {MAX_MM} mm{freeSize ? ', lati indipendenti' : ', proporzioni bloccate'}.</p>
						{#if engCut && (Math.abs(engCut.w - w) > 0.6 || Math.abs(engCut.h - h) > 0.6)}<p class="st-note st-real">Taglio reale del motore: <b>{engCut.w.toFixed(1)} × {engCut.h.toFixed(1)} mm</b> (sul sagomato l’altezza la decide il contorno del disegno). Impaginazione e file usano questa.</p>{/if}
					</div>
				{/if}

				{#if showMaterials}
					<div class="st-block">
						<p class="st-label">Materiale</p>
						<div class="st-chips">
							{#each MATERIALS as m (m.id)}
								<button type="button" class="st-chip" class:is-on={materiale === m.id} onclick={() => (materiale = m.id)}>{m.label}</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if showFinish}
					<div class="st-block">
						<p class="st-label">{cfg.finishTitle ?? 'Finitura'}</p>
						<div class="st-chips">
							{#each FINISHES as f (f.id)}
								<button type="button" class="st-chip" class:is-on={finitura === f.id} onclick={() => (finitura = f.id)}>{f.label}</button>
							{/each}
						</div>
					</div>
				{/if}
				<p class="st-note">Bordo piccolo / medio / grande, angoli e zoom si regolano sotto l’anteprima, come sul sito.</p>

				<div class="st-actions">
					<button type="button" class="btn btn--blue st-act" disabled={!rendered || !!busy} onclick={scaricaAnteprima}>
						{busy === 'mockup' ? 'Preparo l’anteprima…' : 'Scarica anteprima'}<small>PNG in alta definizione, senza linea di taglio</small>
					</button>
					<button type="button" class="btn btn--pink st-act" disabled={!rendered || !!busy} onclick={scaricaStampaTaglio}>
						{busy === 'print' ? 'Preparo il file…' : 'Scarica file di stampa e taglio'}<small>PDF: grafica + tracciato vettoriale {P.pieceCut}</small>
					</button>
					<button type="button" class="btn btn--green st-act" disabled={!rendered || !!busy} onclick={() => (stripOpen = !stripOpen)} aria-expanded={stripOpen}>
						Genera file di stampa<small>{P.mode === 'fogli' ? 'fogli impaginati sulla striscia' : 'striscia piena di pezzi'}, crocini e codice a barre Graphtec</small>
					</button>
					<label class="st-dpi">Risoluzione <select bind:value={dpi}><option value="auto">Massima (min. 600 dpi)</option><option value={300}>300 dpi</option><option value={600}>600 dpi</option><option value={1200}>1200 dpi</option></select></label>
					{#if traceInfo}<p class="st-note st-trace">{traceInfo}</p>{/if}
					{#if downloadErr}<p class="st-err">{downloadErr}</p>{/if}
					{#if P.rilievo}<p class="st-note">Rilievo: il livello RDG_GLOSS vettoriale per la Roland arriva nel prossimo passaggio. Oggi il PDF contiene grafica e passante.</p>{/if}
				</div>
			</aside>
		</div>

		{#if stripOpen}
			<section class="st-strip">
				<div class="st-strip__opts">
					<div class="st-block">
						<p class="st-label">Materiale di stampa</p>
						<div class="st-chips">
							{#each STRIP_MATERIALS as m (m.id)}
								<button type="button" class="st-chip" class:is-on={matId === m.id} onclick={() => { matId = m.id; stripH = 0; }}>{m.label}</button>
							{/each}
						</div>
					</div>
					<label class="st-field"><span>Altezza striscia (mm, max {maxH})</span><input class="input" type="number" min="50" max={maxH} step="1" bind:value={stripH} /></label>
					<label class="st-field"><span>{P.mode === 'fogli' ? 'Etichette da stampare' : 'Pezzi da stampare'} <em>(vuoto = una striscia piena)</em></span><input class="input" type="number" min="1" step="1" bind:value={qty} placeholder="riempi la striscia" /></label>
					<details class="st-adv">
						<summary>Margini e spazi</summary>
						<p class="st-note">Crocini e codice a barre Graphtec sempre presenti: pagina {pageW} mm, pezzi a {margin} mm dai lati e {marginY} mm da sopra e sotto.</p>
						<label class="st-field"><span>Condizione plotter mezzo taglio</span><input class="input" type="number" min="1" max="8" step="1" bind:value={condHalf} /></label>
						<label class="st-field"><span>Condizione plotter passante</span><input class="input" type="number" min="1" max="8" step="1" bind:value={condThrough} /></label>
						{#if P.mode === 'fogli'}
							<label class="st-field"><span>Spazio fra i fogli (mm, minimo {MIN_SHEET_GAP})</span><input class="input" type="number" min={MIN_SHEET_GAP} step="0.5" bind:value={sheetGap} /></label>
							<p class="st-note">Foglio: bordo {SHEET_RULES[P.sheetRules ?? 'etichette'].margin} mm, {SHEET_RULES[P.sheetRules ?? 'etichette'].gap} mm fra le etichette{SHEET_RULES[P.sheetRules ?? 'etichette'].mod5 ? ', multipli di 5 (resinatrice a 10 aghi)' : ''}.</p>
						{:else}
							<label class="st-field"><span>Spazio fra i pezzi, da taglio a taglio (mm)</span><input class="input" type="number" min="0" step="0.5" bind:value={gap} /></label>
						{/if}
					</details>

					{#if plan && !plan.r.ok}
						<p class="st-err">{plan.r.error}</p>
					{:else if plan}
						<ul class="st-sum">
							{#if plan.kind === 'fogli' && plan.r.sheet}
								<li>Foglio <b>{plan.r.sheet.w} × {plan.r.sheet.h} mm</b>: {plan.r.sheet.grid.cols} × {plan.r.sheet.grid.rows} = <b>{plan.r.sheet.grid.n} etichette</b></li>
								<li>Striscia: {plan.r.across} × {plan.r.down} fogli = <b>{plan.r.piecesPerStrip} etichette</b></li>
								{#if plan.r.warning}<li class="st-warn">{plan.r.warning}</li>{/if}
							{:else if plan.kind === 'sciolti'}
								<li>Striscia: {plan.r.grid.cols} × {plan.r.grid.rows} = <b>{plan.r.perStrip} pezzi</b>{plan.r.grid.rot ? ' (girati di 90°)' : ''}</li>
							{/if}
							<li>{strips.length} {strips.length === 1 ? 'striscia' : 'strisce'}, {strips.reduce((a, s) => a + s.pieces.length, 0)} pezzi in tutto · prima striscia {pageW} × {strips[0]?.h} mm</li>
						</ul>
						<button type="button" class="btn btn--green" disabled={!!busy || !strips.length} onclick={generaStriscia}>{busy === 'strip' ? 'Genero il PDF…' : 'Scarica PDF striscia'}</button>

						<div class="st-dls">
							<p class="st-label">Taglio sul Graphtec</p>
							{#if P.mode === 'fogli'}
								<div class="st-chips">
									<button type="button" class="st-chip" class:is-on={cutMode === 'tutto'} onclick={() => (cutMode = 'tutto')}>Mezzo taglio + passante</button>
									<button type="button" class="st-chip" class:is-on={cutMode === 'passante'} onclick={() => (cutMode = 'passante')}>Solo passante (verde)</button>
								</div>
							{/if}
							<button type="button" class="btn btn--blue" disabled={!!busy || !lastJob} onclick={inviaDataLink}>{busy === 'dls' ? 'Invio…' : 'Invia taglio a Data Link Server'}</button>
							<p class="st-note">
								{#if !lastJob}Prima scarica il PDF della striscia: il taglio inviato è quello di quel PDF (stesso codice a barre).
								{:else}Codice{lastJob.ids.length > 1 && new Set(lastJob.ids).size > 1 ? 'i' : ''}: <b>{[...new Set(lastJob.ids)].join(', ')}</b>{/if}
								· Cartella: {dlName ? dlName : 'da scegliere al primo invio'} <button type="button" class="st-link" onclick={sceglieCartella}>cambia</button>
								· <button type="button" class="st-link" disabled={!lastJob} onclick={scaricaXpf}>scarica il file di taglio</button>
							</p>
							{#if sent}<p class="st-ok">✓ {sent}</p>{/if}
						</div>
					{/if}
				</div>

				{#if preview}
					<div class="st-strip__view">
						<svg viewBox="-2 -2 {preview.w + 4} {preview.h + 4}" preserveAspectRatio="xMidYMin meet">
							<rect x="0" y="0" width={preview.w} height={preview.h} fill="#fff" stroke="#c7cbe0" stroke-width="1" />
							{#each previewMarks as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#111" />{/each}
							{#if lastPath || forma}
								{#each preview.pieces as p, i (i)}
									{#if lastPath}
										<path d={lastPath} transform={pieceTf(p)} fill="#eef0fb" stroke={cutColor(P.pieceCut)} stroke-width="0.6" />
									{:else}
										<rect x={p.x} y={p.y} width={p.rot ? cutH : cutW} height={p.rot ? cutW : cutH} rx="1.5" fill="#eef0fb" stroke={cutColor(P.pieceCut)} stroke-width="0.6" />
									{/if}
								{/each}
							{/if}
							{#each preview.sheets ?? [] as s, i (i)}
								<rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={cutColor(P.sheetCut ?? 'Passante')} stroke-width="1" />
							{/each}
						</svg>
						<p class="st-note">{mat.label}: pagina {pageW} mm con crocini e codice a barre · la prima striscia. {lastPath ? '' : 'Il contorno vero compare dopo il primo file generato.'}</p>
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</section>
