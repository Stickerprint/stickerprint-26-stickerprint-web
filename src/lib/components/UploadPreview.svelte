<script lang="ts">
	/**
	 * Anteprima automatica in home.
	 *  - Adesivi personalizzati: usa il motore "preprint" (static/preprint/index.html)
	 *    incorporato in un iframe; sagoma e materiale scelti qui vengono passati al motore.
	 *  - Adesivi resinati / etichette in fogli: anteprima CSS semplificata (per ora).
	 * "Continua la configurazione" salva file e scelte nel browser e porta alla pagina prodotto.
	 */
	import { goto } from '$app/navigation';
	import { saveDraft } from '$lib/utils/draftStore';

	type Product = 'personalizzati' | 'resinati' | 'fogli';

	const PRODUCTS: { id: Product; label: string; href: string; hint: string }[] = [
		{ id: 'personalizzati', label: 'Adesivi personalizzati', href: '/adesivi-personalizzati', hint: 'Sagoma e linea di taglio calcolate dal tuo file' },
		{ id: 'resinati', label: 'Adesivi resinati', href: '/adesivi-resinati', hint: 'Cupola in resina lucida, effetto 3D' },
		{ id: 'fogli', label: 'Etichette in fogli', href: '/etichette', hint: 'Etichette angoli arrotondati, in fogli A4' }
	];

	const FORME = [
		{ id: 'sagomato', label: 'Sagomato' },
		{ id: 'tondo', label: 'Rotondo' },
		{ id: 'quadrato', label: 'Quadrato' },
		{ id: 'rettangolare', label: 'Rettangolare' },
		{ id: 'ovale', label: 'Ovale' }
	];
	const MATERIALI = [
		{ id: 'bianco', label: 'Bianco', swatch: '#fff' },
		{ id: 'olografico', label: 'Olografico', swatch: 'conic-gradient(from 210deg,#ff8ad6,#ffe37a,#8ef7c8,#8ad4ff,#c9a6ff,#ff8ad6)' },
		{ id: 'glitterato', label: 'Glitterato', swatch: 'radial-gradient(circle at 30% 30%,#fff,#cfd6de)' },
		{ id: 'trasparente', label: 'Trasparente', swatch: 'repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/8px 8px' },
		{ id: 'oro', label: 'Oro', swatch: 'linear-gradient(135deg,#f6df8c,#b9862a,#fff0b8,#8a5f16)' },
		{ id: 'argento', label: 'Argento', swatch: 'linear-gradient(135deg,#eef2f6,#9aa3ad,#fff,#8d949d)' }
	];

	let file = $state<File | null>(null);
	let url = $state<string | null>(null);
	let over = $state(false);
	let widthMm = $state(80);
	let heightMm = $state(0);
	let error = $state('');
	let product: Product = $state('personalizzati');
	let forma = $state('sagomato');
	let materiale = $state('bianco');

	// motore preprint
	let frame = $state<HTMLIFrameElement | undefined>();
	let engineReady = $state(false);
	let engineBusy = $state(false);
	let engineSrc = $state('');
	let snapshot = $state<{ png: string | null; w: number; h: number } | null>(null);
	let saving = $state(false);

	const current = $derived(PRODUCTS.find((p) => p.id === product)!);
	const usesEngine = $derived(product === 'personalizzati' || product === 'resinati');
	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];

	function pick(f: File | undefined) {
		error = '';
		if (!f) return;
		if (!ACCEPT.includes(f.type)) {
			error = 'Formati accettati: PNG, JPG, SVG, PDF.';
			return;
		}
		if (f.type === 'application/pdf' && !usesEngine) {
			error = 'Per le etichette in fogli usa PNG, JPG o SVG.';
			return;
		}
		if (f.size > 25 * 1024 * 1024) {
			error = 'Il file supera i 25 MB.';
			return;
		}
		if (url) URL.revokeObjectURL(url);
		file = f;
		url = URL.createObjectURL(f);
		snapshot = null;
		if (usesEngine) loadEngine();
	}

	function reset() {
		if (url) URL.revokeObjectURL(url);
		file = null;
		url = null;
		snapshot = null;
		engineSrc = '';
		engineReady = false;
	}

	/** (Ri)carica il motore con la combinazione scelta; il file viene inviato quando risponde "ready". */
	function loadEngine() {
		engineReady = false;
		engineBusy = true;
		sentFor = null;
		const q = new URLSearchParams({ embed: '1', forma, materiale, prodotto: product === 'resinati' ? 'resinati' : 'sticker' });
		engineSrc = `/preprint/index.html?${q.toString()}`;
	}

	let sentFor: File | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	/** Invia il file al motore (una volta per file caricato; riprova se non arriva l'anteprima). */
	function sendFile(force = false) {
		if (!file || !frame?.contentWindow) return;
		if (sentFor === file && !force) return;
		sentFor = file;
		frame.contentWindow.postMessage({ source: 'sito', type: 'file', file }, location.origin);
		clearTimeout(retryTimer);
		retryTimer = setTimeout(() => {
			if (engineBusy && sentFor === file) sendFile(true);
		}, 5000);
	}

	function onMessage(e: MessageEvent) {
		if (e.origin !== location.origin) return;
		const d = e.data ?? {};
		if (d.source !== 'preprint') return;
		if (d.type === 'ready') {
			engineReady = true;
			sendFile();
		}
		if (d.type === 'render' && d.detail?.png) {
			engineBusy = false;
			clearTimeout(retryTimer);
			snapshot = { png: d.detail.png, w: d.detail.w ?? 0, h: d.detail.h ?? 0 };
			if (d.detail.w) {
				widthMm = d.detail.w;
				heightMm = d.detail.h;
			}
		}
	}

	// cambiando sagoma o materiale il motore viene ricaricato con la nuova combinazione
	function setForma(id: string) {
		forma = id;
		if (file && usesEngine) loadEngine();
	}
	function setMateriale(id: string) {
		materiale = id;
		if (file && usesEngine) loadEngine();
	}
	function setProduct(id: Product) {
		product = id;
		snapshot = null;
		if (file && (id === 'personalizzati' || id === 'resinati')) loadEngine();
	}

	async function continua() {
		if (!file) return;
		saving = true;
		try {
			await saveDraft({
				product: product === 'personalizzati' ? 'adesivi_personalizzati' : product === 'resinati' ? 'adesivi_resinati' : 'etichette',
				forma: usesEngine ? forma : 'sagomato',
				materiale: usesEngine ? materiale : 'bianco',
				file,
				preview: snapshot?.png ?? null,
				widthMm,
				heightMm,
				savedAt: Date.now()
			});
			const q = usesEngine ? `?forma=${forma}&materiale=${materiale}` : '';
			await goto(`${current.href}${q}`);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onmessage={onMessage} />

<div class="cfg-col">
	<!-- Palco compatto: dropzone oppure anteprima generata -->
	{#if !file}
		<label
			class="dropzone dropzone--compact"
			class:is-over={over}
			ondragenter={(e) => { e.preventDefault(); over = true; }}
			ondragover={(e) => { e.preventDefault(); over = true; }}
			ondragleave={() => (over = false)}
			ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}
		>
			<input type="file" accept={ACCEPT.join(',')} onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
			<div>
				<div class="dropzone__icon">
					<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
				</div>
				<div class="dropzone__title">Trascina qui il tuo file</div>
				<div class="dropzone__sub">oppure clicca per sceglierlo · PNG, JPG, SVG, PDF</div>
				{#if error}<p class="error" style="margin-top:14px">{error}</p>{/if}
			</div>
		</label>
	{:else}
		<div class="stage" class:stage--sheet={product === 'fogli'}>
			{#if product === 'fogli'}
				<div class="sheet" aria-label="Anteprima etichette in foglio">
					{#each [1, 2, 3, 4] as i (i)}
						<img src={url} alt={i === 1 ? 'Anteprima della tua etichetta' : ''} />
					{/each}
				</div>
			{:else if snapshot?.png}
				<img class="stage__img" src={snapshot.png} alt="Anteprima del tuo adesivo" />
			{:else}
				<div class="stage__busy"><span class="spinner spinner--dark"></span> Genero l’anteprima…</div>
			{/if}
		</div>
	{/if}

	<div class="product-pills" role="radiogroup" aria-label="Prodotto">
		{#each PRODUCTS as p (p.id)}
			<button type="button" class="pill-btn" class:is-active={product === p.id} role="radio" aria-checked={product === p.id} onclick={() => setProduct(p.id)}>{p.label}</button>
		{/each}
	</div>

	{#if product !== 'fogli'}
		<div class="cfg-selects">
			<label class="cfg-select">
				<span class="cfg-select__label">Sagoma</span>
				<span class="cfg-select__box">
					<select value={forma} onchange={(e) => setForma((e.currentTarget as HTMLSelectElement).value)}>
						{#each FORME as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
					</select>
				</span>
			</label>
			<label class="cfg-select">
				<span class="cfg-select__label">Materiale</span>
				<span class="cfg-select__box">
					<select value={materiale} onchange={(e) => setMateriale((e.currentTarget as HTMLSelectElement).value)}>
						{#each MATERIALI as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
					</select>
				</span>
			</label>
		</div>
	{/if}

	<div class="cta-split">
		<button class="btn btn--blue btn--xl" type="button" disabled={!file || saving || (usesEngine && engineBusy)} onclick={continua}>
			{saving ? 'Un attimo…' : 'Continua la configurazione'}
		</button>
		{#if file}
			<button class="btn btn--ghost btn--xl" type="button" onclick={reset}>Cambia file</button>
		{/if}
	</div>
</div>

{#if file && usesEngine}
	<!-- Motore preprint: lavora nascosto e ci manda solo l'immagine finita -->
	<div class="engine-hidden" aria-hidden="true">
		<iframe bind:this={frame} class="engine" src={engineSrc} title="Generatore anteprima" tabindex="-1" onload={() => sendFile()}></iframe>
	</div>
{/if}
