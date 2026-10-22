<script lang="ts">
	import '$lib/styles/product.css';
	import { track, type ItemIn } from '$lib/tracking';
	import { klaviyo } from '$lib/klaviyo';
	import FreeShippingBar from './FreeShippingBar.svelte';
	import { readCart, cartGross as cartGrossOf, onCartChange } from '$lib/cart';
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
	import { quoteWith, minForShape, startSize, sizeProposals, proportionalSize, sizeRule, showFinishStep, showMaterialStep, type EngineConfig } from '$lib/pricing/engine';
	import { MM_PER_IN, mmToUnit, unitToMm, snapMm } from '$lib/i18n';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';

	/* totale prodotti gia' nel carrello (per la barra della spedizione gratuita) */
	let cartGross = $state(0);
	onMount(() => { cartGross = cartGrossOf(); return onCartChange(() => { cartGross = cartGrossOf(); }); });
	let {
		shipDate,
		cfg,
		product = 'adesivi_personalizzati',
		productName: productNameProp = '',
		engineProduct = 'sticker',
		test = false,
		start = null,
		promoOnly = false
	}: {
		shipDate: string; cfg: EngineConfig; product?: string; productName?: string; engineProduct?: 'sticker' | 'resinati'; test?: boolean;
		/** avvio diretto (pagina Offerte): file gia' scelto, sagoma/materiale e offerta con quantita', misura e prezzo bloccati */
		start?: { file: File; forma?: string; materiale?: string; finitura?: string | null; promo?: { id: string; price: number; qty: number; w: number; h: number } } | null;
		/** offerte: il cliente sceglie solo la sagoma; materiale, finitura, misura, quantita' e prezzo sono fissati dall'offerta */
		promoOnly?: boolean;
	} = $props();

	const { t, path, prezzo, prezzoUnit, numero, locale, unit, misure } = usaLingua();
	/* misure: il motore lavora in mm; sul sito USA si scrivono e si leggono pollici (vedi unitOf in i18n) */
	const inU = (mm: number) => (unit === 'in' ? Math.round(mmToUnit(mm, unit) * 100) / 100 : mm);
	const quartoPollice = (mm: number) => (Math.round((mm / MM_PER_IN) * 4) / 4) * MM_PER_IN;
	/* nome del prodotto nei titoli ("Crea i tuoi adesivi"): quello della pagina, altrimenti quello generico nella lingua */
	const productName = $derived(productNameProp || t('comune.prodottoGenerico'));
	/* etichette delle scelte del listino: il listino e' in italiano (dal database), il catalogo le traduce per id;
	   se la voce non c'e' nel catalogo resta quella del listino */
	const opz = (tipo: 'materiali' | 'sagome' | 'fogli' | 'finiture', id: string, campo: 'label' | 'description' | 'tag', fallback?: string) => {
		const k = `configuratore.opzioni.${tipo}.${id}.${campo}`;
		const v = t(k);
		return v === k ? (fallback ?? '') : v;
	};
	const tipoSagome = $derived(product === 'fogli_adesivi' ? 'fogli' : 'sagome');
	/* titolo e nota del passo finitura: il listino li scrive in italiano, qui si traducono i due testi noti */
	const finishTitle = $derived(cfg.finishTitle === 'Stampa' ? t('configuratore.passi.finituraStampa') : (cfg.finishTitle ?? t('configuratore.passi.finitura')));
	const finishNote = $derived(cfg.finishNote === "L'effetto rilievo è sempre lucido." ? t('configuratore.hint.rilievoLucido') : (cfg.finishNote ?? ''));
	const eur0 = (v: number) => prezzo(v, 0);
	const eur2 = (v: number) => prezzo(v, 2);

	const SHAPES = $derived(cfg.shapes.filter((s) => s.visible));
	const MATERIALS = $derived(cfg.materials.filter((m) => m.visible));
	const FINISHES = $derived(cfg.finishes.filter((f) => f.visible));
	const showFinish = $derived(showFinishStep(cfg));
	const showMaterials = $derived(showMaterialStep(cfg));
	const MAX_MM = $derived(cfg.size.maxMm);

	// passi visibili, numerati in ordine
	const steps = $derived(
		([['forma', true], ['materiale', showMaterials && !promoOnly], ['finitura', showFinish && !promoOnly], ['misura', !promoOnly], ['qty', !promoOnly]] as [string, boolean][])
			.filter(([, on]) => on)
			.map(([id]) => id)
	);
	const stepNo = (id: string) => steps.indexOf(id) + 1;

	let forma = $state(''); // la prima sagoma visibile del listino (resinati: tondo)
	// sul sagomato puo' valere un minimo piu' alto (resinati: 40 mm)
	const MIN_MM = $derived(sizeRule(cfg, forma).short);
	let materiale = $state('bianco');
	let finitura = $state(''); // la prima scelta e' senza lamina (vedi effetto sotto)
	// svelte-ignore state_referenced_locally
	let w = $state(cfg.size.defaultMm ?? 50);
	// svelte-ignore state_referenced_locally
	let h = $state(cfg.size.defaultMm ?? 50);
	let fileRatio = $state<number | null>(null);
	let cutRatio = $state<number | null>(null);
	let showCut = $state(true);
	let sizeKey = '';
	let sizeLocked = false;   // misura fissata dall'offerta: il file non la ricalcola
	let promo = $state<{ id: string; price: number; qty: number; w: number; h: number } | null>(null);
	// si parte sempre dalla quantita' piu' bassa: il prezzo d'ingresso non deve spaventare
	// svelte-ignore state_referenced_locally
	let qty = $state(cfg.quantities[0] ?? 15);
	let step = $state('forma');
	let vatIncluded = $state(true);
	let file = $state<File | null>(null);
	let fileUrl = $state<string | null>(null);
	let note = $state('');
	let added = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();
	let lastPng: string | null = null; // ultima anteprima generata dal motore (con tracciato di taglio)
	let engine = $state<{ post: (type: string, detail?: Record<string, unknown>) => void; studio: (what: 'stato', opts?: Record<string, unknown>) => Promise<{ stato?: Record<string, unknown> }> }>();
	let palette = $state<{ hex: string; img?: string }[]>([]);
	let palIdx = $state(0);
	let rimuovi = $state(false);
	let colInput = $state<HTMLInputElement | null>(null);
	// etichette in fogli: il motore mostra il foglio e dice quante etichette ci entrano
	const foglio = $derived(product === 'etichette');
	const rilievo = $derived(product === 'adesivi_rilievo');
	// vetrofanie: l'anteprima mostra la vetrofania dietro il vetro di una finestra, vista da fuori
	const vetro = $derived(product === 'vetrofanie');
	let perSheet = $state<{ n: number; cols: number; rows: number; w: number; h: number } | null>(null);
	let over = $state(false);
	let customOpen = $state(false);
	let customQty = $state<number | ''>('');
	let custom = $state(false);

	// valori iniziali coerenti con il listino (anche quando il listino cambia sotto, in dashboard)
	$effect(() => {
		if (!SHAPES.some((s) => s.id === forma)) forma = SHAPES[0]?.id ?? 'sagomato';
		if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco';
		/* la prima scelta e' SENZA lamina: il prezzo che il cliente vede all'inizio e' il piu' basso */
		if (!FINISHES.some((f) => f.id === finitura)) finitura = FINISHES.find((f) => !f.laminate)?.id ?? FINISHES[0]?.id ?? 'nessuna';
		if (!custom && !cfg.quantities.includes(qty)) qty = cfg.quantities[0];
		if (!steps.includes(step)) step = steps[0];
	});

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? cfg.materials[0]);
	const finish = $derived(FINISHES.find((f) => f.id === finitura));
	const fin = $derived(promoOnly ? finitura : showFinish ? finitura : 'nessuna');
	const ratio = $derived(shape?.equal ? 1 : (shape?.ratio ?? cutRatio ?? fileRatio ?? 1));
	// rettangolo e ovale: le misure sono solo proposte, il cliente puo' scrivere la sua (lati indipendenti)
	const freeSize = $derived(forma === 'rettangolare' || forma === 'ovale');
	const qListino = $derived(quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty, vatIncluded }));
	/* offerta: il prezzo promo vale finché quantità e misura restano quelle dell'offerta;
	   cambiandole si torna al listino (e il checkout ricontrolla comunque sul server) */
	const promoOk = $derived(!!promo && qty === promo.qty && Math.abs(w - promo.w) < 0.6 && Math.abs(h - promo.h) < 0.6);
	const q = $derived.by(() => {
		if (!promoOk || !promo) return qListino;
		const gross = promo.price, net = Math.round((gross / cfg.vat) * 100) / 100;
		const shown = vatIncluded ? gross : net;
		return { ...qListino, net, gross, perPiece: shown / qty, perPieceNet: net / qty, credit: net * cfg.creditRate };
	});
	const progress = $derived((stepNo(step) / steps.length) * 100);
	/* sul sito USA le proposte sono pollici tondi (1,5″ 2″ 2,5″ 3″ 4″ 5″) convertiti in mm: il listino segue quelle misure */
	const INCH_PRESETS = [1.5, 2, 2.5, 3, 4, 5].map((i) => i * MM_PER_IN);
	const shapePresets = $derived(unit === 'in' ? INCH_PRESETS : (shape?.presets?.length ? shape.presets : [30, 50, 70, 100]));
	/* la prima proposta e' sempre la misura minima della sagoma (lato corto al minimo, lato lungo in
	   proporzione al disegno), poi tre misure piu' grandi; le misure personalizzate si scrivono sotto */
	const presets = $derived.by(() => {
		const p = sizeProposals(cfg, forma, ratio, shapePresets, unit === 'in' ? quartoPollice : undefined);
		if (unit !== 'in') return p;
		/* la misura minima sale al quarto di pollice successivo, in proporzione */
		const [w0, h0] = p[0]; const k = Math.ceil((w0 / MM_PER_IN) * 4) / 4 * MM_PER_IN / w0;
		return [[snapMm(w0 * k, unit), snapMm(h0 * k, unit)] as [number, number], ...p.slice(1)];
	});
	// al cambio sagoma si riparte dalla misura minima (non nelle offerte, dove la misura e' fissa)
	let lastForma = '';
	$effect(() => {
		if (forma === lastForma) return;
		lastForma = forma;
		if (!sizeLocked) {
			const [pw, ph] = presets[0];
			w = pw;
			h = ph;
		}
	});
	const basePerPiece = $derived(quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: cfg.quantities[0], vatIncluded }).perPiece);

	onMount(async () => {
		if (test) return;
		// pagina Offerte: il file e l'offerta arrivano direttamente dalla pagina
		if (start?.file) {
			file = start.file;
			fileUrl = URL.createObjectURL(start.file);
			if (start.forma && SHAPES.some((s) => s.id === start.forma)) forma = start.forma;
			if (start.materiale && MATERIALS.some((m) => m.id === start.materiale)) materiale = start.materiale;
			if (start.finitura) finitura = start.finitura;
			if (start.promo) {
				promo = start.promo;
				qty = start.promo.qty; custom = !cfg.quantities.includes(start.promo.qty); customQty = custom ? start.promo.qty : '';
				w = clamp(start.promo.w); h = clamp(start.promo.h); sizeLocked = true;
			}
			return;
		}
		// entrando in una pagina prodotto si parte dalla drop zone; il file della home
		// si riprende solo quando si arriva da "Continua la configurazione" (#configura)
		if (location.hash !== '#configura') return;
		const d = await loadDraft();
		if (d && d.product === product) {
			file = d.file;
			fileUrl = URL.createObjectURL(d.file);
			if (SHAPES.some((s) => s.id === d.forma)) forma = d.forma;
			if (MATERIALS.some((m) => m.id === d.materiale)) materiale = d.materiale;
			// dalle offerte: quantità e misura decise dall'offerta
			if (d.qty && d.qty > 0) { qty = d.qty; custom = !cfg.quantities.includes(d.qty); customQty = custom ? d.qty : ''; }
			if (d.lockSize && d.widthMm) { w = clamp(d.widthMm); h = clamp(d.heightMm ?? d.widthMm); sizeLocked = true; }
			if (d.promo) promo = d.promo;
			// arrivando dalla home con il file gia' caricato si atterra direttamente sul preventivatore:
			// si ripete perche' le foto della pagina, caricandosi, spostano il blocco verso il basso
			if (location.hash === '#configura') for (const ms of [200, 900, 2000, 3500]) setTimeout(() => document.getElementById('configura')?.scrollIntoView({ behavior: ms > 500 ? 'auto' : 'smooth', block: 'start' }), ms);
		}
	});
	const minQty = $derived(cfg.quantities[0] ?? 15);
	/* barra mobile: −/+ scorre le fasce del listino; il prezzo porta al passo quantità */
	function stepQty(dir: number) {
		const list = cfg.quantities;
		if (!list.length) return;
		let i = list.findIndex((n) => n >= qty);
		if (i < 0) i = list.length - 1;
		if (dir > 0) i = list[i] === qty ? Math.min(list.length - 1, i + 1) : i;
		else i = Math.max(0, i - 1);
		custom = false; qty = list[i];
	}
	function goQty() { document.getElementById('qty-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
	function goFile() { document.getElementById('configura')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); fileInput?.click(); }
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
		if (sizeLocked) return;
		const r = shape?.equal ? 1 : (shape?.ratio ?? (s.h > 0 ? s.w / s.h : (fileRatio ?? 1)));
		cutRatio = r;
		// la misura dal file vale per il sagomato (segue la proporzione del disegno); sulle sagome
		// geometriche resta quella scelta dal cliente, cosi' il cambio sagoma non rifa' il disegno due volte
		/* si parte SEMPRE dalla misura minima della sagoma, anche se il file dichiara una misura
		   sua: il cliente vede prima il prezzo piu' basso e poi sale se vuole */
		const [w0, h0] = startSize(cfg, forma, r);
		w = w0; h = h0;
	}

	const clamp = (v: number) => Math.min(MAX_MM, Math.max(MIN_MM, snapMm(v || MIN_MM, unit)));
	function onImgLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth && img.naturalHeight) fileRatio = img.naturalWidth / img.naturalHeight;
	}
	/* articolo corrente per il tracciamento (stessa struttura del sito attuale) */
	const trackItem = (): ItemIn => ({ product, productName: productName.replace(/^(i tuoi|le tue) /, ''), forma, w, h, materiale, finitura: showFinish ? finitura : null, qty, gross: q.gross });
	let viewed = false;
	$effect(() => { if (!viewed && q.gross > 0) { viewed = true; setTimeout(() => track.viewItem(trackItem()), 500); } });
	const FILE_OK = /\.(pdf|svg|png|jpe?g|webp)$/i;
	function pick(f: File | undefined) {
		if (!f) return;
		if (!FILE_OK.test(f.name)) track.fileUpload(false, f, q.gross, { code: 'ERR_FILE_TYPE', message: 'Unsupported file type.' });
		else track.fileUpload(true, f, q.gross);
		if (fileUrl) URL.revokeObjectURL(fileUrl);
		file = f;
		fileUrl = URL.createObjectURL(f);
		saveDraft({ product, forma, materiale, file: f, savedAt: Date.now() }).catch(() => {});
	}
	/* rettangolo e ovale: lati liberi (ognuno fra minimo e massimo); le altre sagome restano in
	   proporzione col disegno e nessun lato scende mai sotto il minimo (vedi proportionalSize) */
	function setW(v: number) {
		if (freeSize) { w = clamp(v); return; }
		[w, h] = proportionalSize(cfg, forma, v, ratio);
	}
	function setH(v: number) {
		if (freeSize) { h = clamp(v); return; }
		[w, h] = proportionalSize(cfg, forma, v * ratio, ratio);
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
		/* regolazioni del motore (bordo, zoom, sfondo, tracciato): con l'ordine arrivano allo studio,
		   che rifa' ESATTAMENTE il pezzo approvato. Se il motore non risponde subito si va avanti senza. */
		let engineState: Record<string, unknown> | null = null;
		try {
			const r = await Promise.race([engine?.studio('stato'), new Promise<null>((ok) => setTimeout(() => ok(null), 2500))]);
			engineState = r?.stato ?? null;
		} catch { /* si ordina lo stesso */ }
		const it = addToCart({ engineState, product, productName: productName.replace(/^(i tuoi|le tue) /, ''), engineProduct, forma, materiale, finitura: showFinish ? finitura : undefined, w, h, qty, net: q.net, gross: q.gross, promoId: promoOk && promo ? promo.id : undefined, fileName: file.name, note });
		track.addToCart(trackItem());
		klaviyo.addedToCart({ productId: `${product}_${forma}`, productName: `${it.productName} ${forma}`, quantity: qty, dimension: `${w} x ${h} mm`, material: materiale, price: q.gross });
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
	const pezzi = (n: number) => t('configuratore.qty.pezzi', { n: numero(n) });
</script>

<section class="cfg" class:cfg--test={test} id="configura">
	{#if !test}
		<!-- ANTEPRIMA + BARRA COMANDI (sfondo · rimuovi sfondo · cambia file · tracciato) -->
		<div class="cfg__preview">
			{#if file}
				<EnginePreview bind:this={engine} {file} {forma} {materiale} finitura={showFinish ? finitura : 'lucida'} prodotto={engineProduct} {foglio} {rilievo} {vetro} {w} {h} {showCut} panel stage={foglio ? 440 : 370} onrender={onRender} />
				{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
				<div class="cfg__bar">
					{#if !vetro}
					<div class="cfg__bar-group">
						<span class="cfg__bar-label">{t('configuratore.file.sfondo')}</span>
						<div class="cfg__dots">
							{#each palette as c, i (i)}
								<button type="button" class="cfg__dot" class:is-on={i === palIdx} style={c.img === 'checker' ? 'background:repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/10px 10px' : c.img ? `background-image:url(${c.img});background-size:cover` : `background:${c.hex}`} title={c.img ? t('configuratore.file.coloreMateriale') : c.hex.toUpperCase()} aria-label={t('configuratore.file.sfondoHex', { hex: c.hex })} onclick={() => engine?.post('bg', { idx: i })}></button>
							{/each}
							<!-- colore libero: il pallino arcobaleno apre il selettore e il colore scelto si aggiunge alla tavolozza -->
							<button type="button" class="cfg__dot cfg__dot--arc" title={t('configuratore.file.colore')} aria-label={t('configuratore.file.coloreSfondo')} onclick={() => colInput?.click()}></button>
							<input bind:this={colInput} type="color" class="cfg__col" value={palette[palIdx]?.hex ?? '#ffffff'} oninput={(e) => engine?.post('bgcol', { hex: (e.currentTarget as HTMLInputElement).value })} />
						</div>
						<button type="button" class="cfg__tool" class:is-on={rimuovi} onclick={() => engine?.post('rimuovi')} title={t('configuratore.file.rimuoviSfondoTitolo')}>{t('configuratore.file.rimuoviSfondo')}</button>
					</div>
					{/if}
					<div class="cfg__bar-group">
						<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
						<button type="button" class="cfg__tool cfg__tool--blue" onclick={() => fileInput?.click()} title={file.name}>{t('configuratore.file.cambia')}</button>
						<button type="button" class="eye" class:is-off={!showCut} onclick={() => (showCut = !showCut)} aria-pressed={showCut} title={showCut ? t('configuratore.file.nascondiTaglio') : t('configuratore.file.mostraTaglio')}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{#if !showCut}<path d="M3 3l18 18" />{/if}</svg>
							<span class="eye__dash" aria-hidden="true"></span>
							<span class="sr-only">{t('configuratore.file.lineaTaglio')}</span>
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
						<div class="dropzone__title">{t('configuratore.file.trascina')}</div>
						<div class="dropzone__sub">{t('configuratore.file.oppure')}</div>
					</div>
				</label>
			{/if}
		</div>
	{/if}

	<!-- CONFIGURAZIONE -->
	<aside class="cfg__steps">
		<div class="cfg__head">
			<div>
				<p class="eyebrow">{test ? t('configuratore.passi.eyebrowTest') : t('configuratore.passi.eyebrow')}</p>
				<h2 class="cfg__title">{t('configuratore.passi.crea', { prodotto: productName })}</h2>
			</div>
			<span class="cfg__stepcount">{t('configuratore.passi.passaggio', { n: stepNo(step), tot: steps.length })}</span>
		</div>
		<div class="progress"><span style="width:{progress}%"></span></div>

		<!-- sagoma -->
		<div class="step" class:is-open={step === 'forma'}>
			<button class="step__head" type="button" onclick={() => (step = 'forma')} aria-expanded={step === 'forma'}>
				<span class="step__n">{#if stepNo(step) > stepNo('forma')}✓{:else}{stepNo('forma')}{/if}</span>
				<span class="step__title">{t('configuratore.passi.forma')} {#if step !== 'forma'}<em>{opz(tipoSagome, shape?.id ?? '', 'label', shape?.label)}</em>{/if}</span>
				<span class="step__edit">{step === 'forma' ? '' : t('configuratore.passi.modifica')}</span>
			</button>
			{#if step === 'forma'}
				<div class="step__body">
					<div class="pic-grid pic-grid--3">
						{#each SHAPES as s (s.id)}
							<button type="button" class="pic" class:is-active={forma === s.id} onclick={() => choose(() => (forma = s.id), 'forma')}>
								<img src={s.img} alt="" />
								<b>{opz(tipoSagome, s.id, 'label', s.label)}</b>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- materiale -->
		{#if showMaterials && !promoOnly}
			<div class="step" class:is-open={step === 'materiale'}>
				<button class="step__head" type="button" onclick={() => (step = 'materiale')} aria-expanded={step === 'materiale'}>
					<span class="step__n">{#if stepNo(step) > stepNo('materiale')}✓{:else}{stepNo('materiale')}{/if}</span>
					<span class="step__title">{t('configuratore.passi.materiale')} {#if step !== 'materiale'}<em>{opz('materiali', material?.id ?? '', 'label', material?.label)}</em>{/if}</span>
						<span class="step__edit">{step === 'materiale' ? '' : t('configuratore.passi.modifica')}</span>
				</button>
				{#if step === 'materiale'}
					<div class="step__body">
						<p class="step__hint">{t('configuratore.hint.materiale')}</p>
						<div class="pic-grid pic-grid--3 pic-grid--sm">
							{#each MATERIALS as m (m.id)}
								<button type="button" class="pic" class:is-active={materiale === m.id} onclick={() => choose(() => (materiale = m.id), 'materiale')}>
									<img src={m.img} alt="" />
									<b>{opz('materiali', m.id, 'label', m.label)}</b>
									{#if m.tag}<span class="pic__tag">{opz('materiali', m.id, 'tag', m.tag)}</span>{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- finitura (solo prodotti con lamina) -->
		{#if showFinish && !promoOnly}
			<div class="step" class:is-open={step === 'finitura'}>
				<button class="step__head" type="button" onclick={() => (step = 'finitura')} aria-expanded={step === 'finitura'}>
					<span class="step__n">{#if stepNo(step) > stepNo('finitura')}✓{:else}{stepNo('finitura')}{/if}</span>
					<span class="step__title">{finishTitle} {#if step !== 'finitura'}<em>{opz('finiture', finish?.id ?? '', 'label', finish?.label)}</em>{/if}</span>
						<span class="step__edit">{step === 'finitura' ? '' : t('configuratore.passi.modifica')}</span>
				</button>
				{#if step === 'finitura'}
					<div class="step__body">
						<div class="pic-grid pic-grid--3 pic-grid--sm">
							{#each FINISHES as f (f.id)}
								<button type="button" class="pic" class:is-active={finitura === f.id} onclick={() => choose(() => (finitura = f.id), 'finitura')}>
									{#if f.tag}<span class="pic__tag">{opz('finiture', f.id, 'tag', f.tag)}</span>{/if}
									<img src={f.img} alt="" />
									<b>{opz('finiture', f.id, 'label', f.label)}</b>
									<small>{opz('finiture', f.id, 'description', f.description ?? '')}</small>
								</button>
							{/each}
						</div>
						{#if finitura === 'nessuna'}<p class="step__hint">{t('configuratore.hint.senzaLamina')}</p>{/if}
						{#if finishNote}<p class="step__hint">{finishNote}</p>{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- misura -->
		{#if !promoOnly}
		<div class="step" class:is-open={step === 'misura'}>
			<button class="step__head" type="button" onclick={() => (step = 'misura')} aria-expanded={step === 'misura'}>
				<span class="step__n">{#if stepNo(step) > stepNo('misura')}✓{:else}{stepNo('misura')}{/if}</span>
				<span class="step__title">{t('configuratore.passi.misura')} {#if step !== 'misura'}<em>{misure(w, h)}</em>{/if}</span>
				<span class="step__edit">{step === 'misura' ? '' : t('configuratore.passi.modifica')}</span>
			</button>
			{#if step === 'misura'}
				<div class="step__body">
					<div class="size-presets">
						{#each presets as [pw, ph], k (pw)}
							<button type="button" class="size-btn" class:is-active={w === pw && h === ph} onclick={() => { w = pw; h = ph; }}>{#if k === 0}<small>{t('configuratore.misura.partenza')}</small>{/if}{misure(pw, ph)}</button>
						{/each}
					</div>
					<div class="size-inputs">
						<label><span>{t('configuratore.misura.larghezza')}</span><input type="number" min={inU(MIN_MM)} max={inU(MAX_MM)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(w)} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setW(unitToMm(+el.value, unit)); el.value = String(inU(w)); }} /><em>{unit}</em></label>
						<span class="size-x">×</span>
						<label><span>{t('configuratore.misura.altezza')}</span><input type="number" min={inU(MIN_MM)} max={inU(MAX_MM)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(h)} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setH(unitToMm(+el.value, unit)); el.value = String(inU(h)); }} /><em>{unit}</em></label>
					</div>
				</div>
			{/if}
		</div>

		{/if}
		{#if promoOnly && promo}
			<!-- offerta: quantita', misura, materiale e finitura sono fissi -->
			<div class="step is-open step--qty promo-fixed">
				<div class="step__head" role="presentation"><span class="step__n">{stepNo('forma') + 1}</span><span class="step__title">{t('configuratore.offerta.titolo')}</span></div>
					<div class="step__body">
						<ul class="promo-fixed__list">
							<li><b>{pezzi(promo.qty)}</b> · {t('configuratore.offerta.qty')}</li>
							<li><b>{misure(w, h)}</b> · {t('configuratore.offerta.misura')}</li>
							<li><b>{opz('materiali', materiale, 'label', material?.label ?? materiale)}</b>{#if finish}, {opz('finiture', finish.id, 'label', finish.label)}{/if} · {t('configuratore.offerta.materiale')}</li>
					</ul>
				</div>
			</div>
		{/if}
		<!-- quantità -->
		<!-- sempre aperto: il cliente vede tutti i prezzi a colpo d'occhio -->
		{#if !promoOnly}
		<div class="step is-open step--qty" id="qty-step">
			<div class="step__head" role="presentation">
				<span class="step__n">{stepNo('qty')}</span>
				<span class="step__title">{t('configuratore.passi.qty')} <em>{t('configuratore.qty.riepilogo', { n: numero(qty), totale: eur0(vatIncluded ? q.gross : q.net) })}</em></span>
			</div>
				<div class="step__body">
					{#if foglio && perSheet && file}
						{@const nf = Math.ceil(qty / perSheet.n)}
						<!-- testo dal catalogo (mai da input utente): i numeri si inseriscono nei segnaposto -->
						<p class="step__hint step__hint--box">{@html t('configuratore.hint.foglio', { n: perSheet.n, cols: perSheet.cols, rows: perSheet.rows, misura: misure(perSheet.w, perSheet.h), qty: numero(qty), fogli: t(nf === 1 ? 'configuratore.hint.foglioUno' : 'configuratore.hint.foglioTanti', { n: numero(nf) }) })}</p>
					{/if}
					<div class="qty-grid">
						{#each cfg.quantities as n (n)}
							{@const qq = quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: n, vatIncluded })}
							{@const disc = Math.max(0, Math.round((1 - qq.perPiece / basePerPiece) * 100))}
							<button type="button" class="qty" class:is-active={qty === n} onclick={() => { custom = false; qty = n; }}>
								{#if n === cfg.recommendedQty}<span class="qty__tag">{t('configuratore.qty.consigliato')}</span>{/if}
								<span class="qty__top"><b>{numero(n)}</b><b>{eur0(vatIncluded ? qq.gross : qq.net)}</b></span>
								<span class="qty__bottom">{t('configuratore.qty.perPezzo', { prezzo: prezzoUnit(qq.perPiece) })} {#if disc > 0}<b>−{disc}%</b>{/if}</span>
							</button>
						{/each}
					</div>
					{#if !test}
						<button type="button" class="link-btn" style="justify-self:start;font-size:14px" onclick={() => (customOpen = !customOpen)}>{t('configuratore.qty.altraQuantita')}</button>
						{#if customOpen}
							<div class="qty-custom">
								<label>{t('configuratore.qty.quantita')}<input type="number" min={minQty} step="1" bind:value={customQty} placeholder={String(minQty)} onkeydown={(e) => { if (e.key === 'Enter') applyCustom(); }} /></label>
								<button type="button" class="btn btn--blue btn--sm" onclick={applyCustom}>{t('configuratore.qty.calcola')}</button>
									{#if custom}<span class="qty-custom__res"><b>{pezzi(qty)}</b> · {eur0(vatIncluded ? q.gross : q.net)} · {t('configuratore.qty.perPezzo', { prezzo: prezzoUnit(q.perPiece) })}</span>{/if}
							</div>
						{/if}
					{/if}
				</div>
		</div>
		{/if}

	</aside>

	<!-- RIEPILOGO: spedizione, credito, totale e bottone, tutti alla stessa altezza -->
	<div class="cfg__freeship"><FreeShippingBar gross={cartGross + (added ? 0 : q.gross)} compact prefix={cartGross > 0 ? (added ? t('configuratore.spedizione.conCarrello') : t('configuratore.spedizione.conCarrelloOrdine')) : t('configuratore.spedizione.conOrdine')} /></div>
	<div class="cfg__summary">
		<div class="sum sum--ship">
			<span class="sum__ico">🚀</span>
			<div class="sum__text"><span class="sum__label">{t('configuratore.riepilogo.spedizioneStimata')}</span><span class="sum__value">{shipDate}</span><span class="sum__sub">{t('configuratore.riepilogo.spedizioneGratis', { soglia: formatAmount(locale.freeShipping, locale, 0) })}</span></div>
		</div>
		<div class="sum sum--credit">
			<span class="sum__ico"><img src="/images/coin-sp.png" alt={t('configuratore.riepilogo.creditoAlt')} /></span>
				<div class="sum__text"><span class="sum__label">{t('configuratore.riepilogo.guadagniCredito')}</span><span class="sum__value">{eur2(q.credit)}</span><span class="sum__sub">{t('configuratore.riepilogo.prossimoOrdine')}</span></div>
		</div>
		<div class="sum sum--total">
			<div class="sum__text">
				<span class="sum__label">{promoOk ? t('configuratore.offerta.prezzo') : t('configuratore.riepilogo.totale')}{vatIncluded ? t('configuratore.riepilogo.ivaInclusa') : t('configuratore.riepilogo.ivaEsclusa')}</span>
				<span class="sum__value sum__value--big">{eur0(vatIncluded ? q.gross : q.net)}</span>
				<div class="vat-toggle">
					<span class:active={!vatIncluded}>{t('configuratore.riepilogo.ivaEsclusa')}</span>
					<button type="button" class="switch" class:on={vatIncluded} role="switch" aria-checked={vatIncluded} aria-label={t('configuratore.riepilogo.mostraIva')} onclick={() => (vatIncluded = !vatIncluded)}><i></i></button>
					<span class:active={vatIncluded}>{t('configuratore.riepilogo.ivaInclusa')}</span>
				</div>
			</div>
			<span class="sum__per">{t('configuratore.qty.perPezzo', { prezzo: prezzoUnit(q.perPiece) })}</span>
		</div>
		{#if test}
			<div class="test-detail">
				<b>Netto {eur2(q.net)}</b> · materiale {eur2(q.breakdown.material)} · stampa {eur2(q.breakdown.print)}{#if cfg.kind === 'lamina'} · lamina {eur2(q.breakdown.laminate)}{:else} · resina {eur2(q.breakdown.resin)}{/if} · avvio {eur2(q.breakdown.setup)}<br />
				{q.breakdown.m2.toFixed(3)} m² · commercial range ×{(1 + q.breakdown.cr).toFixed(2)} · price range ×{(1 + q.breakdown.pr).toFixed(2)}
			</div>
		{:else}
			<button class="btn btn--green btn--cart" type="button" onclick={addCart} disabled={!file} title={file ? '' : t('configuratore.riepilogo.caricaTitolo')}>{file ? t('configuratore.riepilogo.aggiungi') : t('configuratore.riepilogo.caricaPerOrdinare')}</button>
		{/if}
	</div>
	{#if !test}
		<!-- MOBILE: barra prezzo fissa in basso. Il prezzo resta sempre visibile mentre si scorre;
		     −/+ cambia la quantità sulle fasce del listino, il prezzo porta al passo quantità -->
		<div class="cfg__mobar" role="region" aria-label={t('configuratore.riepilogo.barraPrezzo')}>
				<div class="mobar__qty">
					{#if !promoOnly}<button type="button" class="mobar__step" onclick={() => stepQty(-1)} aria-label={t('configuratore.qty.meno')}>−</button>{/if}
					<button type="button" class="mobar__n" onclick={goQty}>{t('configuratore.qty.pz', { n: numero(qty) })}</button>
					{#if !promoOnly}<button type="button" class="mobar__step" onclick={() => stepQty(1)} aria-label={t('configuratore.qty.piu')}>+</button>{/if}
				</div>
				<button type="button" class="mobar__price" onclick={goQty}>
					<b>{eur0(vatIncluded ? q.gross : q.net)}</b>
					<small>{t('configuratore.qty.perPezzo', { prezzo: prezzoUnit(q.perPiece) })} · {vatIncluded ? t('configuratore.riepilogo.ivaIncl') : t('configuratore.riepilogo.ivaEscl')}</small>
				</button>
				<button type="button" class="btn btn--green mobar__cta" onclick={file ? addCart : goFile}>{file ? t('configuratore.riepilogo.alCarrello') : t('configuratore.riepilogo.caricaFile')}</button>
		</div>
	{/if}
</section>

{#if !test}
	<details class="special special--below">
		<summary><span class="special__ico">💬</span> {t('configuratore.richiesta.titolo')} <em>{t('configuratore.richiesta.sotto')}</em></summary>
		<p class="special__beta">{t('configuratore.richiesta.beta')}</p>
		<textarea rows="3" placeholder={t('configuratore.richiesta.placeholder')} bind:value={note}></textarea>
	</details>
{/if}

{#if added}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="added-bg" onclick={(e) => { if (e.target === e.currentTarget) added = false; }} onkeydown={(e) => { if (e.key === 'Escape') added = false; }}>
		<div class="added" role="dialog" aria-modal="true" aria-label={t('configuratore.aggiunto.titolo')}>
			<span class="added__ck">✓</span>
			<h3>{t('configuratore.aggiunto.titolo')}</h3>
			<p>{t('configuratore.aggiunto.riepilogo', { qty: numero(qty), prodotto: productName.replace(/^(i tuoi|le tue) /, ''), misura: misure(w, h), totale: eur0(q.gross) })}</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href={path('/checkout')}>{t('configuratore.aggiunto.checkout')}</a>
				<a class="btn btn--ghost btn--lg" href={path('/prodotti')}>{t('configuratore.aggiunto.continua')}</a>
			</div>
		</div>
	</div>
{/if}
