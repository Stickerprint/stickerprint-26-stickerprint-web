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
	import { usaLingua } from '$lib/traduzioni';

	const { t, path } = usaLingua();
	type Product = 'personalizzati' | 'resinati' | 'fogli';

	/* testi di prodotti, sagome e materiali nel catalogo `configuratore` (anteprima.prodotti.* e opzioni.*) */
	const PRODUCTS: { id: Product; label: string; href: string; hint: string; img: string }[] = [
		{ id: 'personalizzati', label: t('configuratore.anteprima.prodotti.personalizzati.label'), href: '/adesivi-personalizzati', hint: t('configuratore.anteprima.prodotti.personalizzati.hint'), img: '/images/prodotti/adesivi-personalizzati/1.webp' },
		{ id: 'resinati', label: t('configuratore.anteprima.prodotti.resinati.label'), href: '/adesivi-resinati', hint: t('configuratore.anteprima.prodotti.resinati.hint'), img: '/images/prodotti/resinati/1.webp' },
		{ id: 'fogli', label: t('configuratore.anteprima.prodotti.fogli.label'), href: '/etichette', hint: t('configuratore.anteprima.prodotti.fogli.hint'), img: '/images/prodotti/etichette/1.webp' }
	];
	/* icone delle sagome: cambiano con il prodotto (adesivi, resinati, etichette) */
	const SHAPE_IMG: Record<Product, Record<string, string>> = {
		personalizzati: { sagomato: '/images/estimator/custom_stickers.webp', tondo: '/images/estimator/round_stickers.webp', quadrato: '/images/estimator/square_stickers.webp', ovale: '/images/estimator/oval_stickers.webp', rettangolare: '/images/estimator/rect_stickers.webp' },
		resinati: { sagomato: '/images/estimator/res/custom_res.webp', tondo: '/images/estimator/res/round_res.webp', quadrato: '/images/estimator/res/square_res.webp', ovale: '/images/estimator/res/oval_res.webp', rettangolare: '/images/estimator/res/rect_res.webp' },
		fogli: { sagomato: '/images/estimator/label/custom_labels.webp', tondo: '/images/estimator/label/round_label.webp', quadrato: '/images/estimator/label/square_labels.webp', ovale: '/images/estimator/label/oval_labels.webp', rettangolare: '/images/estimator/label/rect_label.webp' }
	};
	const shapeImg = (id: string) => SHAPE_IMG[product][id] ?? SHAPE_IMG.personalizzati[id];

	const FORME = ['sagomato', 'tondo', 'quadrato', 'rettangolare', 'ovale'].map((id) => ({ id, label: t(`configuratore.opzioni.sagome.${id}.label`) }));
	const MATERIALI = [
		{ id: 'bianco', img: '/images/estimator/white.webp' },
		{ id: 'olografico', img: '/images/estimator/olo.webp' },
		{ id: 'glitterato', img: '/images/estimator/glitter.webp' },
		{ id: 'trasparente', img: '/images/estimator/transparent.webp' },
		{ id: 'oro', img: '/images/estimator/gold.webp' },
		{ id: 'argento', img: '/images/estimator/silver.webp' }
	].map((m) => ({ ...m, label: t(`configuratore.opzioni.materiali.${m.id}.label`) }));

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
		if (!ACCEPT.includes(f.type)) { error = t('configuratore.anteprima.formati'); return; }
		if (f.size > 25 * 1024 * 1024) { error = t('configuratore.anteprima.troppoGrande'); return; }
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
			await goto(`${path(current.href)}${q}#configura`);
		} finally {
			saving = false;
		}
	}
</script>

