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
	import { loadDraft, saveDraft } from '$lib/utils/draftStore';
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

	// valori iniziali coerenti con il listino (anche quando il listino cambia sotto, in dashboard)
	$effect(() => {
		if (!SHAPES.some((s) => s.id === forma)) forma = SHAPES[0]?.id ?? 'sagomato';
		if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco';
		if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna';
		if (!cfg.quantities.includes(qty)) qty = cfg.quantities.includes(cfg.recommendedQty) ? cfg.recommendedQty : cfg.quantities[0];
		if (!steps.includes(step)) step = steps[0];
	});

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? cfg.materials[0]);
	const finish = $derived(FINISHES.find((f) => f.id === finitura));
	const fin = $derived(showFinish ? finitura : 'nessuna');
	const ratio = $derived(shape?.equal ? 1 : (shape?.ratio ?? cutRatio ?? fileRatio ?? 1));
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
		const d = await loadDraft();
		if (d && d.product === product) {
			file = d.file;
			fileUrl = URL.createObjectURL(d.file);
			if (SHAPES.some((s) => s.id === d.forma)) forma = d.forma;
			if (MATERIALS.some((m) => m.id === d.materiale)) materiale = d.materiale;
		}
	});

	function onRender(s: { w: number; h: number; srcMM: { w: number; h: number } | null }) {
		const key = `${file?.name ?? ''}|${file?.size ?? 0}|${forma}`;
		if (key === sizeKey) return;
		sizeKey = key;
		const r = shape?.equal ? 1 : (shape?.ratio ?? (s.h > 0 ? s.w / s.h : (fileRatio ?? 1)));
		cutRatio = r;
		w = s.srcMM && s.srcMM.w >= MIN_MM && s.srcMM.w <= MAX_MM ? clamp(s.srcMM.w) : suggestedSize(r)[0];
		h = clamp(w / r);
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
		h = clamp(w / ratio);
	}
	function setH(v: number) {
		h = clamp(v);
		w = clamp(h * ratio);
	}
	function next(id: string) {
		const i = steps.indexOf(id);
		return steps[Math.min(i + 1, steps.length - 1)];
	}
	function choose(setter: () => void, from: string) {
		setter();
		setTimeout(() => (step = next(from)), 220);
	}
	function addCart() {
		addToCart({ product, forma, materiale, w, h, qty, gross: q.gross, fileName: file?.name ?? null, note: `${showFinish ? finitura : ''}${note ? ' · ' + note : ''}` });
		added = true;
		setTimeout(() => (added = false), 4000);
	}
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
</script>

