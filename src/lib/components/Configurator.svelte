<script lang="ts">
	/**
	 * Preventivatore adesivi personalizzati — replica del prototipo di riferimento:
	 * a sinistra l'anteprima viva, a destra i 4 passi (sagoma, materiale, misura, quantità),
	 * in basso il riepilogo con data di spedizione, credito, totale e IVA.
	 */
	import { onMount } from 'svelte';
	import EnginePreview from './EnginePreview.svelte';
	import { loadDraft, saveDraft } from '$lib/utils/draftStore';
	import { addToCart } from '$lib/cart';
	import {
		SHAPES, MATERIALS, QTY_TIERS, SIZE_PRESETS, MIN_MM, MAX_MM,
		quote, sizeFactor, tierPrice, suggestedSize, eur0, eur2
	} from '$lib/pricing/adesivi';

	let { shipDate }: { shipDate: string } = $props();

	let forma = $state('sagomato');
	let materiale = $state('bianco');
	let w = $state(50);
	let h = $state(50);
	let ratio = $state<number | null>(null); // larghezza/altezza del file
	let qty = $state(500);
	let step = $state(1);
	let vatIncluded = $state(true);
	let file = $state<File | null>(null);
	let fileUrl = $state<string | null>(null);
	let note = $state('');
	let added = $state(false);
	let snapshot = $state<{ png: string | null; w: number; h: number } | null>(null);
	let fileInput = $state<HTMLInputElement | undefined>();

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? MATERIALS[0]);
	const factor = $derived(sizeFactor(w, h, materiale, forma));
	const q = $derived(quote({ w, h, materiale, forma, qty, vatIncluded }));
	const progress = $derived((step / 4) * 100);

	onMount(async () => {
		const d = await loadDraft();
		if (d && d.product === 'adesivi_personalizzati') {
			file = d.file;
			fileUrl = URL.createObjectURL(d.file);
			forma = d.forma || forma;
			materiale = MATERIALS.some((m) => m.id === d.materiale) ? d.materiale : 'bianco';
			if (d.widthMm && d.heightMm) applyRatio(d.widthMm / d.heightMm);
		}
	});

	function applyRatio(r: number) {
		ratio = r;
		const [sw, sh] = suggestedSize(r);
		w = sw;
		h = sh;
	}
	function onImgLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth && img.naturalHeight) applyRatio(img.naturalWidth / img.naturalHeight);
	}
	function pick(f: File | undefined) {
		if (!f) return;
		if (fileUrl) URL.revokeObjectURL(fileUrl);
		file = f;
		fileUrl = URL.createObjectURL(f);
		snapshot = null;
		saveDraft({ product: 'adesivi_personalizzati', forma, materiale, file: f, savedAt: Date.now() }).catch(() => {});
	}
	function setW(v: number) {
		w = Math.min(MAX_MM, Math.max(MIN_MM, Math.round(v || MIN_MM)));
		if (ratio) h = Math.min(MAX_MM, Math.max(MIN_MM, Math.round(w / ratio)));
	}
	function setH(v: number) {
		h = Math.min(MAX_MM, Math.max(MIN_MM, Math.round(v || MIN_MM)));
		if (ratio) w = Math.min(MAX_MM, Math.max(MIN_MM, Math.round(h * ratio)));
	}
	function choose(setter: () => void, next: number) {
		setter();
		setTimeout(() => (step = next), 220);
	}
	function addCart() {
		addToCart({ product: 'adesivi_personalizzati', forma, materiale, w, h, qty, gross: q.gross, fileName: file?.name ?? null, note });
		added = true;
		setTimeout(() => (added = false), 4000);
	}
</script>

