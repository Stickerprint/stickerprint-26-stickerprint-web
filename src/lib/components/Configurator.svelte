<script lang="ts">
	/**
	 * Preventivatore adesivi personalizzati.
	 * Sinistra: il logo del cliente con i comandi del motore (bordo, angoli, zoom/centratura, sfondo).
	 * Destra: 5 passi (sagoma, materiale, finitura, misura, quantità) e riepilogo.
	 */
	import { onMount } from 'svelte';
	import EnginePreview from './EnginePreview.svelte';
	import { loadDraft, saveDraft } from '$lib/utils/draftStore';
	import { addToCart } from '$lib/cart';
	import {
		SHAPES, MATERIALS, FINISHES, QTY_TIERS, MIN_MM, MAX_MM,
		quote, sizeFactor, tierPrice, suggestedSize, roundHalf, eur0, eur2
	} from '$lib/pricing/adesivi';

	let { shipDate }: { shipDate: string } = $props();

	const STEPS = 5;
	let forma = $state('sagomato');
	let materiale = $state('bianco');
	let finitura = $state('lucida');
	let w = $state(50);
	let h = $state(50);
	let fileRatio = $state<number | null>(null); // larghezza/altezza del file (dall'immagine)
	let cutRatio = $state<number | null>(null); // larghezza/altezza della sagoma generata dal motore
	let showCut = $state(true);
	let sizeKey = '';
	let qty = $state(500);
	let step = $state(1);
	let vatIncluded = $state(true);
	let file = $state<File | null>(null);
	let fileUrl = $state<string | null>(null);
	let note = $state('');
	let added = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? MATERIALS[0]);
	const finish = $derived(FINISHES.find((f) => f.id === finitura) ?? FINISHES[1]);
	/** proporzione effettiva della sagoma: tondo e quadrato sono sempre 1:1 */
	const ratio = $derived(shape.equal ? 1 : (cutRatio ?? fileRatio ?? 1));
	const factor = $derived(sizeFactor(w, h, materiale, forma, finitura));
	const q = $derived(quote({ w, h, materiale, forma, finitura, qty, vatIncluded }));
	const progress = $derived((step / STEPS) * 100);
	/** misure proposte: larghezze fisse, altezza in proporzione */
	const suggested = $derived(suggestedSize(ratio));
	const presets = $derived(
		[suggested[0], ...[30, 50, 70, 100].filter((x) => x !== suggested[0])].slice(0, 4).map((pw) => [pw, roundHalf(pw / ratio)] as [number, number])
	);

	onMount(async () => {
		const d = await loadDraft();
		if (d && d.product === 'adesivi_personalizzati') {
			file = d.file;
			fileUrl = URL.createObjectURL(d.file);
			forma = SHAPES.some((s) => s.id === d.forma) ? d.forma : forma;
			materiale = MATERIALS.some((m) => m.id === d.materiale) ? d.materiale : 'bianco';
		}
	});

	/**
	 * Misura rilevata dal file: quando il motore ha generato la sagoma, per ogni file+sagoma
	 * si parte dalla misura reale (PDF/SVG hanno dimensioni fisiche) o da quella consigliata
	 * per la proporzione; poi il cliente può cambiarla e l'altro lato segue.
	 */
	function onRender(s: { w: number; h: number; srcMM: { w: number; h: number } | null }) {
		const key = `${file?.name ?? ''}|${file?.size ?? 0}|${forma}`;
		if (key === sizeKey) return;
		sizeKey = key;
		const r = shape.equal ? 1 : s.h > 0 ? s.w / s.h : (fileRatio ?? 1);
		cutRatio = r;
		if (s.srcMM && s.srcMM.w >= MIN_MM && s.srcMM.w <= MAX_MM) {
			w = clamp(s.srcMM.w);
		} else {
			w = suggestedSize(r)[0];
		}
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
		saveDraft({ product: 'adesivi_personalizzati', forma, materiale, file: f, savedAt: Date.now() }).catch(() => {});
	}
	function setW(v: number) {
		w = clamp(v);
		h = clamp(w / ratio);
	}
	function setH(v: number) {
		h = clamp(v);
		w = clamp(h * ratio);
	}
	function choose(setter: () => void, next: number) {
		setter();
		setTimeout(() => (step = next), 220);
	}
	function addCart() {
		addToCart({ product: 'adesivi_personalizzati', forma, materiale, w, h, qty, gross: q.gross, fileName: file?.name ?? null, note: `${finitura}${note ? ' · ' + note : ''}` });
		added = true;
		setTimeout(() => (added = false), 4000);
	}
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
</script>

