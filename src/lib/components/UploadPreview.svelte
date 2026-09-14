<script lang="ts">
	/**
	 * Anteprima automatica in home.
	 *  - Adesivi personalizzati: usa il motore "preprint" (static/preprint/index.html)
	 *    incorporato in un iframe; sagoma e materiale scelti qui vengono passati al motore.
	 *  - Adesivi resinati ed etichette in fogli: stesso motore (le etichette con foglio=1, che mostra il foglio intero).
	 * "Continua la configurazione" salva file e scelte nel browser e porta alla pagina prodotto.
	 */
	import { goto } from '$app/navigation';
	import { saveDraft } from '$lib/utils/draftStore';

	type Product = 'personalizzati' | 'resinati' | 'fogli';

	const PRODUCTS: { id: Product; label: string; href: string; hint: string; img: string }[] = [
		{ id: 'personalizzati', label: 'Adesivi personalizzati', href: '/adesivi-personalizzati', hint: 'Sagoma libera, tagliati uno a uno', img: '/images/prodotti/adesivi-personalizzati/1.webp' },
		{ id: 'resinati', label: 'Adesivi resinati', href: '/adesivi-resinati', hint: 'Cupola in resina, effetto 3D', img: '/images/prodotti/resinati/1.webp' },
		{ id: 'fogli', label: 'Etichette in fogli', href: '/etichette', hint: 'Tante etichette su un foglio', img: '/images/prodotti/etichette/1.webp' }
	];
	/* icone delle sagome: cambiano con il prodotto (adesivi, resinati, etichette) */
	const SHAPE_IMG: Record<Product, Record<string, string>> = {
		personalizzati: { sagomato: '/images/estimator/custom_stickers.webp', tondo: '/images/estimator/round_stickers.webp', quadrato: '/images/estimator/square_stickers.webp', ovale: '/images/estimator/oval_stickers.webp', rettangolare: '/images/estimator/rect_stickers.webp' },
		resinati: { sagomato: '/images/estimator/res/custom_res.webp', tondo: '/images/estimator/res/round_res.webp', quadrato: '/images/estimator/res/round_res.webp', ovale: '/images/estimator/res/oval_res.webp', rettangolare: '/images/estimator/res/rect_res.webp' },
		fogli: { sagomato: '/images/estimator/label/custom_labels.webp', tondo: '/images/estimator/label/round_label.webp', quadrato: '/images/estimator/label/square_labels.webp', ovale: '/images/estimator/label/oval_labels.webp', rettangolare: '/images/estimator/label/rect_label.webp' }
	};
	const shapeImg = (id: string) => SHAPE_IMG[product][id] ?? SHAPE_IMG.personalizzati[id];

	const FORME = [
		{ id: 'sagomato', label: 'Sagomato' },
		{ id: 'tondo', label: 'Rotondo' },
		{ id: 'quadrato', label: 'Quadrato' },
		{ id: 'rettangolare', label: 'Rettangolare' },
		{ id: 'ovale', label: 'Ovale' }
	];
	const MATERIALI = [
		{ id: 'bianco', label: 'Bianco', img: '/images/estimator/white.webp' },
		{ id: 'olografico', label: 'Olografico', img: '/images/estimator/olo.webp' },
		{ id: 'glitterato', label: 'Glitterato', img: '/images/estimator/glitter.webp' },
		{ id: 'trasparente', label: 'Trasparente', img: '/images/estimator/transparent.webp' },
		{ id: 'oro', label: 'Oro', img: '/images/estimator/gold.webp' },
		{ id: 'argento', label: 'Argento', img: '/images/estimator/silver.webp' }
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
	const usesEngine = true;
	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];

	function pick(f: File | undefined) {
		error = '';
		if (!f) return;
		if (!ACCEPT.includes(f.type)) {
			error = 'Formati accettati: PNG, JPG, SVG, PDF.';
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
		snapshot = null;
		sentFor = null;
		const q = new URLSearchParams({ embed: '1', forma, materiale, prodotto: product === 'resinati' ? 'resinati' : 'sticker' });
		if (product === 'fogli') q.set('foglio', '1');
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
		if (file) loadEngine();
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
			await goto(`${current.href}${q}#configura`);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onmessage={onMessage} />

<div class="up">
	<!-- sinistra: le scelte, in ordine -->
	<div class="up__choices">
		<div class="up__step">
			<div class="up__head"><span class="up__n">1</span><b>Cosa vuoi stampare?</b></div>
			<div class="up__tiles" role="radiogroup" aria-label="Prodotto">
				{#each PRODUCTS as p (p.id)}
					<button type="button" class="up__tile" class:is-on={product === p.id} role="radio" aria-checked={product === p.id} onclick={() => setProduct(p.id)}>
						<img src={p.img} alt="" loading="lazy" /><b>{p.label}</b><small>{p.hint}</small>
					</button>
				{/each}
			</div>
		</div>
		<div class="up__step">
			<div class="up__head"><span class="up__n">2</span><b>Che sagoma?</b><span class="up__pick">{FORME.find((f) => f.id === forma)?.label}</span></div>
			<div class="up__shapes" role="radiogroup" aria-label="Sagoma">
				{#each FORME as f (f.id)}
					<button type="button" class="up__shape" class:is-on={forma === f.id} role="radio" aria-checked={forma === f.id} title={f.label} onclick={() => setForma(f.id)}><img src={shapeImg(f.id)} alt="" loading="lazy" /><span>{f.label}</span></button>
				{/each}
			</div>
		</div>
		<div class="up__step">
			<div class="up__head"><span class="up__n">3</span><b>Che materiale?</b><span class="up__pick">{MATERIALI.find((m) => m.id === materiale)?.label}</span></div>
			<div class="up__mats" role="radiogroup" aria-label="Materiale">
				{#each MATERIALI as m (m.id)}
					<button type="button" class="up__mat" class:is-on={materiale === m.id} role="radio" aria-checked={materiale === m.id} title={m.label} onclick={() => setMateriale(m.id)}><img src={m.img} alt="" loading="lazy" /><span>{m.label}</span></button>
				{/each}
			</div>
		</div>
	</div>

	<!-- destra: il file e l'anteprima viva -->
	<div class="up__file">
		<div class="up__head"><span class="up__n">4</span><b>Il tuo file</b>{#if file}<button type="button" class="link-btn" onclick={reset}>Cambia file</button>{/if}</div>
		{#if !file}
			<label
				class="dropzone up__dz"
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
					<div class="up__dz-hint">In pochi secondi vedi sagoma, linea di taglio e materiale scelti</div>
					{#if error}<p class="error" style="margin-top:14px">{error}</p>{/if}
				</div>
			</label>
		{:else}
			<div class="stage up__stage">
				<iframe bind:this={frame} class="engine engine--live" class:is-ready={!!snapshot} src={engineSrc} title={product === 'fogli' ? 'Anteprima del tuo foglio di etichette' : 'Anteprima del tuo adesivo'} tabindex="-1" onload={() => sendFile()}></iframe>
				{#if engineBusy}<div class="stage__busy"><span class="spinner spinner--dark"></span> Genero l’anteprima…</div>{/if}
			</div>
		{/if}
		<button class="btn btn--blue btn--xl up__cta" type="button" disabled={!file || saving || (usesEngine && engineBusy)} onclick={continua}>
			{saving ? 'Un attimo…' : file ? 'Continua la configurazione →' : 'Carica il file per continuare'}
		</button>
		<p class="up__note">Anteprima gratuita e senza impegno. Prima della stampa un umano controlla il file.</p>
	</div>
</div>