<section class="cfg" id="configura">
	<!-- ANTEPRIMA -->
	<div class="cfg__preview">
		<div class="cfg__head">
			<div>
				<p class="eyebrow">Anteprima live</p>
				<h2 class="cfg__title">La tua prova di stampa</h2>
			</div>
			<span class="live-pill"><i></i> Si aggiorna in tempo reale</span>
		</div>
		<div class="cfg__stage">
			{#if file}
				<EnginePreview {file} {forma} {materiale} {w} {h} onrender={(s) => (snapshot = s)} />
				{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
			{:else}
				<div class="cfg__placeholder">
					<strong>IL TUO<br />DESIGN</strong><small>qui</small>
				</div>
			{/if}
			<span class="dim-label">{w} × {h} mm</span>
		</div>
		<div class="cfg__upload">
			<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
			<button class="btn btn--blue" type="button" onclick={() => fileInput?.click()}>{file ? 'Cambia file' : 'Carica il tuo file'}</button>
			<div class="cfg__upload-copy">
				<strong>{file ? file.name : 'PNG, JPG, PDF o SVG'}</strong>
				<span>{file ? 'Anteprima caricata correttamente' : 'Fino a 50 MB · Controllo file gratuito'}</span>
			</div>
		</div>
		<p class="cfg__note">ⓘ Il bordo tratteggiato simula la linea di taglio. Prima di stampare controlleremo il file.</p>
	</div>

	<!-- CONFIGURAZIONE -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div>
				<p class="eyebrow">Configura in 1 minuto</p>
				<h2 class="cfg__title">Crea i tuoi adesivi</h2>
			</div>
			<span class="cfg__stepcount">Passaggio {step} di 4</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- 1 sagoma -->
		<div class="step" class:is-open={step === 1}>
			<button class="step__head" type="button" onclick={() => (step = 1)} aria-expanded={step === 1}>
				<span class="step__n">{#if step > 1}✓{:else}1{/if}</span>
				<span class="step__title">Scegli la sagoma {#if step !== 1}<em>{shape.label}</em>{/if}</span>
				<span class="step__edit">{step === 1 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 1}
				<div class="step__body">
					<div class="opt-grid opt-grid--3">
						{#each SHAPES as s (s.id)}
							<button type="button" class="opt" class:is-active={forma === s.id} onclick={() => choose(() => (forma = s.id), 2)}>
								<span class="opt__icon cfg-shape cfg-shape--{s.id}"></span>
								<span class="opt__text"><b>{s.label}</b><small>{s.mini}</small></span>
								{#if forma === s.id}<span class="opt__check">✓</span>{/if}
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
				<span class="step__title">Scegli il materiale {#if step !== 2}<em>{material.label}</em>{/if}</span>
				<span class="step__edit">{step === 2 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 2}
				<div class="step__body">
					<p class="step__hint">Non sai quale scegliere? Il vinile bianco va bene quasi sempre.</p>
					<div class="opt-grid opt-grid--2">
						{#each MATERIALS as m (m.id)}
							<button type="button" class="opt" class:is-active={materiale === m.id} onclick={() => choose(() => (materiale = m.id), 3)}>
								<span class="opt__swatch" style="background:{m.swatch}"></span>
								<span class="opt__text"><b>{m.label}</b><small>{m.description}</small></span>
								{#if m.tag}<span class="opt__tag">{m.tag}</span>{/if}
								{#if materiale === m.id}<span class="opt__check">✓</span>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- 3 misura -->
		<div class="step" class:is-open={step === 3}>
			<button class="step__head" type="button" onclick={() => (step = 3)} aria-expanded={step === 3}>
				<span class="step__n">{#if step > 3}✓{:else}3{/if}</span>
				<span class="step__title">Indica la misura {#if step !== 3}<em>{w} × {h} mm</em>{/if}</span>
				<span class="step__edit">{step === 3 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 3}
				<div class="step__body">
					{#if !file}<p class="step__hint step__hint--box">Carica il tuo file: rileveremo automaticamente la proporzione e ti consiglieremo la misura.</p>{/if}
					<div class="size-presets">
						{#each SIZE_PRESETS as [pw, ph] (pw)}
							<button type="button" class="size-btn" class:is-active={w === pw && h === ph} onclick={() => { ratio = null; w = pw; h = ph; }}>{pw} × {ph} mm</button>
						{/each}
					</div>
					{#if ratio}<p class="step__lock">🔗 Le proporzioni del file restano sempre bloccate.</p>{/if}
					<div class="size-inputs">
						<label><span>Larghezza</span><input type="number" min={MIN_MM} max={MAX_MM} value={w} onchange={(e) => setW(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
						<span class="size-x">×</span>
						<label><span>Altezza</span><input type="number" min={MIN_MM} max={MAX_MM} value={h} onchange={(e) => setH(+(e.currentTarget as HTMLInputElement).value)} /><em>mm</em></label>
					</div>
					<button class="step__continue" type="button" onclick={() => (step = 4)}>Continua alla quantità</button>
				</div>
			{/if}
		</div>

		<!-- 4 quantità -->
		<div class="step" class:is-open={step === 4}>
			<button class="step__head" type="button" onclick={() => (step = 4)} aria-expanded={step === 4}>
				<span class="step__n">{#if step > 4}✓{:else}4{/if}</span>
				<span class="step__title">Scegli la quantità {#if step !== 4}<em>{qty.toLocaleString('it-IT')} pezzi · {eur0(q.gross)}</em>{/if}</span>
				<span class="step__edit">{step === 4 ? '' : 'Modifica'}</span>
			</button>
			{#if step === 4}
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
			<span class="sum-coin">SP</span>
			<span><strong>Guadagni {eur2(q.credit)}</strong><small>di credito da usare sul prossimo ordine</small></span>
		</div>
		<div class="sum-price">
			<small>Totale</small>
			<div><strong>{eur0(vatIncluded ? q.gross : q.net)}</strong><span class="sum-per">{q.perPiece.toFixed(2).replace('.', ',')} €/pz</span></div>
			<div class="vat-toggle">
				<span class:active={!vatIncluded}>IVA esclusa</span>
				<button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label="Mostra prezzi IVA inclusa" onclick={() => (vatIncluded = !vatIncluded)}><i></i></button>
				<span class:active={vatIncluded}>IVA inclusa</span>
			</div>
		</div>
		<button class="btn btn--green btn--cart" type="button" onclick={addCart}>{added ? 'Aggiunto ✓' : 'Aggiungi al carrello →'}</button>
	</div>
</section>