<!-- Stessa impostazione del preventivatore: a sinistra il file e l'anteprima, a destra le scelte e il bottone -->
<div class="hp" bind:this={root}>
	<div class="hp__file">
		{#if !file}
			<label
				class="hp__drop"
				class:is-over={over}
				ondragenter={(e) => { e.preventDefault(); over = true; }}
				ondragover={(e) => { e.preventDefault(); over = true; }}
				ondragleave={() => (over = false)}
				ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}
			>
				<input type="file" accept={ACCEPT.join(',')} onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
				<span class="hp__dropico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></span>
				<b>{t('configuratore.file.trascina')}</b>
				<span class="hp__drops">{t('configuratore.file.oppure')}</span>
				{#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}
			</label>
		{/if}
		{#if warm}
			<!-- il motore e' gia' qui (invisibile) mentre il cliente sceglie il file: quando il file arriva parte subito -->
			<div class="stage up__stage hp__stage" class:is-warm={!file} aria-hidden={!file}>
				<EnginePreview {file} {forma} {materiale} prodotto={product === 'resinati' ? 'resinati' : 'sticker'} foglio={product === 'fogli'} live warm nuovo bind:busy={engineBusy} onrender={onRender} />
				{#if file}<button type="button" class="hp__cambia" onclick={reset}>{t('configuratore.file.cambia')}</button>{/if}
			</div>
		{/if}
	</div>

	<div class="hp__panel">
		<div class="hp__grp">
			<div class="hp__h"><span class="hp__n">1</span><span class="hp__t">{t('configuratore.anteprima.cosaStampare')}</span><span class="hp__v hp__v--largo">{current.label}</span></div>
			<div class="hp__tiles hp__tiles--3" role="radiogroup" aria-label={t('configuratore.anteprima.prodotto')}>
				{#each PRODUCTS as p (p.id)}
					<button type="button" class="hp__tile hp__tile--foto" class:is-on={product === p.id} role="radio" aria-checked={product === p.id} onclick={() => setProduct(p.id)}>
						<img src={p.img} alt="" loading="lazy" /><b>{p.label}</b>
					</button>
				{/each}
			</div>
		</div>
		<div class="hp__grp">
			<div class="hp__h"><span class="hp__n">2</span><span class="hp__t">{t('configuratore.anteprima.cheSagoma')}</span><span class="hp__v">{FORME.find((f) => f.id === forma)?.label}</span></div>
			<div class="hp__tiles" role="radiogroup" aria-label={t('configuratore.anteprima.sagoma')}>
				{#each FORME as f (f.id)}
					<button type="button" class="hp__tile" class:is-on={forma === f.id} role="radio" aria-checked={forma === f.id} onclick={() => setForma(f.id)}><img src={shapeImg(f.id)} alt="" loading="lazy" /><b>{f.label}</b></button>
				{/each}
			</div>
		</div>
		<div class="hp__grp">
			<div class="hp__h"><span class="hp__n">3</span><span class="hp__t">{t('configuratore.anteprima.cheMateriale')}</span><span class="hp__v">{MATERIALI.find((m) => m.id === materiale)?.label}</span></div>
			<div class="hp__tiles" role="radiogroup" aria-label={t('configuratore.anteprima.materiale')}>
				{#each materiali as m (m.id)}
					<button type="button" class="hp__tile" class:is-on={materiale === m.id} role="radio" aria-checked={materiale === m.id} onclick={() => setMateriale(m.id)}><img src={m.img} alt="" loading="lazy" /><b>{m.label}</b></button>
				{/each}
			</div>
		</div>
		<button class="hp__cta" type="button" disabled={!file || saving || engineBusy || !snapshot} onclick={continua}>
			{saving ? t('configuratore.anteprima.attimo') : file ? t('configuratore.anteprima.continua') : t('configuratore.anteprima.caricaContinua')}
		</button>
		<p class="hp__note">{t('configuratore.anteprima.nota')}</p>
	</div>
</div>

<style>
	.hp { display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr); gap: 44px; align-items: stretch; margin-top: 30px; text-align: left; }
	.hp__file { position: relative; min-width: 0; min-height: 420px; }
	.hp__drop { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; border: 2px dashed var(--blue); border-radius: 26px; background: #fff; cursor: pointer; padding: 16px; transition: background .15s; }
	.hp__drop:hover, .hp__drop.is-over { background: var(--sky); }
	.hp__drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
	.hp__dropico { width: 64px; height: 64px; border-radius: 18px; background: var(--sky); color: var(--blue); display: grid; place-items: center; margin-bottom: 12px; }
	.hp__drop:hover .hp__dropico, .hp__drop.is-over .hp__dropico { background: #fff; }
	.hp__drop b { font-family: var(--font-display); font-weight: 800; font-size: 22px; letter-spacing: -.02em; line-height: 1.15; }
	.hp__drops { font-size: 14px; color: var(--ink-soft); }
	.hp__stage { height: 100%; min-height: 420px; border-radius: 22px; background: #eef0f6; overflow: hidden; }
	.hp__stage.is-warm { position: absolute; inset: 0; visibility: hidden; pointer-events: none; }
	.hp__cambia { position: absolute; right: 12px; top: 12px; z-index: 3; border: 1px solid var(--blue); background: #fff; color: var(--blue-text); border-radius: 999px; padding: 7px 12px; font: inherit; font-weight: 700; font-size: 12.5px; cursor: pointer; box-shadow: 0 1px 3px rgba(5, 5, 56, .12); }

	.hp__panel { min-width: 0; display: grid; gap: 22px; align-content: start; }
	.hp__h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
	.hp__n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--navy); color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 13px; display: grid; place-items: center; transform: translateY(3px); }
	.hp__t { font-family: var(--font-display); font-weight: 800; font-size: 19px; letter-spacing: -.02em; }
	.hp__v { font-size: 14px; color: var(--muted); font-weight: 500; margin-left: auto; text-align: right; }
	.hp__tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }
	.hp__tiles--3 { grid-template-columns: repeat(3, 1fr); }
	.hp__tile { border: 2px solid var(--line); background: #fff; border-radius: 14px; padding: 8px 6px 9px; display: grid; justify-items: center; align-content: start; gap: 4px; text-align: center; font: inherit; color: var(--ink); cursor: pointer; transition: border-color .12s, background .12s; }
	.hp__tile:hover { border-color: #c5c8dc; }
	.hp__tile.is-on { border-color: var(--blue); background: var(--sky); }
	.hp__tile img { width: 54px; height: 54px; object-fit: contain; }
	.hp__tile b { font-size: 13px; line-height: 1.2; }
	.hp__tile--foto { grid-template-columns: 54px 1fr; justify-items: start; align-items: center; text-align: left; gap: 10px; padding: 8px 10px 8px 8px; }
	.hp__tile--foto img { object-fit: cover; border-radius: 10px; }
	.hp__cta { width: 100%; border: 0; border-radius: 12px; background: #0e8bff; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 16px; text-transform: uppercase; letter-spacing: -.01em; padding: 17px 26px; box-shadow: 0 4px 0 #0768c4; text-shadow: 0 1px 2px rgba(0, 45, 110, .45); cursor: pointer; transition: transform .1s, filter .1s; }
	.hp__cta:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); }
	.hp__cta:disabled { opacity: .45; cursor: not-allowed; }
	.hp__note { font-size: 12.5px; color: var(--muted); text-align: center; margin: -10px 0 0; }

	@media (max-width: 900px) {
		.hp { grid-template-columns: 1fr; gap: 20px; margin-top: 20px; }
		.hp__file { min-height: 230px; }
		.hp__file:has(.hp__stage:not(.is-warm)) { min-height: 300px; }
		.hp__stage { min-height: 300px; }
		.hp__drop { border-radius: 18px; }
		.hp__dropico { width: 48px; height: 48px; border-radius: 14px; margin-bottom: 8px; }
		.hp__drop b { font-size: 19px; }
		.hp__drops { font-size: 13px; }
		.hp__panel { gap: 18px; }
		.hp__t { font-size: 17px; }
		.hp__v--largo { display: none; }   /* su telefono il prodotto scelto si vede gia' nella lista sotto */
		.hp__tiles:not(.hp__tiles--3) { display: flex; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 4px; scroll-snap-type: x proximity; scrollbar-width: none; }
		.hp__tiles:not(.hp__tiles--3)::-webkit-scrollbar { display: none; }
		.hp__tiles:not(.hp__tiles--3) .hp__tile { flex: none; width: 92px; scroll-snap-align: start; }
		.hp__tiles--3 { grid-template-columns: 1fr; }
	}
</style>