<section class="cfg" id="configura">
	<!-- ANTEPRIMA + COMANDI DEL MOTORE -->
	<div class="cfg__preview">
		{#if file}
			<EnginePreview {file} {forma} {materiale} {finitura} {w} {h} {showCut} panel stage={400} onrender={onRender} />
			{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
		{:else}
			<div class="cfg__stage cfg__stage--empty">
				<div class="cfg__placeholder"><strong>IL TUO<br />DESIGN</strong><small>qui</small></div>
			</div>
		{/if}
		<div class="cfg__tools" class:cfg__tools--static={!file}
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

	<!-- CONFIGURAZIONE -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div>
				<p class="eyebrow">Configura in 30 secondi</p>
				<h2 class="cfg__title">Crea i tuoi adesivi</h2>
			</div>
			<span class="cfg__stepcount">Passaggio {step} di {STEPS}</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- 1 sagoma -->
		<div class="step" class:is-open={step === 1}>
			<button class="step__head" type="button" onclick={() => (step = 1)} aria-expanded={step === 1}>
				<span class="step__n">{#if step > 1}✓{:else}1{/if}</span>
				<span class="step__title">Seleziona sagoma {#if step !== 1}<em>{shape.label}</em>{/if}</span>
				<span class="step__edit">{step === 1 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 1}
				<div class="step__body">
					<div class="pic-grid pic-grid--3">
						{#each SHAPES as s (s.id)}
							<button type="button" class="pic" class:is-active={forma === s.id} onclick={() => choose(() => (forma = s.id), 2)}>
								<img src={s.img} alt="" />
								<b>{s.label}</b>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- 2 materiale -->
		<div class="step" class:is-open={step === 2}>
			<button class="step__head" type="button" onclick={() => (step = 2)} aria-expanded={step === 2}>
				<span class="step__n">{#if step > 2}✓{:else}2{/if}</span>
				<span class="step__title">Materiale {#if step !== 2}<em>{material.label}</em>{/if}</span>
				<span class="step__edit">{step === 2 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 2}
				<div class="step__body">
					<p class="step__hint">Non sai quale scegliere? Il bianco va bene quasi sempre.</p>
					<div class="pic-grid pic-grid--3 pic-grid--sm">
						{#each MATERIALS as m (m.id)}
							<button type="button" class="pic" class:is-active={materiale === m.id} onclick={() => choose(() => (materiale = m.id), 3)}>
								<img src={m.img} alt="" />
								<b>{m.label.replace('Vinile ', '')}</b>
								{#if m.tag}<span class="pic__tag">{m.tag}</span>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- 3 finitura -->
		<div class="step" class:is-open={step === 3}>
			<button class="step__head" type="button" onclick={() => (step = 3)} aria-expanded={step === 3}>
				<span class="step__n">{#if step > 3}✓{:else}3{/if}</span>
				<span class="step__title">Lamina protettiva {#if step !== 3}<em>{finish.label}</em>{/if}</span>
				<span class="step__edit">{step === 3 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 3}
				<div class="step__body">
					<div class="pic-grid pic-grid--3 pic-grid--sm">
						{#each FINISHES as f (f.id)}
							<button type="button" class="pic" class:is-active={finitura === f.id} onclick={() => choose(() => (finitura = f.id), 4)}>
								<img src={f.img} alt="" />
								<b>{f.label}</b>
								<small>{f.description}</small>
							</button>
						{/each}
					</div>
					{#if finitura === 'nessuna'}<p class="step__hint">Ideale se ti servono adesivi personalizzati di alta qualità per uso promozionale provvisorio. Tradotto: poca spesa, tantissima resa.</p>{/if}
				</div>
			{/if}
		</div>

		<!-- 4 misura -->
		<div class="step" class:is-open={step === 4}>
			<button class="step__head" type="button" onclick={() => (step = 4)} aria-expanded={step === 4}>
				<span class="step__n">{#if step > 4}✓{:else}4{/if}</span>
				<span class="step__title">Dimensione {#if step !== 4}<em>{fmt(w)} × {fmt(h)} mm</em>{/if}</span>
				<span class="step__edit">{step === 4 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 4}
				<div class="step__body">
					{#if !file}
						<p class="step__hint step__hint--box">Carica il tuo file: rileviamo la proporzione e ti consigliamo la misura.</p>
					{:else}
						<p class="step__hint">Misura consigliata per il tuo file: <b>{fmt(suggested[0])} × {fmt(roundHalf(suggested[0] / ratio))} mm</b>. Le proporzioni restano sempre bloccate.</p>
					{/if}
					<div class="size-presets">
						{#each presets as [pw, ph], k (pw)}
							<button type="button" class="size-btn" class:is-active={w === pw && h === ph} onclick={() => { w = pw; h = ph; }}>{#if k === 0}<small>Consigliata</small>{/if}{fmt(pw)} × {fmt(ph)} mm</button>
						{/each}
					</div>
					<div class="size-inputs">
						<label><span>Larghezza</span><input type="number" min={MIN_MM} max={MAX_MM} step="0.5" value={w} onchange={(e) => setW(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
						<span class="size-x">×</span>
						<label><span>Altezza</span><input type="number" min={MIN_MM} max={MAX_MM} step="0.5" value={h} onchange={(e) => setH(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
					</div>
					<p class="step__lock">🔗 Cambia un lato: l’altro segue la proporzione{shape.equal ? ' (per tondo e quadrato i lati sono uguali)' : ''}. Arrotondiamo al mezzo millimetro.</p>
					<button class="step__continue" type="button" onclick={() => (step = 5)}>Continua alla quantità</button>
				</div>
			{/if}
		</div>

		<!-- 5 quantità -->
		<div class="step" class:is-open={step === 5}>
			<button class="step__head" type="button" onclick={() => (step = 5)} aria-expanded={step === 5}>
				<span class="step__n">5</span>
				<span class="step__title">Scegli quantità {#if step !== 5}<em>{qty.toLocaleString('it-IT')} pezzi · {eur0(q.gross)}</em>{/if}</span>
				<span class="step__edit">{step === 5 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 5}
				<div class="step__body">
					<div class="qty-grid">
						{#each QTY_TIERS as t (t.qty)}
							{@const price = tierPrice(t, factor)}
							{@const shown = vatIncluded ? price : price / 1.22}
							{@const per = shown / t.qty}
							{@const base = tierPrice(QTY_TIERS[0], factor) / 50}
							{@const disc = Math.max(0, Math.round((1 - price / t.qty / base) * 100))}
							<button type="button" class="qty" class:is-active={qty === t.qty} onclick={() => (qty = t.qty)}>
								{#if t.tag}<span class="qty__tag">{t.tag}</span>{/if}
								<span class="qty__top"><b>{t.qty.toLocaleString('it-IT')}</b><b>{eur0(shown)}</b></span>
								<span class="qty__bottom">{per.toFixed(2).replace('.', ',')} €/pz {#if disc > 0}<b>−{disc}%</b>{/if}</span>
							</button>
						{/each}
					</div>
					<a class="link" href="/support" style="font-size:14px">Ti serve un’altra quantità?</a>
				</div>
			{/if}
		</div>

		<details class="special">
			<summary>Hai una richiesta particolare?</summary>
			<textarea rows="3" placeholder="Scrivici qui: la leggiamo davvero, promesso." bind:value={note}></textarea>
		</details>
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
		<button class="btn btn--green btn--cart" type="button" onclick={addCart}>{added ? 'Aggiunto ✓' : 'Aggiungi al carrello →'}</button>
	</div>
</section>
