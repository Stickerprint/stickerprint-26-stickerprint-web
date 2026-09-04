<script lang="ts">
	/**
	 * Preventivatore prodotto (adesivi, etichette, vetrofanie…).
	 * Sinistra: il logo del cliente con i comandi del motore di anteprima.
	 * Destra: i passi (sagoma, materiale, [finitura], misura, quantità) e riepilogo.
	 * Il listino `cfg` arriva dalla dashboard (Supabase) e decide cosa mostrare e i prezzi.
	 * Con `test` (dashboard) niente colonna del file e niente carrello: solo i passi e il prezzo.
	 */
	import { onMount } from 'svelte';
	import EnginePreview from './EnginePreview.svelte';
	import { loadDraft, saveDraft, saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { addToCart } from '$lib/cart';
	import { quoteWith, suggestedSize, roundHalf, eur0, eur2, showFinishStep, showMaterialStep, type EngineConfig } from '$lib/pricing/engine';

	let {
		shipDate,
		cfg,
		product = 'adesivi_personalizzati',
		productName = 'i tuoi adesivi',
		engineProduct = 'sticker',
		test = false
	}: { shipDate: string; cfg: EngineConfig; product?: string; productName?: string; engineProduct?: 'sticker' | 'resinati'; test?: boolean } = $props();

	const SHAPES = $derived(cfg.shapes.filter((s) => s.visible));
	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	const showFinish = $derived(showFinishStep(cfg));
	const showMaterials = $derived(showMaterialStep(cfg));
	const MIN_MM = $derived(cfg.size.minMm);
	const MAX_MM = $derived(cfg.size.maxMm);

	// passi visibili, numerati in ordine
	const steps = $derived(
		([['forma', true], ['materiale', showMaterials], ['finitura', showFinish], ['misura', true], ['qty', true]] as [string, boolean][])
			.filter(([, on]) => on)
			.map(([id]) => id)
	);
	const stepNo = (id: string) => steps.indexOf(id) + 1;

	let forma = $state('sagomato');
	let materiale = $state('bianco');
	let finitura = $state('lucida');
	let w = $state(50);
	let h = $state(50);
	let fileRatio = $state<number | null>(null);
	let cutRatio = $state<number | null>(null);
	let showCut = $state(true);
	let sizeKey = '';
	let qty = $state(500);
	let step = $state('forma');
	let vatIncluded = $state(true);
	let file = $state<File | null>(null);
	let fileUrl = $state<string | null>(null);
	let note = $state('');
	let added = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();
	let lastPng: string | null = null; // ultima anteprima generata dal motore (con tracciato di taglio)
	let engine = $state<{ post: (type: string, detail?: Record<string, unknown>) => void }>();
	let palette = $state<{ hex: string; img?: string }[]>([]);
	let palIdx = $state(0);
	let rimuovi = $state(false);
	let colInput = $state<HTMLInputElement | null>(null);
	// etichette in fogli: il motore mostra il foglio e dice quante etichette ci entrano
	const foglio = $derived(product === 'etichette');
	const rilievo = $derived(product === 'adesivi_rilievo');
	let perSheet = $state<{ n: number; cols: number; rows: number; w: number; h: number } | null>(null);
	let over = $state(false);
	let customOpen = $state(false);
	let customQty = $state<number | ''>('');
	let custom = $state(false);

	// valori iniziali coerenti con il listino (anche quando il listino cambia sotto, in dashboard)
	$effect(() => {
		if (!SHAPES.some((s) => s.id === forma)) forma = SHAPES[0]?.id ?? 'sagomato';
		if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco';
		if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna';
		if (!custom && !cfg.quantities.includes(qty)) qty = cfg.quantities.includes(cfg.recommendedQty) ? cfg.recommendedQty : cfg.quantities[0];
		if (!steps.includes(step)) step = steps[0];
	});

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? cfg.materials[0]);
	const finish = $derived(FINISHES.find((f) => f.id === finitura));
	const fin = $derived(showFinish ? finitura : 'nessuna');
	const ratio = $derived(shape?.equal ? 1 : (shape?.ratio ?? cutRatio ?? fileRatio ?? 1));
	// rettangolo e ovale: le misure sono solo proposte, il cliente puo' scrivere la sua (lati indipendenti)
	const freeSize = $derived(forma === 'rettangolo' || forma === 'ovale');
	const q = $derived(quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty, vatIncluded }));
	const progress = $derived((stepNo(step) / steps.length) * 100);
	const suggested = $derived(suggestedSize(ratio));
	const shapePresets = $derived(shape?.presets?.length ? shape.presets : [30, 50, 70, 100]);
	const presets = $derived(
		(file ? [suggested[0], ...shapePresets.filter((x) => x !== suggested[0])] : shapePresets).slice(0, 4).map((pw) => [pw, roundHalf(pw / ratio)] as [number, number])
	);
	// senza file, al cambio sagoma si parte dalla misura proposta (50 mm se c'è, altrimenti la prima)
	let lastForma = '';
	$effect(() => {
		if (forma === lastForma) return;
		lastForma = forma;
		if (!file) {
			const [pw, ph] = presets.find(([x]) => x === 50) ?? presets[0];
			w = pw;
			h = ph;
		}
	});
	const basePerPiece = $derived(quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: cfg.quantities[0], vatIncluded }).perPiece);

	onMount(async () => {
		if (test) return;
		// entrando in una pagina prodotto si parte dalla drop zone; il file della home
		// si riprende solo quando si arriva da "Continua la configurazione" (#configura)
		if (location.hash !== '#configura') return;
		const d = await loadDraft();
		if (d && d.product === product) {
			file = d.file;
			fileUrl = URL.createObjectURL(d.file);
			if (SHAPES.some((s) => s.id === d.forma)) forma = d.forma;
			if (MATERIALS.some((m) => m.id === d.materiale)) materiale = d.materiale;
			// arrivando dalla home con il file gia' caricato si atterra direttamente sul preventivatore:
			// si ripete perche' le foto della pagina, caricandosi, spostano il blocco verso il basso
			if (location.hash === '#configura') for (const ms of [200, 900, 2000, 3500]) setTimeout(() => document.getElementById('configura')?.scrollIntoView({ behavior: ms > 500 ? 'auto' : 'smooth', block: 'start' }), ms);
		}
	});
	const minQty = $derived(cfg.quantities[0] ?? 15);
	function applyCustom() {
		const n = Math.max(minQty, Math.round(Number(customQty) || 0));
		customQty = n; custom = true; qty = n;
		customOpen = true;
	}

	function onRender(s: { png?: string | null; w: number; h: number; srcMM: { w: number; h: number } | null; palette?: { hex: string; img?: string }[]; palIdx?: number; rimuovi?: boolean; foglio?: { n: number; cols: number; rows: number; w: number; h: number } | null }) {
		if (s.png) lastPng = s.png;
		perSheet = s.foglio ?? null;
		if (s.palette) { palette = s.palette; palIdx = s.palIdx ?? 0; rimuovi = !!s.rimuovi; }
		const key = `${file?.name ?? ''}|${file?.size ?? 0}|${forma}`;
		if (key === sizeKey) return;
		sizeKey = key;
		const r = shape?.equal ? 1 : (shape?.ratio ?? (s.h > 0 ? s.w / s.h : (fileRatio ?? 1)));
		cutRatio = r;
		// la misura dal file vale per il sagomato (segue la proporzione del disegno); sulle sagome
		// geometriche resta quella scelta dal cliente, cosi' il cambio sagoma non rifa' il disegno due volte
		if (forma === 'sagomato' || !file) {
			w = s.srcMM && s.srcMM.w >= MIN_MM && s.srcMM.w <= MAX_MM ? clamp(s.srcMM.w) : suggestedSize(r)[0];
			h = clamp(w / r);
		} else if (shape?.equal) h = w;
	}

	const clamp = (v: number) => Math.min(MAX_MM, Math.max(MIN_MM, roundHalf(v || MIN_MM)));
	function onImgLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth && img.naturalHeight) fileRatio = img.naturalWidth / img.naturalHeight;
	}
	function pick(f: File | undefined) {
		if (!f) return;
		if (fileUrl) URL.revokeObjectURL(fileUrl);
		file = f;
		fileUrl = URL.createObjectURL(f);
		saveDraft({ product, forma, materiale, file: f, savedAt: Date.now() }).catch(() => {});
	}
	function setW(v: number) {
		w = clamp(v);
		if (!freeSize) h = clamp(w / ratio);
	}
	function setH(v: number) {
		h = clamp(v);
		if (!freeSize) w = clamp(h * ratio);
	}
	function next(id: string) {
		const i = steps.indexOf(id);
		return steps[Math.min(i + 1, steps.length - 1)];
	}
	// la scelta non chiude il passo: il cliente confronta con calma e va avanti quando vuole
	function choose(setter: () => void, _from: string) {
		setter();
	}
	// si può ordinare solo con un file caricato
	async function addCart() {
		if (!file) return;
		const it = addToCart({ product, productName: productName.replace(/^(i tuoi|le tue) /, ''), engineProduct, forma, materiale, finitura: showFinish ? finitura : undefined, w, h, qty, net: q.net, gross: q.gross, fileName: file.name, note });
		try {
			await saveCartFile(it.id, file);
			if (lastPng) {
				const blob = await (await fetch(lastPng)).blob();
				await saveCartPreview(it.id, blob);
			}
		} catch {
			/* senza IndexedDB il file andrà ricaricato al checkout */
		}
		added = true;
	}
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
</script>