<section class="cfg" class:cfg--test={test} id="configura">
	{#if !test}
		<!-- ANTEPRIMA + COMANDI DEL MOTORE -->
		<div class="cfg__preview">
			{#if file}
				<EnginePreview {file} {forma} {materiale} finitura={showFinish ? finitura : 'lucida'} prodotto={engineProduct} {w} {h} {showCut} panel stage={400} onrender={onRender} />
				{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
			{:else}
				<div class="cfg__stage cfg__stage--empty">
					<div class="cfg__placeholder"><strong>IL TUO<br />DESIGN</strong><small>qui</small></div>
				</div>
			{/if}
			<div class="cfg__tools" class:cfg__tools--static={!file}>
				<button type="button" class="eye" class:is-off={!showCut} onclick={() => (showCut = !showCut)} aria-pressed={showCut} title={showCut ? 'Nascondi la linea di taglio' : 'Mostra la linea di taglio'}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{#if !showCut}<path d="M3 3l18 18" />{/if}</svg>
					<span class="eye__dash" aria-hidden="true"></span>
					<span class="sr-only">Linea di taglio</span>
				</button>
				<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
				<button type="button" class="link-btn link-btn--bold" onclick={() => fileInput?.click()}>{file ? 'Cambia file' : 'Carica il tuo file'}</button>
				{#if file}<span class="cfg__filename">{file.name}</span>{/if}
			</div>
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
					<span class="step__title">Lamina protettiva {#if step !== 'finitura'}<em>{finish?.label}</em>{/if}</span>
					<span class="step__edit">{step === 'finitura' ? '' : 'Modifica'}</span>
				</button>
				{#if step === 'finitura'}
					<div class="step__body">
						<div class="pic-grid pic-grid--3 pic-grid--sm">
							{#each FINISHES as f (f.id)}
								<button type="button" class="pic" class:is-active={finitura === f.id} onclick={() => choose(() => (finitura = f.id), 'finitura')}>
									<img src={f.img} alt="" />
									<b>{f.label}</b>
									<small>{f.description ?? ''}</small>
								</button>
							{/each}
						</div>
						{#if finitura === 'nessuna'}<p class="step__hint">Ideale se ti servono adesivi di alta qualità per uso promozionale provvisorio. Tradotto: poca spesa, tantissima resa.</p>{/if}
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
					{#if test}
						<p class="step__hint">Misure proposte per la sagoma "{shape?.label}" (da {MIN_MM} a {MAX_MM} mm).</p>
					{:else if !file}
						<p class="step__hint step__hint--box">Carica il tuo file: rileviamo la proporzione e ti consigliamo la misura.</p>
					{:else}
						<p class="step__hint">Misura consigliata per il tuo file: <b>{fmt(suggested[0])} × {fmt(roundHalf(suggested[0] / ratio))} mm</b>. Le proporzioni restano sempre bloccate.</p>
					{/if}
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
					<p class="step__lock">🔗 Cambia un lato: l’altro segue la proporzione{shape?.equal ? ' (per tondo e quadrato i lati sono uguali)' : ''}. Arrotondiamo al mezzo millimetro.</p>
					<button class="step__continue" type="button" onclick={() => (step = 'qty')}>Continua alla quantità</button>
				</div>
			{/if}
		</div>

		<!-- quantità -->
		<div class="step" class:is-open={step === 'qty'}>
			<button class="step__head" type="button" onclick={() => (step = 'qty')} aria-expanded={step === 'qty'}>
				<span class="step__n">{stepNo('qty')}</span>
				<span class="step__title">Scegli quantità {#if step !== 'qty'}<em>{qty.toLocaleString('it-IT')} pezzi · {eur0(vatIncluded ? q.gross : q.net)}</em>{/if}</span>
				<span class="step__edit">{step === 'qty' ? '' : 'Modifica'}</span>
			</button>
			{#if step === 'qty'}
				<div class="step__body">
					<div class="qty-grid">
						{#each cfg.quantities as n (n)}
							{@const qq = quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: n, vatIncluded })}
							{@const disc = Math.max(0, Math.round((1 - qq.perPiece / basePerPiece) * 100))}
							<button type="button" class="qty" class:is-active={qty === n} onclick={() => (qty = n)}>
								{#if n === cfg.recommendedQty}<span class="qty__tag">Consigliato</span>{/if}
								<span class="qty__top"><b>{n.toLocaleString('it-IT')}</b><b>{eur0(vatIncluded ? qq.gross : qq.net)}</b></span>
								<span class="qty__bottom">{qq.perPiece.toFixed(2).replace('.', ',')} €/pz {#if disc > 0}<b>−{disc}%</b>{/if}</span>
							</button>
						{/each}
					</div>
					{#if !test}<a class="link" href="/support" style="font-size:14px">Ti serve un’altra quantità?</a>{/if}
				</div>
			{/if}
		</div>

		{#if !test}
			<details class="special">
				<summary>Hai una richiesta particolare?</summary>
				<textarea rows="3" placeholder="Scrivici qui: la leggiamo davvero, promesso." bind:value={note}></textarea>
			</details>
		{/if}
	</aside>

	<!-- RIEPILOGO -->
	<div class="cfg__summary">
		<div class="sum-ship">
			<span class="sum-ico">🚚</span>
			<span><small>Pronti per la spedizione</small><strong>{shipDate}</strong></span>
		</div>
		<div class="sum-credit">
			<img class="sum-coin" src="/images/coin-sp.png" alt="Credito Stickerprint" width="44" height="42" />
			<span><strong>Guadagni {eur2(q.credit)}</strong><small>di credito da usare sul prossimo ordine</small></span>
		</div>
		<div class="sum-price">
			<div class="total-box">
				<span>Totale {eur0(vatIncluded ? q.gross : q.net)}</span>
				<span class="total-box__per">{q.perPiece.toFixed(2)}€/pz</span>
			</div>
			<div class="vat-toggle">
				<span class:active={!vatIncluded}>IVA esclusa</span>
				<button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label="Mostra prezzi IVA inclusa" onclick={() => (vatIncluded = !vatIncluded)}><i></i></button>
				<span class:active={vatIncluded}>IVA inclusa</span>
			</div>
		</div>
		{#if test}
			<div class="test-detail">
				<b>Netto {eur2(q.net)}</b> · materiale {eur2(q.breakdown.material)} · stampa {eur2(q.breakdown.print)}{#if cfg.kind === 'lamina'} · lamina {eur2(q.breakdown.laminate)}{:else} · resina {eur2(q.breakdown.resin)}{/if} · avvio {eur2(q.breakdown.setup)}<br />
				{q.breakdown.m2.toFixed(3)} m² · commercial range ×{(1 + q.breakdown.cr).toFixed(2)} · price range ×{(1 + q.breakdown.pr).toFixed(2)}
			</div>
		{:else}
			<button class="btn btn--green btn--cart" type="button" onclick={addCart}>{added ? 'Aggiunto ✓' : 'Aggiungi al carrello →'}</button>
		{/if}
	</div>
</section>
