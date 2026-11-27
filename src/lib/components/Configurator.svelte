<script lang="ts">
	import '$lib/styles/product.css';
	import { track, type ItemIn } from '$lib/tracking';
	import { klaviyo } from '$lib/klaviyo';
	import FreeShippingBar from './FreeShippingBar.svelte';
	import { readCart, cartGross as cartGrossOf, onCartChange } from '$lib/cart';
	/**
	 * Preventivatore prodotto (adesivi, etichette, vetrofanie…).
	 * Grafica 2027. Sinistra: il file del cliente nel motore di anteprima (lo stesso di sempre) con i suoi comandi.
	 * Destra: le scelte tutte aperte (sagoma, materiale, [finitura], misura, quantità in lista) e i tre riquadri.
	 * In basso la barra gialla fissa con totale e bottone carrello.
	 * Il listino `cfg` arriva dalla dashboard (Supabase) e decide cosa mostrare e i prezzi.
	 * Con `test` (dashboard) niente colonna del file e niente carrello: solo i passi e il prezzo.
	 */
	import { onMount } from 'svelte';
	import EnginePreview from './EnginePreview.svelte';
	import { loadDraft, saveDraft, saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { addToCart } from '$lib/cart';
	import { offreBaseBianco } from '$lib/base-bianco';
	import { quoteWith, minForShape, startSize, sizeProposals, proportionalSize, sizeRule, showFinishStep, showMaterialStep, type EngineConfig } from '$lib/pricing/engine';
	import { MM_PER_IN, mmToUnit, unitToMm, snapMm } from '$lib/i18n';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount, toCurrency, sceltaIva } from '$lib/i18n';

	/* totale prodotti gia' nel carrello (per la barra della spedizione gratuita) */
	let cartGross = $state(0);
	onMount(() => { cartGross = cartGrossOf(); return onCartChange(() => { cartGross = cartGrossOf(); }); });
	/* telefono: anteprima piu' bassa, che resta in alto mentre si scorre (si decide una volta, all'apertura:
	   cambiare l'altezza del palco ricaricherebbe il motore) */
	let stretto = $state(false);
	let altoV = $state(900); // altezza dello schermo all'apertura: su computer il palco si adatta, cosi' anteprima e comandi stanno sempre a vista
	let regola = $state(false); // telefono: comandi del motore (bordo, posizione) aperti sotto l'anteprima
	/* barra d'acquisto fissa: compare quando il preventivatore entra nello schermo */
	let sezione = $state<HTMLElement | undefined>();
	let barraOff = $state(true);
	let aggiornaFisso: () => void = () => {};
	$effect(() => { void regola; void file; aggiornaFisso(); });
	/* TELEFONO: l'anteprima resta ferma in alto mentre si scorre. Si usa `position: fixed` comandata da qui e non
	   `sticky`: lo sticky smette di funzionare appena un antenato ha `overflow` (il popup di Klaviyo lo mette sul
	   body, e i Safari vecchi non conoscono `overflow: clip`), e l'anteprima scorreva via con la pagina. */
	let segnaposto = $state<HTMLElement | undefined>(); // tiene il posto dell'anteprima nella pagina
	let fisso = $state<{ left: number; width: number; top: number } | null>(null);
	onMount(() => {
		stretto = matchMedia('(max-width: 900px)').matches;
		altoV = window.innerHeight;
		const on = () => {
			if (!sezione) return;
			const rs = sezione.getBoundingClientRect();
			barraOff = rs.top > window.innerHeight - 160;
			if (!stretto || regola || !segnaposto) { if (fisso) fisso = null; return; }
			const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64) + 6;
			const r = segnaposto.getBoundingClientRect();
			/* ferma in alto da quando il suo posto supera l'intestazione fino alla fine del preventivatore */
			const attiva = r.top < top && rs.bottom > top + r.height + 90;
			if (!attiva) { if (fisso) fisso = null; }
			else if (!fisso || fisso.left !== r.left || fisso.width !== r.width || fisso.top !== top) fisso = { left: r.left, width: r.width, top };
		};
		aggiornaFisso = on;
		on();
		/* in cattura: si sente lo scorrimento anche quando a scorrere e' il body e non la finestra */
		addEventListener('scroll', on, { passive: true, capture: true }); addEventListener('resize', on);
		return () => { removeEventListener('scroll', on, { capture: true }); removeEventListener('resize', on); };
	});
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
	/* totali: i centesimi si vedono solo quando ci sono (27,50 € · 160 €) */
	const eurT = (v: number) => { const c = toCurrency(v, locale.currency); return prezzo(v, Math.abs(c - Math.round(c)) > 0.004 ? 2 : 0); };
	/* prezzo al pezzo: due decimali, tre sotto i 10 centesimi */
	const unitP = (v: number) => locale.currency === 'EUR' ? new Intl.NumberFormat(locale.intl, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: v < 0.1 ? 3 : 2 }).format(v) : prezzoUnit(v);
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
	/* SITO USA, adesivi personalizzati / resinati / in rilievo (Mattia, 25/11/2026): le misure proposte sono pollici tondi
	   e si parte dalla prima. Tondo, quadrato e sagomato: 2×2, 3×3, 4×4, 5×5; rettangolo e ovale: 2×1, 3×2, 4×2, 5×3.
	   Il tondo scende fino a 0,75″. Gli altri prodotti e gli altri siti restano come sono. */
	const usSize = $derived(unit === 'in' && ['adesivi_personalizzati', 'adesivi_resinati', 'adesivi_rilievo'].includes(product));
	const US_TONDO_MIN = 0.75 * MM_PER_IN;
	function usPresets(f: string, r: number): [number, number][] {
		if (f === 'rettangolare' || f === 'ovale') return ([[2, 1], [3, 2], [4, 2], [5, 3]] as [number, number][]).map(([a, b]) => [a * MM_PER_IN, b * MM_PER_IN]);
		/* sagomato: il numero e' il lato lungo, l'altro segue la proporzione del disegno */
		const k = f === 'sagomato' && r > 0 ? r : 1;
		return [2, 3, 4, 5].map((n) => (k >= 1 ? [n * MM_PER_IN, snapMm((n * MM_PER_IN) / k, unit)] : [snapMm(n * MM_PER_IN * k, unit), n * MM_PER_IN]) as [number, number]);
	}
	const MIN_MM = $derived(usSize && forma === 'tondo' ? US_TONDO_MIN : sizeRule(cfg, forma).short);
	let materiale = $state('bianco');
	let finitura = $state(''); // la prima scelta e' senza lamina (vedi effetto sotto)
	/* base di bianco sotto la grafica: solo sui materiali speciali (olografico, glitter, trasparente, argento, oro) */
	let baseBianco = $state(false);
	const conBase = $derived(offreBaseBianco(materiale, product));
	const BASE_METAL = new Set(['olografico', 'glitterato', 'argento', 'oro']);
	/* la lampadina della lamina: su tutti tranne resinati e vetrofanie, quando fra le scelte c'e' "nessuna" */
	const luceLamina = $derived(product !== 'adesivi_resinati' && product !== 'vetrofanie');
	/* con la base di bianco (non sui resinati) la lamina opaca non c'e' e la lucida diventa "Vernice lucida" */
	const vernice = $derived(conBase && baseBianco && product !== 'adesivi_resinati');
	const FIN_VIS = $derived(vernice ? FINISHES.filter((f) => f.id !== 'opaca') : FINISHES);
	const nomeFinitura = (f: { id: string; label: string }) => (vernice && f.id === 'lucida' ? t('configuratore.hint.vernice') : opz('finiture', f.id, 'label', f.label));
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
	let customQty = $state<number | ''>('');
	let custom = $state(false);

	// valori iniziali coerenti con il listino (anche quando il listino cambia sotto, in dashboard)
	$effect(() => {
		if (!SHAPES.some((s) => s.id === forma)) forma = SHAPES[0]?.id ?? 'sagomato';
		if (!MATERIALS.some((m) => m.id === materiale)) materiale = MATERIALS[0]?.id ?? 'bianco';
		/* la prima scelta e' SENZA lamina: il prezzo che il cliente vede all'inizio e' il piu' basso */
		if (!FIN_VIS.some((f) => f.id === finitura)) finitura = finitura === 'opaca' && FIN_VIS.some((f) => f.id === 'lucida') ? 'lucida' : (FIN_VIS.find((f) => !f.laminate)?.id ?? FIN_VIS[0]?.id ?? 'nessuna');
		if (!custom && !cfg.quantities.includes(qty)) qty = cfg.quantities[0];
	});

	const shape = $derived(SHAPES.find((s) => s.id === forma) ?? SHAPES[0]);
	const material = $derived(MATERIALS.find((m) => m.id === materiale) ?? cfg.materials[0]);
	const finish = $derived(FIN_VIS.find((f) => f.id === finitura));
	const fin = $derived(promoOnly ? finitura : showFinish ? finitura : 'nessuna');
	const ratio = $derived(shape?.equal ? 1 : (shape?.ratio ?? cutRatio ?? fileRatio ?? 1));
	/* sagomato, rettangolo e ovale: le misure sono solo proposte, il cliente scrive la sua con i due lati
	   indipendenti (Mattia, 7/11/2026: sul sagomato 40 scritto da una parte non deve diventare 40 anche
	   dall'altra; un preventivo 40×60 si deve poter fare anche senza file). Restano in proporzione solo
	   le sagome a lati uguali (tondo, quadrato) e quelle con proporzione fissa (fogli). */
	const freeSize = $derived(!shape?.equal && !shape?.ratio);
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
	/* sul sito USA le proposte sono pollici tondi (1,5″ 2″ 2,5″ 3″ 4″ 5″) convertiti in mm: il listino segue quelle misure */
	const INCH_PRESETS = [1.5, 2, 2.5, 3, 4, 5].map((i) => i * MM_PER_IN);
	const shapePresets = $derived(unit === 'in' ? INCH_PRESETS : (shape?.presets?.length ? shape.presets : [30, 50, 70, 100]));
	/* la prima proposta e' sempre la misura minima della sagoma (lato corto al minimo, lato lungo in
	   proporzione al disegno), poi tre misure piu' grandi; le misure personalizzate si scrivono sotto */
	const presets = $derived.by(() => {
		if (usSize) return usPresets(forma, ratio);
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
	function goFile() { if (stretto) document.getElementById('configura')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); fileInput?.click(); }
	function applyCustom() {
		const n = Math.max(minQty, Math.round(Number(customQty) || 0));
		customQty = n; custom = true; qty = n;
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
		const [w0, h0] = usSize ? usPresets(forma, r)[0] : startSize(cfg, forma, r);
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
	/* sagomato, rettangolo e ovale: lati liberi (ognuno fra minimo e massimo); tondo, quadrato e fogli
	   restano in proporzione e nessun lato scende mai sotto il minimo (vedi proportionalSize) */
	function setW(v: number) {
		if (freeSize) { w = clamp(v); return; }
		if (usSize && forma === 'tondo') { w = h = clamp(v); return; }   // tondo USA: minimo 0,75″
		[w, h] = proportionalSize(cfg, forma, v, ratio);
	}
	function setH(v: number) {
		if (freeSize) { h = clamp(v); return; }
		if (usSize && forma === 'tondo') { w = h = clamp(v); return; }
		[w, h] = proportionalSize(cfg, forma, v * ratio, ratio);
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
	const tot = (r: { gross: number; net: number }) => (vatIncluded ? r.gross : r.net);
	const stageH = $derived(stretto ? (foglio ? 300 : 250) : Math.max(280, Math.min(foglio ? 520 : 480, altoV - 454)));
	/* etichetta sulla riga della quantita': "Consigliato" sui 100 pezzi, "Più conveniente" sulla quantita' consigliata dal listino */
	const tagQty = (n: number) => (n === 100 ? 'cons' : n === cfg.recommendedQty ? 'conv' : null);
	const riga = $derived([opz(tipoSagome, shape?.id ?? '', 'label', shape?.label), misure(w, h), ...(showMaterials ? [opz('materiali', material?.id ?? '', 'label', material?.label)] : []), ...(showFinish && finish?.laminate ? [vernice && finish.id === 'lucida' ? t('configuratore.hint.vernice').toLowerCase() : t('configuratore.nuovo.lamina', { finitura: opz('finiture', finish.id, 'label', finish.label).toLowerCase() })] : []), ...(conBase && baseBianco ? [t('configuratore.hint.baseBianco').toLowerCase()] : [])].filter(Boolean).join(' · '));
	const gratis = $derived(toCurrency(cartGross + q.gross, locale.currency) >= locale.freeShipping);
	const ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf';
</script>

<section class="pv" class:pv--test={test} id="configura" bind:this={sezione}>
	{#if !test}
		<!-- ANTEPRIMA: il motore di sempre (static/preprint) con i suoi comandi; sotto, sfondo · rimuovi sfondo · cambia file · linea di taglio -->
		<div class="pv__stage" class:is-regola={regola} style="--palco:{stageH}px">
			{#if file}
				<div class="pv__posto" bind:this={segnaposto}>
				<div class="pv__box" class:is-fisso={!!fisso} style={fisso ? `left:${fisso.left}px;width:${fisso.width}px;top:${fisso.top}px` : undefined}>
					<EnginePreview bind:this={engine} {file} {forma} {materiale} finitura={showFinish ? finitura : 'lucida'} prodotto={engineProduct} {foglio} {rilievo} {vetro} baseBianco={conBase && baseBianco} {w} {h} {showCut} panel nuovo dimLabel={misure(w, h)} stage={stageH} onrender={onRender} />
				</div>
				</div>
				{#if fileUrl}<img src={fileUrl} alt="" hidden onload={onImgLoad} />{/if}
				<div class="pv__tools">
					{#if !vetro}
						<span class="pv__tl">{t('configuratore.file.sfondo')}</span>
						<div class="pv__dots">
							{#each palette as c, i (i)}
								<button type="button" class="pv__dot" class:is-on={i === palIdx} style={c.img === 'checker' ? 'background:repeating-conic-gradient(#cfd6dd 0 25%,#fff 0 50%) 0 0/10px 10px' : c.img ? `background-image:url(${c.img});background-size:cover` : `background:${c.hex}`} title={c.img ? t('configuratore.file.coloreMateriale') : c.hex.toUpperCase()} aria-label={t('configuratore.file.sfondoHex', { hex: c.hex })} onclick={() => engine?.post('bg', { idx: i })}></button>
							{/each}
							<!-- colore libero: il pallino arcobaleno apre il selettore e il colore scelto si aggiunge alla tavolozza -->
							<button type="button" class="pv__dot pv__dot--arc" title={t('configuratore.file.colore')} aria-label={t('configuratore.file.coloreSfondo')} onclick={() => colInput?.click()}></button>
							<input bind:this={colInput} type="color" class="pv__col" value={palette[palIdx]?.hex ?? '#ffffff'} oninput={(e) => engine?.post('bgcol', { hex: (e.currentTarget as HTMLInputElement).value })} />
						</div>
						<button type="button" class="pv__pill" class:is-on={rimuovi} onclick={() => engine?.post('rimuovi')} title={t('configuratore.file.rimuoviSfondoTitolo')}>{t('configuratore.file.rimuoviSfondo')}</button>
					{/if}
					<input bind:this={fileInput} type="file" accept={ACCEPT} hidden onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
					<button type="button" class="pv__pill pv__pill--blue" onclick={() => fileInput?.click()} title={file.name}>{t('configuratore.file.cambia')}</button>
					<button type="button" class="pv__pill pv__eye" class:is-off={!showCut} onclick={() => (showCut = !showCut)} aria-pressed={showCut} title={showCut ? t('configuratore.file.nascondiTaglio') : t('configuratore.file.mostraTaglio')}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{#if !showCut}<path d="M3 3l18 18" />{/if}</svg>
						<i aria-hidden="true"></i>
						<span class="sr-only">{t('configuratore.file.lineaTaglio')}</span>
					</button>
				</div>
				<button type="button" class="pv__regola" aria-expanded={regola} onclick={() => { regola = !regola; if (regola) document.getElementById('configura')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{regola ? t('configuratore.nuovo.chiudiRegola') : t('configuratore.nuovo.regola')}</button>
			{:else}
				<label class="pv__drop" class:is-over={over}
					ondragenter={(e) => { e.preventDefault(); over = true; }}
					ondragover={(e) => { e.preventDefault(); over = true; }}
					ondragleave={() => (over = false)}
					ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}>
					<input bind:this={fileInput} type="file" accept={ACCEPT} onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
					<span class="pv__dropico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></span>
					<b>{t('configuratore.file.trascina')}</b>
					<span class="pv__drops">{t('configuratore.file.oppure')}</span>
				</label>
			{/if}
		</div>
	{/if}

	<!-- SCELTE: tutte aperte, una sotto l'altra -->
	<div class="pv__panel">
		<p class="eyebrow">{test ? t('configuratore.passi.eyebrowTest') : t('configuratore.passi.eyebrow')}</p>
		<h2 class="pv__title">{t('configuratore.passi.crea', { prodotto: productName })}</h2>

		<!-- sagoma -->
		<div class="grp">
			<div class="grp__h"><span class="grp__n">{stepNo('forma')}</span><span class="grp__t">{t('configuratore.passi.forma')}</span><span class="grp__v">{opz(tipoSagome, shape?.id ?? '', 'label', shape?.label)}</span></div>
			<div class="tiles">
				{#each SHAPES as s (s.id)}
					<button type="button" class="tile" class:is-on={forma === s.id} aria-pressed={forma === s.id} onclick={() => (forma = s.id)}>
						<img src={s.img} alt="" />
						<b>{opz(tipoSagome, s.id, 'label', s.label)}</b>
					</button>
				{/each}
			</div>
		</div>

		<!-- materiale -->
		{#if showMaterials && !promoOnly}
			<div class="grp">
				<div class="grp__h"><span class="grp__n">{stepNo('materiale')}</span><span class="grp__t">{t('configuratore.passi.materiale')}</span><span class="grp__v">{opz('materiali', material?.id ?? '', 'label', material?.label)}</span></div>
				<div class="tiles">
					{#each MATERIALS as m (m.id)}
						<button type="button" class="tile" class:is-on={materiale === m.id} aria-pressed={materiale === m.id} onclick={() => (materiale = m.id)}>
							{#if m.tag}<span class="tile__tag">{opz('materiali', m.id, 'tag', m.tag)}</span>{/if}
							<img src={m.img} alt="" />
							<b>{opz('materiali', m.id, 'label', m.label)}</b>
						</button>
					{/each}
				</div>
				{#if conBase}
					<button type="button" class="bb" class:is-on={baseBianco} aria-pressed={baseBianco} onclick={() => (baseBianco = !baseBianco)}>
						<span class="bb__box" aria-hidden="true">{baseBianco ? '✓' : ''}</span>{t('configuratore.hint.baseBianco')}
					</button>
					<p class="luce"><span aria-hidden="true">💡</span>{baseBianco ? t('configuratore.hint.baseBiancoSi') : BASE_METAL.has(materiale) ? t('configuratore.hint.baseBiancoNoMetal') : t('configuratore.hint.baseBiancoNoTrasp')}</p>
				{/if}
				<p class="grp__hint">{t('configuratore.hint.materiale')}</p>
			</div>
		{/if}

		<!-- finitura (solo prodotti con lamina) -->
		{#if showFinish && !promoOnly}
			<div class="grp">
				<div class="grp__h"><span class="grp__n">{stepNo('finitura')}</span><span class="grp__t">{finishTitle}</span><span class="grp__v">{finish ? nomeFinitura(finish) : ''}</span></div>
				<div class="tiles">
					{#each FIN_VIS as f (f.id)}
						<button type="button" class="tile" class:is-on={finitura === f.id} aria-pressed={finitura === f.id} onclick={() => (finitura = f.id)}>
							{#if f.tag}<span class="tile__tag">{opz('finiture', f.id, 'tag', f.tag)}</span>{/if}
							<img src={f.img} alt="" />
							<b>{nomeFinitura(f)}</b>
							<small>{opz('finiture', f.id, 'description', f.description ?? '')}</small>
						</button>
					{/each}
				</div>
				{#if luceLamina && FINISHES.some((x) => x.id === 'nessuna')}
					<p class="luce"><span aria-hidden="true">💡</span>{finitura === 'nessuna' ? t('configuratore.hint.senzaLaminaLuce') : t('configuratore.hint.conLaminaLuce')}</p>
				{:else if finitura === 'nessuna'}<p class="grp__hint">{t('configuratore.hint.senzaLamina')}</p>{/if}
				{#if finishNote}<p class="grp__hint">{finishNote}</p>{/if}
			</div>
		{/if}

		<!-- misura -->
		{#if !promoOnly}
			<div class="grp">
				<div class="grp__h"><span class="grp__n">{stepNo('misura')}</span><span class="grp__t">{t('configuratore.passi.misura')}</span><span class="grp__v">{misure(w, h)}</span></div>
				<div class="chips">
					{#each presets as [pw, ph], k (pw)}
						<button type="button" class="chip" class:is-on={w === pw && h === ph} aria-pressed={w === pw && h === ph} onclick={() => { w = pw; h = ph; }}>{#if k === 0}<small>{t('configuratore.misura.partenza')}</small>{/if}{misure(pw, ph)}</button>
					{/each}
				</div>
				<div class="sizein">
					<label>{t('configuratore.misura.larghezza')}<input type="number" inputmode="decimal" min={inU(MIN_MM)} max={inU(MAX_MM)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(w)} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setW(unitToMm(+el.value, unit)); el.value = String(inU(w)); }} /><em>{unit}</em></label>
					<span>×</span>
					<label>{t('configuratore.misura.altezza')}<input type="number" inputmode="decimal" min={inU(MIN_MM)} max={inU(MAX_MM)} step={unit === 'in' ? '0.05' : '0.5'} value={inU(h)} onchange={(e) => { const el = e.currentTarget as HTMLInputElement; setH(unitToMm(+el.value, unit)); el.value = String(inU(h)); }} /><em>{unit}</em></label>
				</div>
			</div>
		{/if}

		{#if promoOnly && promo}
			<!-- offerta: quantita', misura, materiale e finitura sono fissi -->
			<div class="grp">
				<div class="grp__h"><span class="grp__n">{stepNo('forma') + 1}</span><span class="grp__t">{t('configuratore.offerta.titolo')}</span></div>
				<ul class="promo-fixed__list">
					<li><b>{pezzi(promo.qty)}</b> · {t('configuratore.offerta.qty')}</li>
					<li><b>{misure(w, h)}</b> · {t('configuratore.offerta.misura')}</li>
					<li><b>{opz('materiali', materiale, 'label', material?.label ?? materiale)}</b>{#if finish}, {opz('finiture', finish.id, 'label', finish.label)}{/if} · {t('configuratore.offerta.materiale')}</li>
				</ul>
			</div>
		{/if}

		<!-- quantità: una riga per fascia, con prezzo al pezzo, risparmio e totale -->
		{#if !promoOnly}
			<div class="grp" id="qty-step">
				<div class="grp__h">
					<span class="grp__n">{stepNo('qty')}</span><span class="grp__t">{t('configuratore.passi.qty')}</span>
					{#if sceltaIva(locale)}
						<span class="vat" role="group" aria-label={t('configuratore.nuovo.prezziIva')}>
							<button type="button" class:is-on={vatIncluded} aria-pressed={vatIncluded} onclick={() => (vatIncluded = true)}>{t('configuratore.riepilogo.ivaInclusa')}</button>
							<button type="button" class:is-on={!vatIncluded} aria-pressed={!vatIncluded} onclick={() => (vatIncluded = false)}>{t('configuratore.riepilogo.ivaEsclusa')}</button>
						</span>
					{/if}
				</div>
				{#if foglio && perSheet && file}
					{@const nf = Math.ceil(qty / perSheet.n)}
					<!-- testo dal catalogo (mai da input utente): i numeri si inseriscono nei segnaposto -->
					<p class="grp__hint grp__hint--box">{@html t('configuratore.hint.foglio', { n: perSheet.n, cols: perSheet.cols, rows: perSheet.rows, misura: misure(perSheet.w, perSheet.h), qty: numero(qty), fogli: t(nf === 1 ? 'configuratore.hint.foglioUno' : 'configuratore.hint.foglioTanti', { n: numero(nf) }) })}</p>
				{/if}
				<div class="qlist">
					{#each cfg.quantities as n (n)}
						{@const qq = quoteWith(cfg, { w, h, forma, materiale, finitura: fin, qty: n, vatIncluded })}
						{@const disc = Math.max(0, Math.round((1 - qq.perPiece / basePerPiece) * 100))}
						{@const tag = tagQty(n)}
						<button type="button" class="q" class:is-on={!custom && qty === n} aria-pressed={!custom && qty === n} onclick={() => { custom = false; customQty = ''; qty = n; }}>
							<span class="q__n">{t('configuratore.qty.pz', { n: numero(n) })}</span>
							<span class="q__mid">
								<span class="q__u">{t('configuratore.qty.perPezzo', { prezzo: unitP(qq.perPiece) })}</span>
								{#if disc > 0}<span class="q__save">{t('configuratore.nuovo.risparmi', { n: disc })}</span>{/if}
								{#if tag}<span class="q__tag" class:q__tag--g={tag === 'conv'}>{tag === 'conv' ? t('configuratore.nuovo.piuConveniente') : t('configuratore.qty.consigliato')}</span>{/if}
							</span>
							<span class="q__tot">{eurT(tot(qq))}</span>
						</button>
					{/each}
					{#if !test}
						<div class="qcustom" class:is-on={custom}>
							<label for="pv-altra">{t('configuratore.nuovo.altra')}</label>
							<input id="pv-altra" type="number" inputmode="numeric" min={minQty} step="1" bind:value={customQty} placeholder={t('configuratore.nuovo.esempio')} onchange={() => { if (customQty === '' || customQty == null) custom = false; else applyCustom(); }} onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} />
							{#if custom}<span class="qcustom__r"><b>{eurT(tot(q))}</b>{t('configuratore.qty.perPezzo', { prezzo: unitP(q.perPiece) })}</span>{:else}<span class="qcustom__r">{t('configuratore.nuovo.minimo', { n: numero(minQty) })}</span>{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if test}
			<div class="pv__test">
				<div class="pv__testtot"><span>{t('configuratore.riepilogo.totale')}{vatIncluded ? t('configuratore.riepilogo.ivaInclusa') : t('configuratore.riepilogo.ivaEsclusa')}</span><b>{eurT(tot(q))}</b><em>{t('configuratore.qty.perPezzo', { prezzo: unitP(q.perPiece) })}</em></div>
				<div class="test-detail">
					<b>Netto {eur2(q.net)}</b> · materiale {eur2(q.breakdown.material)} · stampa {eur2(q.breakdown.print)}{#if cfg.kind === 'lamina'} · lamina {eur2(q.breakdown.laminate)}{:else} · resina {eur2(q.breakdown.resin)}{/if} · avvio {eur2(q.breakdown.setup)}<br />
					{#if q.breakdown.k != null}{q.breakdown.m2.toFixed(3)} m² · sconto volume {((q.breakdown.sconto ?? 0) * 100).toFixed(1)}% · aumento e correttivi {eur2(q.breakdown.aumento ?? 0)} · lavoro {eur2(q.breakdown.lavoro ?? 0)}{:else}{q.breakdown.m2.toFixed(3)} m² · commercial range ×{(1 + q.breakdown.cr).toFixed(2)} · price range ×{(1 + q.breakdown.pr).toFixed(2)}{/if}
				</div>
			</div>
		{:else}
			<div class="pv__ship"><FreeShippingBar gross={cartGross + (added ? 0 : q.gross)} compact prefix={cartGross > 0 ? (added ? t('configuratore.spedizione.conCarrello') : t('configuratore.spedizione.conCarrelloOrdine')) : t('configuratore.spedizione.conOrdine')} /></div>
			<!-- tre riquadri: spedizione, credito, controllo del file -->
			<div class="trust">
				<div class="tc">
					<span class="tc__ico">🚀</span>
					<span><span class="tc__l">{t('configuratore.riepilogo.spedizioneStimata')}</span><b class="tc__v">{shipDate}</b><span class="tc__s">{t('configuratore.riepilogo.spedizioneGratis', { soglia: formatAmount(locale.freeShipping, locale, 0) })}</span></span>
				</div>
				<div class="tc tc--y">
					<span class="tc__ico"><img src="/images/coin-sp.png" alt={t('configuratore.riepilogo.creditoAlt')} /></span>
					<span><span class="tc__l">{t('configuratore.riepilogo.guadagniCredito')}</span><b class="tc__v">{eur2(q.credit)}</b><span class="tc__s">{t('configuratore.riepilogo.prossimoOrdine')}</span></span>
				</div>
				<div class="tc tc--g">
					<span class="tc__ico">✅</span>
					<span><span class="tc__l">{t('configuratore.nuovo.controllo')}</span><b class="tc__v">{t('configuratore.nuovo.controlloTitolo')}</b><span class="tc__s">{t('configuratore.nuovo.controlloSotto')}</span></span>
				</div>
			</div>
		{/if}
	</div>
</section>

{#if !test}
	<!-- BARRA D'ACQUISTO: gialla, fissa in basso, con totale e bottone azzurro -->
	<div class="pv__buy" class:is-off={barraOff} role="region" aria-label={t('configuratore.riepilogo.barraPrezzo')}>
		<div class="pv__buyin">
			<div class="buy__sum"><b>{numero(qty)} × {productName.replace(/^(i tuoi|le tue) /, '')}</b><span>{riga}</span></div>
			<div class="buy__ship"><b>🚀 {shipDate}</b>{gratis ? t('configuratore.nuovo.gratisInclusa') : t('configuratore.nuovo.gratisDa', { soglia: formatAmount(locale.freeShipping, locale, 0) })}</div>
			<div class="buy__price"><b>{eurT(tot(q))}</b><span>{promoOk ? t('configuratore.offerta.prezzo') : ''}{t('configuratore.qty.perPezzo', { prezzo: unitP(q.perPiece) })} · {vatIncluded ? t('configuratore.riepilogo.ivaInclusa') : t('configuratore.riepilogo.ivaEsclusa')}</span></div>
			<button type="button" class="cta" onclick={file ? addCart : goFile} title={file ? '' : t('configuratore.riepilogo.caricaTitolo')}>
				{#if file}<span class="cta__d">{t('configuratore.riepilogo.aggiungi')}</span><span class="cta__m">{t('configuratore.riepilogo.alCarrello')}</span>{:else}{t('configuratore.riepilogo.caricaFile')}{/if}
			</button>
		</div>
	</div>

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
			<p>{t('configuratore.aggiunto.riepilogo', { qty: numero(qty), prodotto: productName.replace(/^(i tuoi|le tue) /, ''), misura: misure(w, h), totale: eurT(q.gross) })}</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href={path('/checkout')}>{t('configuratore.aggiunto.checkout')}</a>
				<a class="btn btn--ghost btn--lg" href={path('/prodotti')}>{t('configuratore.aggiunto.continua')}</a>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ===== Preventivatore, grafica 2027 ===== */
	.pv { --green-soft: #eefbe2; --green-deep: #2f7d0b; --bar-h: 84px; display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr); gap: 44px; align-items: start; margin-top: 24px; scroll-margin-top: 84px; overflow-anchor: none; }
	.pv--test { grid-template-columns: 1fr; max-width: 760px; margin-top: 16px; }
	.pv :global(.sr-only) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

	/* anteprima */
	.pv__stage { min-width: 0; display: grid; gap: 10px; align-content: start; }
	/* computer: l'anteprima resta fissa a sinistra mentre a destra si scorre; su schermi bassi i comandi sotto scorrono dentro la colonna */
	@media (min-width: 901px) { .pv__stage { position: sticky; top: calc(var(--header-h, 64px) + 12px); max-height: calc(100vh - var(--header-h, 64px) - 84px - 24px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; } }
	.pv__box { position: relative; }

	.pv__drop { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; border: 2px dashed var(--blue); border-radius: 26px; background: #fff; cursor: pointer; padding: 16px; min-height: 420px; transition: background .15s; }
	.pv__drop:hover, .pv__drop.is-over { background: var(--sky); }
	.pv__drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
	.pv__dropico { width: 64px; height: 64px; border-radius: 18px; background: var(--sky); color: var(--blue); display: grid; place-items: center; margin-bottom: 12px; }
	.pv__drop:hover .pv__dropico, .pv__drop.is-over .pv__dropico { background: #fff; }
	.pv__drop b { font-family: var(--font-display); font-weight: 800; font-size: 22px; letter-spacing: -.02em; line-height: 1.15; }
	.pv__drops { font-size: 14px; color: var(--ink-soft); }

	.pv__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 18px; padding: 10px 12px; background: #fff; }
	.pv__tl { font-size: 11.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
	.pv__dots { display: flex; gap: 5px; position: relative; }
	.pv__dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #c5c8dc; cursor: pointer; padding: 0; flex: none; }
	.pv__dot.is-on { box-shadow: 0 0 0 2px var(--blue); }
	.pv__dot--arc { background: conic-gradient(from 0deg, #ff2d55, #ff9500, #ffe600, #34c759, #00b0ff, #7c4dff, #ff2d55); }
	.pv__col { position: absolute; width: 0; height: 0; opacity: 0; border: 0; padding: 0; }
	.pv__pill { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 11px; font: inherit; font-weight: 700; font-size: 12.5px; white-space: nowrap; cursor: pointer; color: var(--ink); }
	.pv__pill.is-on { background: var(--navy); color: #fff; border-color: var(--navy); }
	.pv__pill--blue { color: var(--blue-text); border-color: var(--blue); }
	.pv__eye { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; }
	.pv__eye i { width: 22px; border-top: 3px dashed #2fe010; }
	.pv__eye.is-off { color: var(--muted); }
	.pv__eye.is-off i { border-top-color: #c3ccd6; }
	.pv__regola { display: none; }

	/* scelte */
	.pv__panel { min-width: 0; }
	.pv__title { font-size: clamp(24px, 2.6vw, 34px); margin-top: 4px; }
	.grp { margin-top: 24px; }
	.grp__h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
	.grp__n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--navy); color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 13px; display: grid; place-items: center; transform: translateY(3px); }
	.grp__t { font-family: var(--font-display); font-weight: 800; font-size: 19px; letter-spacing: -.02em; }
	.grp__v { font-size: 14px; color: var(--muted); font-weight: 500; margin-left: auto; text-align: right; }
	.grp__hint { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; }
	/* base di bianco e lampadine dei suggerimenti */
	.bb { margin-top: 10px; display: inline-flex; align-items: center; gap: 9px; border: 2px solid var(--line); background: #fff; border-radius: 999px; padding: 8px 14px 8px 9px; font-family: inherit; font-weight: 700; font-size: 13px; line-height: 1.2; color: var(--ink); cursor: pointer; transition: border-color .12s, background .12s; }
	.bb:hover { border-color: #c5c8dc; }
	.bb.is-on { border-color: var(--blue); background: var(--sky); }
	.bb__box { width: 18px; height: 18px; border-radius: 5px; border: 2px solid #c5c8dc; display: inline-grid; place-items: center; font-size: 12px; line-height: 1; color: #fff; background: #fff; flex: none; }
	.bb.is-on .bb__box { background: var(--blue); border-color: var(--blue); }
	.luce { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.45; color: var(--ink-soft); background: #fff8e1; border-radius: 10px; padding: 9px 12px; margin: 10px 0 0; }
	.luce span { font-size: 15px; line-height: 1.2; flex: none; }
	.grp__hint--box { background: var(--sky); border-radius: 10px; padding: 12px 14px; color: var(--ink-soft); margin: 0 0 10px; }
	.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }
	.tile { position: relative; border: 2px solid var(--line); background: #fff; border-radius: 14px; padding: 8px 6px 9px; display: grid; justify-items: center; align-content: start; gap: 4px; text-align: center; font: inherit; color: var(--ink); cursor: pointer; transition: border-color .12s, background .12s; }
	.tile:hover { border-color: #c5c8dc; }
	.tile.is-on { border-color: var(--blue); background: var(--sky); }
	.tile img { width: 54px; height: 54px; object-fit: contain; }
	.tile b { font-size: 13px; line-height: 1.2; }
	.tile small { font-size: 11.5px; color: var(--muted); line-height: 1.25; }
	.tile__tag { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: var(--yellow); border-radius: 999px; font-size: 10.5px; font-weight: 700; padding: 1px 8px; white-space: nowrap; z-index: 1; }
	.chips { display: flex; flex-wrap: wrap; gap: 8px; }
	.chip { border: 2px solid var(--line); background: #fff; border-radius: 12px; padding: 9px 14px; font: inherit; font-weight: 700; font-size: 14px; color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums; }
	.chip small { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--green-deep); margin-bottom: 1px; }
	.chip.is-on { border-color: var(--blue); background: var(--sky); }
	.sizein { display: flex; align-items: flex-end; gap: 10px; margin-top: 10px; }
	.sizein label { display: grid; gap: 3px; font-size: 12px; color: var(--muted); font-weight: 600; flex: 1; max-width: 150px; position: relative; }
	.sizein input { border: 2px solid var(--line); border-radius: 12px; padding: 10px 40px 10px 12px; font: inherit; font-weight: 700; font-size: 16px; width: 100%; color: var(--ink); }
	.sizein input:focus { outline: none; border-color: var(--blue); }
	.sizein em { position: absolute; right: 12px; bottom: 12px; font-style: normal; font-size: 13px; color: var(--muted); }
	.sizein > span { padding-bottom: 12px; color: var(--muted); font-weight: 700; }

	/* quantità */
	.vat { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 2px; margin-left: auto; background: #f5f6fb; }
	.vat { flex: none; }
	.vat button { white-space: nowrap; border: 0; background: none; border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12px; font-weight: 700; color: var(--muted); cursor: pointer; }
	.vat button.is-on { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(5, 5, 56, .15); }
	.qlist { display: grid; gap: 6px; }
	.q { display: grid; grid-template-columns: minmax(74px, auto) 1fr auto; align-items: center; gap: 10px; border: 2px solid var(--line); background: #fff; border-radius: 14px; padding: 10px 14px; text-align: left; width: 100%; font: inherit; color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums; transition: border-color .12s, background .12s; }
	.q:hover { border-color: #c5c8dc; }
	.q.is-on { border-color: var(--blue); background: var(--sky); box-shadow: 0 4px 14px rgba(14, 139, 255, .16); }
	.q__n, .q__tot { font-family: var(--font-display); font-weight: 800; font-size: 19px; letter-spacing: -.02em; white-space: nowrap; }
	.q__tot { text-align: right; }
	.q__mid { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; min-width: 0; }
	.q__u { font-size: 13px; color: var(--ink-soft); white-space: nowrap; }
	.q__save { font-size: 12.5px; font-weight: 700; color: var(--green-deep); background: var(--green-soft); border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
	.q__tag { background: var(--yellow); border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
	.q__tag--g { background: var(--green); }
	.qcustom { display: flex; align-items: center; gap: 10px; border: 2px dashed var(--line); border-radius: 14px; padding: 8px 14px; }
	.qcustom.is-on { border: 2px solid var(--blue); background: var(--sky); }
	.qcustom label { font-size: 13.5px; font-weight: 700; white-space: nowrap; }
	.qcustom input { width: 110px; border: 2px solid var(--line); border-radius: 10px; padding: 7px 10px; font: inherit; font-weight: 700; font-size: 16px; background: #fff; color: var(--ink); }
	.qcustom input:focus { outline: none; border-color: var(--blue); }
	.qcustom__r { margin-left: auto; text-align: right; font-size: 13px; color: var(--ink-soft); }
	.qcustom__r b { font-family: var(--font-display); font-size: 19px; color: var(--ink); display: block; letter-spacing: -.02em; }
	.pv__ship { margin-top: 12px; }

	/* tre riquadri */
	.trust { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.tc { display: flex; align-items: center; gap: 14px; border-radius: 18px; padding: 14px 16px; background: var(--sky); min-width: 0; }
	.tc--y { background: #fff1c9; }
	.tc--g { background: var(--green-soft); grid-column: 1 / -1; }
	.tc__ico { flex: none; width: 52px; height: 52px; border-radius: 14px; background: #fff; display: grid; place-items: center; font-size: 24px; box-shadow: 0 1px 3px rgba(5, 5, 56, .08); }
	.tc__ico img { width: 40px; height: auto; }
	.tc__l, .tc__s { display: block; }
	.tc__l { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
	.tc__v { display: block; font-family: var(--font-display); font-weight: 800; font-size: 18px; letter-spacing: -.02em; line-height: 1.2; margin: 1px 0; }
	.tc__s { font-size: 12.5px; color: var(--ink-soft); line-height: 1.35; }

	/* dashboard (test): totale e dettaglio del calcolo */
	.pv__test { margin-top: 20px; display: grid; gap: 10px; }
	.pv__testtot { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; background: #f4b400; border-radius: 16px; padding: 14px 18px; }
	.pv__testtot span { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
	.pv__testtot b { font-family: var(--font-display); font-weight: 800; font-size: 28px; letter-spacing: -.03em; }
	.pv__testtot em { font-style: normal; font-size: 13px; margin-left: auto; }
	.test-detail { font-size: 12.5px; color: var(--muted); line-height: 1.6; border-top: 1px dashed var(--line); padding-top: 10px; }

	/* barra d'acquisto */
	.pv__buy { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; background: #f4b400; color: #0b0b3b; box-shadow: 0 -8px 28px rgba(90, 65, 0, .28); padding-bottom: env(safe-area-inset-bottom); transition: transform .28s ease; font-variant-numeric: tabular-nums; }
	.pv__buy.is-off { transform: translateY(115%); }
	.pv__buyin { width: min(100% - 40px, 1240px); margin-inline: auto; display: flex; align-items: center; gap: 22px; height: 84px; }
	.buy__sum { min-width: 0; flex: 1; }
	.buy__sum b { display: block; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.buy__sum span { display: block; font-size: 13px; color: rgba(11, 11, 59, .82); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.buy__ship { font-size: 13px; color: rgba(11, 11, 59, .82); line-height: 1.35; white-space: nowrap; }
	.buy__ship b { display: block; color: #0b0b3b; }
	.buy__price { text-align: right; white-space: nowrap; }
	.buy__price b { font-family: var(--font-display); font-weight: 800; font-size: 30px; letter-spacing: -.03em; line-height: 1; display: block; }
	.buy__price span { font-size: 12.5px; color: rgba(11, 11, 59, .82); }
	.cta { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; background: #0e8bff; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 16px; text-transform: uppercase; letter-spacing: -.01em; padding: 17px 26px; box-shadow: 0 4px 0 #0768c4; text-shadow: 0 1px 2px rgba(0, 45, 110, .45); cursor: pointer; white-space: nowrap; transition: transform .1s, filter .1s; }
	.cta:hover { filter: brightness(1.04); transform: translateY(-1px); }
	.cta__m { display: none; }
	:global(body:has(.pv__buy)) { padding-bottom: 84px; }

	@media (max-width: 900px) {
		.pv { display: block; margin-top: 14px; }
		/* l'anteprima resta in alto mentre si scorre: del motore si vede solo il palco; i suoi comandi si aprono con "Regola" */
		.pv__posto { height: var(--palco); }
		.pv__stage.is-regola .pv__posto { height: auto; }
		.pv__box.is-fisso { position: fixed; }
		.pv__box { z-index: 30; height: var(--palco); overflow: hidden; border-radius: 22px; box-shadow: 0 6px 16px rgba(5, 5, 56, .12); background: #eef0f6; }
		.pv__stage.is-regola .pv__box { position: relative; top: auto; height: auto; overflow: visible; box-shadow: none; background: none; }
		.pv__stage { display: contents; }   /* cosi' l'anteprima resta agganciata per tutta la lunghezza del preventivatore */
		.grp__t { font-size: 16.5px; white-space: nowrap; }
		.grp__h { flex-wrap: wrap; row-gap: 6px; }
		.vat button { font-size: 11px; padding: 4px 7px; }
		.pv__tools { margin-top: 10px; border-radius: 14px; padding: 9px 10px; }
		.pv__regola { display: block; width: 100%; margin-top: 8px; border: 2px solid var(--line); background: #fff; border-radius: 12px; padding: 10px; font: inherit; font-weight: 700; font-size: 14px; color: var(--ink); cursor: pointer; }
		.pv__drop { min-height: 210px; border-radius: 18px; }
		.pv__dropico { width: 48px; height: 48px; border-radius: 14px; margin-bottom: 8px; }
		.pv__drop b { font-size: 19px; }
		.pv__drops { font-size: 13px; }
		.pv__panel { padding-top: 18px; }
		.tiles { display: flex; overflow-x: auto; margin: 0 -16px; padding: 10px 16px 4px; scroll-snap-type: x proximity; scrollbar-width: none; }
		.tiles::-webkit-scrollbar { display: none; }
		.tile { flex: none; width: 98px; scroll-snap-align: start; }
		.q { grid-template-columns: 1fr auto; row-gap: 5px; padding: 11px 12px; gap: 8px; }
		.q__n, .q__tot { font-size: 18px; }
		.q__mid { grid-column: 1 / -1; grid-row: 2; flex-wrap: nowrap; gap: 6px; }
		.qcustom { flex-wrap: wrap; }
		.trust { grid-template-columns: 1fr; }
		.tc--g { grid-column: auto; }
		.pv__buyin { gap: 12px; height: 72px; width: min(100% - 28px, 1240px); }
		.buy__sum, .buy__ship { display: none; }
		.buy__price { text-align: left; flex: 1; }
		.buy__price b { font-size: 25px; }
		.cta { padding: 15px 18px; font-size: 15px; }
		.cta__d { display: none; }
		.cta__m { display: inline; }
		:global(body:has(.pv__buy)) { padding-bottom: 72px; }
	}
	@media (prefers-reduced-motion: reduce) { .pv__buy { transition: none; } }
</style>
