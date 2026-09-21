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
	import EnginePreview from '$lib/components/EnginePreview.svelte';

	type Product = 'personalizzati' | 'resinati' | 'fogli';

	const PRODUCTS: { id: Product; label: string; href: string; hint: string; img: string }[] = [
		{ id: 'personalizzati', label: 'Adesivi personalizzati', href: '/adesivi-personalizzati', hint: 'Sagoma libera, tagliati uno a uno', img: '/images/prodotti/adesivi-personalizzati/1.webp' },
		{ id: 'resinati', label: 'Adesivi resinati', href: '/adesivi-resinati', hint: 'Cupola in resina, effetto 3D', img: '/images/prodotti/resinati/1.webp' },
		{ id: 'fogli', label: 'Etichette in fogli', href: '/etichette', hint: 'Tante etichette su un foglio', img: '/images/prodotti/etichette/1.webp' }
	];
	/* icone delle sagome: cambiano con il prodotto (adesivi, resinati, etichette) */
	const SHAPE_IMG: Record<Product, Record<string, string>> = {
		personalizzati: { sagomato: '/images/estimator/custom_stickers.webp', tondo: '/images/estimator/round_stickers.webp', quadrato: '/images/estimator/square_stickers.webp', ovale: '/images/estimator/oval_stickers.webp', rettangolare: '/images/estimator/rect_stickers.webp' },
		resinati: { sagomato: '/images/estimator/res/custom_res.webp', tondo: '/images/estimator/res/round_res.webp', quadrato: '/images/estimator/res/square_res.webp', ovale: '/images/estimator/res/oval_res.webp', rettangolare: '/images/estimator/res/rect_res.webp' },
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

	/* resinati: solo i materiali dei resinati (niente olografico ne' glitterato; il supertack resta nella pagina prodotto) */
	const MAT_RESINATI = ['bianco', 'trasparente', 'oro', 'argento'];

	let file = $state<File | null>(null);
	let over = $state(false);
	let widthMm = $state(80);
	let heightMm = $state(0);
	let error = $state('');
	let product = $state<Product>('personalizzati');
	let forma = $state('sagomato');
	let materiale = $state('bianco');

	/* motore preprint: lo stesso componente delle pagine prodotto (EnginePreview).
	   - warm: il motore si carica appena questa sezione si avvicina allo schermo, PRIMA che il cliente scelga il file;
	   - live: prodotto, sagoma e materiale cambiano con un messaggio al motore gia' caricato.
	   Prima ogni clic ricaricava il motore (360 KB) e rianalizzava il file da capo: 3-4 secondi a cambio su telefono,
	   e cliccando in fretta l'anteprima poteva restare ferma su "Genero l'anteprima". */
	let engineBusy = $state(false);
	let snapshot = $state<{ png: string | null; w: number; h: number } | null>(null);
	let saving = $state(false);
	let warm = $state(false);
	let root = $state<HTMLDivElement | undefined>();
	$effect(() => {
		const el = root;
		if (!el || warm) return;
		if (typeof IntersectionObserver === 'undefined') { warm = true; return; }
		const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { warm = true; io.disconnect(); } }, { rootMargin: '900px 0px' });
		io.observe(el);
		return () => io.disconnect();
	});

	const current = $derived(PRODUCTS.find((p) => p.id === product)!);
	const materiali = $derived(product === 'resinati' ? MATERIALI.filter((m) => MAT_RESINATI.includes(m.id)) : MATERIALI);
	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];

	function pick(f: File | undefined) {
		error = '';
		if (!f) return;
		if (!ACCEPT.includes(f.type)) { error = 'Formati accettati: PNG, JPG, SVG, PDF.'; return; }
		if (f.size > 25 * 1024 * 1024) { error = 'Il file supera i 25 MB.'; return; }
		warm = true;
		snapshot = null;
		file = f;
	}
	function reset() { file = null; snapshot = null; }
	function onRender(r: { png: string | null; w: number; h: number }) {
		snapshot = { png: r.png, w: r.w ?? 0, h: r.h ?? 0 };
		if (r.w) { widthMm = r.w; heightMm = r.h; }
	}
	// sagoma, materiale e prodotto: basta cambiare il valore, il componente lo dice al motore gia' caricato
	function setForma(id: string) { forma = id; }
	function setMateriale(id: string) { materiale = id; }
	function setProduct(id: Product) {
		product = id;
		if (id === 'resinati' && !MAT_RESINATI.includes(materiale)) materiale = 'bianco';
	}

	async function continua() {
		if (!file) return;
		saving = true;
		try {
			await saveDraft({
				product: product === 'personalizzati' ? 'adesivi_personalizzati' : product === 'resinati' ? 'adesivi_resinati' : 'etichette',
				forma,
				materiale,
				file,
				preview: snapshot?.png ?? null,
				widthMm,
				heightMm,
				savedAt: Date.now()
			});
			const q = `?forma=${forma}&materiale=${materiale}`;
			await goto(`${current.href}${q}#configura`);
		} finally {
			saving = false;
		}
	}
</script>

<div class="up" bind:this={root}>
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
			<div class="up__mats" data-n={materiali.length} role="radiogroup" aria-label="Materiale">
				{#each materiali as m (m.id)}
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
		{/if}
		{#if warm}
			<!-- il motore e' gia' qui (invisibile) mentre il cliente sceglie il file: quando il file arriva parte subito -->
			<div class="stage up__stage" class:is-warm={!file} aria-hidden={!file}>
				<EnginePreview {file} {forma} {materiale} prodotto={product === 'resinati' ? 'resinati' : 'sticker'} foglio={product === 'fogli'} live warm bind:busy={engineBusy} onrender={onRender} />
			</div>
		{/if}
		<button class="btn btn--blue btn--xl up__cta" type="button" disabled={!file || saving || engineBusy || !snapshot} onclick={continua}>
			{saving ? 'Un attimo…' : file ? 'Continua la configurazione →' : 'Carica il file per continuare'}
		</button>
		<p class="up__note">Anteprima gratuita e senza impegno. Prima della stampa un umano controlla il file.</p>
	</div>
</div>