<section class="cfg" class:cfg--test={test} id="configura">
	{#if !test}
		<!-- ANTEPRIMA + BARRA COMANDI (sfondo · rimuovi sfondo · cambia file · tracciato) -->
		<div class="cfg__preview">
			{#if file}
				<EnginePreview bind:this={engine} {file} {forma} {materiale} finitura={showFinish ? finitura : 'lucida'} prodotto={engineProduct} {foglio} {rilievo} {w} {h} {showCut} panel stage={foglio ? 440 : 370} onrender={onRender} />
				{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
				<div class="cfg__bar">
					<div class="cfg__bar-group">
						<span class="cfg__bar-label">Sfondo</span>
						<div class="cfg__dots">
							{#each palette as c, i (i)}
								<button type="button" class="cfg__dot" class:is-on={i === palIdx} style={c.img === 'checker' ? 'background:repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/10px 10px' : c.img ? `background-image:url(${c.img});background-size:cover` : `background:${c.hex}`} title={c.img ? 'Colore del materiale' : c.hex.toUpperCase()} aria-label="Sfondo {c.hex}" onclick={() => engine?.post('bg', { idx: i })}></button>
							{/each}
							<!-- colore libero: il pallino arcobaleno apre il selettore e il colore scelto si aggiunge alla tavolozza -->
							<button type="button" class="cfg__dot cfg__dot--arc" title="Scegli un colore tuo" aria-label="Scegli un colore di sfondo" onclick={() => colInput?.click()}></button>
							<input bind:this={colInput} type="color" class="cfg__col" value={palette[palIdx]?.hex ?? '#ffffff'} oninput={(e) => engine?.post('bgcol', { hex: (e.currentTarget as HTMLInputElement).value })} />
						</div>
						<button type="button" class="cfg__tool" class:is-on={rimuovi} onclick={() => engine?.post('rimuovi')} title="Toglie lo sfondo del file: resta solo il disegno">✨ Rimuovi sfondo</button>
					</div>
					<div class="cfg__bar-group">
						<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
						<button type="button" class="cfg__tool cfg__tool--blue" onclick={() => fileInput?.click()} title={file.name}>Cambia file</button>
						<button type="button" class="eye" class:is-off={!showCut} onclick={() => (showCut = !showCut)} aria-pressed={showCut} title={showCut ? 'Nascondi la linea di taglio' : 'Mostra la linea di taglio'}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{#if !showCut}<path d="M3 3l18 18" />{/if}</svg>
							<span class="eye__dash" aria-hidden="true"></span>
							<span class="sr-only">Linea di taglio</span>
						</button>
					</div>
				</div>
			{:else}
				<label class="dropzone dropzone--compact cfg__drop" class:is-over={over}
					ondragenter={(e) => { e.preventDefault(); over = true; }}
					ondragover={(e) => { e.preventDefault(); over = true; }}
					ondragleave={() => (over = false)}
					ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}>
					<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
					<div>
						<div class="dropzone__icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></div>
						<div class="dropzone__title">Trascina qui il tuo file</div>
						<div class="dropzone__sub">oppure clicca per sceglierlo · PNG, JPG, SVG, PDF</div>
					</div>
				</label>
			{/if}
		</div>
	{/if}

	<!-- CONFIGURAZIONE -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div>
				<p class="eyebrow">{test ? 'Test preventivatore' : 'Configura in 30 secondi'}</p>
				<h2 class="cfg__title">Crea {productName}</h2>
			</div>
			<span class="cfg__stepcount">Passaggio {stepNo(step)} di {steps.length}</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- sagoma -->
		<div class="step" class:is-open={step === 'forma'}>
			<button class="step__head" type="button" onclick={() => (step = 'forma')} aria-expanded={step === 'forma'}>
				<span class="step__n">{#if stepNo(step) > stepNo('forma')}✓{:else}{stepNo('forma')}{/if}</span>
				<span class="step__title">Seleziona sagoma {#if step !== 'forma'}<em>{shape?.label}</em>{/if}</span>
				<span class="step__edit">{step === 'forma' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'forma'}
				<div class="step__body">
					<div class="pic-grid pic-grid--3">
						{#each SHAPES as s (s.id)}
							<button type="button" class="pic" class:is-active={forma === s.id} onclick={() => choose(() => (forma = s.id), 'forma')}>
								<img src={s.img} alt="" />
								<b>{s.label}</b>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- materiale -->
		{#if showMaterials}
			<div class="step" class:is-open={step === 'materiale'}>
				<button class="step__head" type="button" onclick={() => (step = 'materiale')} aria-expanded={step === 'materiale'}>
					<span class="step__n">{#if stepNo(step) > stepNo('materiale')}✓{:else}{stepNo('materiale')}{/if}</span>
					<span class="step__title">Materiale {#if step !== 'materiale'}<em>{material?.label}</em>{/if}</span>
					<span class="step__edit">{step === 'materiale' ? '' : 'Modifica'}</span>
				</button>
				{#if step === 'materiale'}
					<div class="step__body">
						<p class="step__hint">Non sai quale scegliere? Il bianco va bene quasi sempre.</p>
						<div class="pic-grid pic-grid--3 pic-grid--sm">
							{#each MATERIALS as m (m.id)}
								<button type="button" class="pic" class:is-active={materiale === m.id} onclick={() => choose(() => (materiale = m.id), 'materiale')}>
									<img src={m.img} alt="" />
									<b>{m.label}</b>
									{#if m.tag}<span class="pic__tag">{m.tag}</span>{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- finitura (solo prodotti con lamina) -->
		{#if showFinish}
			<div class="step" class:is-open={step === 'finitura'}>
				<button class="step__head" type="button" onclick={() => (step = 'finitura')} aria-expanded={step === 'finitura'}>
					<span class="step__n">{#if stepNo(step) > stepNo('finitura')}✓{:else}{stepNo('finitura')}{/if}</span>
					<span class="step__title">{cfg.finishTitle ?? 'Lamina protettiva'} {#if step !== 'finitura'}<em>{finish?.label}</em>{/if}</span>
					<span class="step__edit">{step === 'finitura' ? '' : 'Modifica'}</span>
				</button>
				{#if step === 'finitura'}
					<div class="step__body">
						<div class="pic-grid pic-grid--3 pic-grid--sm">
							{#each FINISHES as f (f.id)}
								<button type="button" class="pic" class:is-active={finitura === f.id} onclick={() => choose(() => (finitura = f.id), 'finitura')}>
									{#if f.tag}<span class="pic__tag">{f.tag}</span>{/if}
									<img src={f.img} alt="" />
									<b>{f.label}</b>
									<small>{f.description ?? ''}</small>
								</button>
							{/each}
						</div>
						{#if finitura === 'nessuna'}<p class="step__hint">Ideale se ti servono adesivi di alta qualità per uso promozionale provvisorio. Tradotto: poca spesa, tantissima resa.</p>{/if}
						{#if cfg.finishNote}<p class="step__hint">{cfg.finishNote}</p>{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- misura -->
		<div class="step" class:is-open={step === 'misura'}>
			<button class="step__head" type="button" onclick={() => (step = 'misura')} aria-expanded={step === 'misura'}>
				<span class="step__n">{#if stepNo(step) > stepNo('misura')}✓{:else}{stepNo('misura')}{/if}</span>
				<span class="step__title">Dimensione {#if step !== 'misura'}<em>{fmt(w)} × {fmt(h)} mm</em>{/if}</span>
				<span class="step__edit">{step === 'misura' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'misura'}
				<div class="step__body">
					<div class="size-presets">
						{#each presets as [pw, ph], k (pw)}
							<button type="button" class="size-btn" class:is-active={w === pw && h === ph} onclick={() => { w = pw; h = ph; }}>{#if file && k === 0}<small>Consigliata</small>{/if}{fmt(pw)} × {fmt(ph)} mm</button>
						{/each}
					</div>
					<div class="size-inputs">
						<label><span>Larghezza</span><input type="number" min={MIN_MM} max={MAX_MM} step="0.5" value={w} onchange={(e) => setW(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
						<span class="size-x">×</span>
						<label><span>Altezza</span><input type="number" min={MIN_MM} max={MAX_MM} step="0.5" value={h} onchange={(e) => setH(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
					</div>
				</div>
			{/if}
		</div>

		<!-- quantità -->
		<!-- sempre aperto: il cliente vede tutti i prezzi a colpo d'occhio -->
		<div class="step is-open step--qty">
			<div class="step__head" role="presentation">
				<span class="step__n">{stepNo('qty')}</span>
				<span class="step__title">Scegli quantità <em>{qty.toLocaleString('it-IT')} pezzi · {eur0(vatIncluded ? q.gross : q.net)}</em></span>
			</div>
				<div class="step__body">
					{#if foglio && perSheet && file}
						<p class="step__hint step__hint--box">Con questa misura entrano <b>{perSheet.n} etichette per foglio</b> ({perSheet.cols} × {perSheet.rows} su un foglio {perSheet.w} × {perSheet.h} mm): {qty.toLocaleString('it-IT')} pezzi sono <b>{Math.ceil(qty / perSheet.n)} {Math.ceil(qty / perSheet.n) === 1 ? 'foglio' : 'fogli'}</b>.</p>
					{/if}
					<div class="qty-grid">
						{#each cfg.quantities as n (n)}
							{@const qq = quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: n, vatIncluded })}
							{@const disc = Math.max(0, Math.round((1 - qq.perPiece / basePerPiece) * 100))}
							<button type="button" class="qty" class:is-active={qty === n} onclick={() => { custom = false; qty = n; }}>
								{#if n === cfg.recommendedQty}<span class="qty__tag">Consigliato</span>{/if}
								<span class="qty__top"><b>{n.toLocaleString('it-IT')}</b><b>{eur0(vatIncluded ? qq.gross : qq.net)}</b></span>
								<span class="qty__bottom">{qq.perPiece.toFixed(2).replace('.', ',')} €/pz {#if disc > 0}<b>−{disc}%</b>{/if}</span>
							</button>
						{/each}
					</div>
					{#if !test}
						<button type="button" class="link-btn" style="justify-self:start;font-size:14px" onclick={() => (customOpen = !customOpen)}>Ti serve un’altra quantità?</button>
						{#if customOpen}
							<div class="qty-custom">
								<label>Quantità<input type="number" min={minQty} step="1" bind:value={customQty} placeholder={String(minQty)} onkeydown={(e) => { if (e.key === 'Enter') applyCustom(); }} /></label>
								<button type="button" class="btn btn--blue btn--sm" onclick={applyCustom}>Calcola</button>
								{#if custom}<span class="qty-custom__res"><b>{qty.toLocaleString('it-IT')} pezzi</b> · {eur0(vatIncluded ? q.gross : q.net)} · {q.perPiece.toFixed(2).replace('.', ',')} €/pz</span>{/if}
							</div>
						{/if}
					{/if}
				</div>
		</div>

	</aside>

	<!-- RIEPILOGO: spedizione, credito, totale e bottone, tutti alla stessa altezza -->
	<div class="cfg__summary">
		<div class="sum sum--ship">
			<span class="sum__ico">🚀</span>
			<div class="sum__text"><span class="sum__label">Pronti per la spedizione</span><span class="sum__value">{shipDate}</span><span class="sum__sub">Corriere espresso tracciato</span></div>
		</div>
		<div class="sum sum--credit">
			<span class="sum__ico"><img src="/images/coin-sp.png" alt="Credito Stickerprint" /></span>
			<div class="sum__text"><span class="sum__label">Guadagni in credito</span><span class="sum__value">{eur2(q.credit)}</span><span class="sum__sub">da usare sul prossimo ordine</span></div>
		</div>
		<div class="sum sum--total">
			<div class="sum__text">
				<span class="sum__label">Totale {vatIncluded ? 'IVA inclusa' : 'IVA esclusa'}</span>
				<span class="sum__value sum__value--big">{eur0(vatIncluded ? q.gross : q.net)}</span>
				<div class="vat-toggle">
					<span class:active={!vatIncluded}>IVA esclusa</span>
					<button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label="Mostra prezzi IVA inclusa" onclick={() => (vatIncluded = !vatIncluded)}><i></i></button>
					<span class:active={vatIncluded}>IVA inclusa</span>
				</div>
			</div>
			<span class="sum__per">{q.perPiece.toFixed(2).replace('.', ',')} €/pz</span>
		</div>
		{#if test}
			<div class="test-detail">
				<b>Netto {eur2(q.net)}</b> · materiale {eur2(q.breakdown.material)} · stampa {eur2(q.breakdown.print)}{#if cfg.kind === 'lamina'} · lamina {eur2(q.breakdown.laminate)}{:else} · resina {eur2(q.breakdown.resin)}{/if} · avvio {eur2(q.breakdown.setup)}<br />
				{q.breakdown.m2.toFixed(3)} m² · commercial range ×{(1 + q.breakdown.cr).toFixed(2)} · price range ×{(1 + q.breakdown.pr).toFixed(2)}
			</div>
		{:else}
			<button class="btn btn--green btn--cart" type="button" onclick={addCart} disabled={!file} title={file ? '' : 'Carica il tuo file per ordinare'}>{file ? 'Aggiungi al carrello →' : 'Carica il file per ordinare'}</button>
		{/if}
	</div>
</section>

{#if !test}
	<details class="special special--below">
		<summary><span class="special__ico">💬</span> Hai una richiesta particolare? <em>Scrivicela qui: la leggiamo davvero, promesso.</em></summary>
		<textarea rows="3" placeholder="Es. colore Pantone da rispettare, consegna entro una data, file da sistemare…" bind:value={note}></textarea>
	</details>
{/if}

{#if added}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="added-bg" onclick={(e) => { if (e.target === e.currentTarget) added = false; }} onkeydown={(e) => { if (e.key === 'Escape') added = false; }}>
		<div class="added" role="dialog" aria-modal="true" aria-label="Prodotto aggiunto al carrello">
			<span class="added__ck">✓</span>
			<h3>Prodotto aggiunto al carrello</h3>
			<p>{qty.toLocaleString('it-IT')} × {productName.replace(/^(i tuoi|le tue) /, '')} · {fmt(w)} × {fmt(h)} mm · {eur0(q.gross)}</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href="/checkout">Vai al checkout →</a>
				<a class="btn btn--ghost btn--lg" href="/prodotti">Continua gli acquisti</a>
			</div>
		</div>
	</div>
{/if}
