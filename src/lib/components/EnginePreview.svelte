<script lang="ts">
	import { untrack } from 'svelte';
	/**
	 * Anteprima viva generata dal motore preprint (static/preprint/index.html) in un iframe:
	 * riceve file + combinazione, mostra il canvas animato e riporta l'istantanea.
	 * Con `panel` mostra anche i comandi del motore sotto l'anteprima (bordo, angoli, zoom, sfondo)
	 * e adatta l'altezza dell'iframe al contenuto.
	 */
	let {
		file,
		forma = 'sagomato',
		materiale = 'bianco',
		finitura = 'lucida',
		prodotto = 'sticker',
		foglio = false,
		rilievo = false,
		vetro = false,
		w = 0,
		h = 0,
		panel = false,
		stage = 380,
		showCut = true,
		noang = false,
		hires = false,
		noombra = false,
		live = false,
		warm = false,
		busy = $bindable(false),
		onrender
	}: {
		file: File | null;
		forma?: string;
		materiale?: string;
		finitura?: string;
		prodotto?: string;
		foglio?: boolean;
		rilievo?: boolean;
		vetro?: boolean;
		w?: number;
		h?: number;
		panel?: boolean;
		stage?: number;
		showCut?: boolean;
		noang?: boolean;
		hires?: boolean;
		noombra?: boolean;
		/** anche prodotto e foglio cambiano via messaggio, senza ricaricare il motore (anteprima in home) */
		live?: boolean;
		/** il motore si carica PRIMA che ci sia un file: quando il cliente lo sceglie e' gia' pronto */
		warm?: boolean;
		busy?: boolean;
		onrender?: (s: { png: string | null; name?: string | null; shape?: string | null; w: number; h: number; srcMM: { w: number; h: number } | null; cut?: { x: number; y: number; w: number; h: number } | null; view?: { zoom: number; dx: number; dy: number } | null; palette?: { hex: string; img?: string }[]; palIdx?: number; rimuovi?: boolean; foglio?: { n: number; cols: number; rows: number; w: number; h: number } | null }) => void;
	} = $props();

	let frame = $state<HTMLIFrameElement | undefined>();
	let src = $state('');
	let ready = $state(false);
	let up = false; // il motore ha risposto 'ready' (caricato e in ascolto), anche se non ha ancora un file
	let contentH = $state(0);
	const height = $derived(Math.max(stage, contentH));
	let sentFor: File | null = null;
	let acked = false; // il motore ha confermato di aver ricevuto il file
	let retry: ReturnType<typeof setTimeout> | undefined;
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;

	function buildSrc() {
		const q = new URLSearchParams({ embed: '1', forma, materiale, prodotto, lamina: finitura });
		if (foglio) q.set('foglio', '1');
		if (rilievo) q.set('rilievo', '1');
		if (vetro) q.set('vetro', '1');
		if (noang) q.set('noang', '1');
		if (hires) q.set('hires', '1');
		if (noombra) q.set('noombra', '1');
		if (w > 0) q.set('w', String(w));
		if (h > 0) q.set('h', String(h));
		if (panel) {
			q.set('panel', '1');
			/* altezza massima del palco: il motore la usa come tetto, cosi' l'anteprima non diventa gigante */
			q.set('palco', String(Math.max(160, Math.round(stage))));
			q.set('stage', String(stage));
		}
		return `/preprint/index.html?${q.toString()}`;
	}

	/** comandi della barra del sito (colore di sfondo, rimuovi sfondo) */
	export function post(type: string, detail: Record<string, unknown> = {}) {
		frame?.contentWindow?.postMessage({ source: 'sito', type, ...detail }, location.origin);
	}
	/** Stickerprint Studio: chiede al motore mockup ('mockup') o grafica di stampa + tracciato ('print') */
	type StudioExport = { blob?: Blob; soggetti?: { pathD: string; x: number; y: number; w: number; h: number; nodi: number }[]; foglio?: { w: number; h: number }; unione?: number; cutW?: number; cutH?: number; bleed?: number; pathD?: string; polys?: [number, number][][] | null; name?: string | null; shape?: string; dpi?: number; border?: number; stato?: Record<string, unknown> };
	const pending = new Map<string, { ok: (v: StudioExport) => void; ko: (e: Error) => void }>();
	export function studio(what: 'mockup' | 'print' | 'geom' | 'stato' | 'applica' | 'soggetti', opts: Record<string, unknown> = {}): Promise<StudioExport> {
		const id = Math.random().toString(36).slice(2);
		return new Promise((ok, ko) => {
			if (!frame?.contentWindow) return ko(new Error('Anteprima non pronta'));
			pending.set(id, { ok, ko });
			frame.contentWindow.postMessage({ source: 'sito', type: 'studio', what, id, ...opts }, location.origin);
			setTimeout(() => { if (pending.delete(id)) ko(new Error('Il motore non ha risposto in tempo')); }, 120000);
		});
	}
	// un file nuovo (Cambia file) si manda al motore gia' caricato, senza ricaricarlo
	$effect(() => {
		const f = file;
		untrack(() => { if (f && src && (ready || (warm && up)) && sentFor !== f) { busy = true; if (warm) ready = false; send(true); } });
	});
	function send(force = false) {
		if (!file || !frame?.contentWindow) return;
		if (sentFor === file && !force) return;
		sentFor = file;
		acked = false;
		fly();
		frame.contentWindow.postMessage({ source: 'sito', type: 'file', file }, location.origin);
		clearTimeout(retry);
		// il file si rimanda SOLO se il motore non conferma la ricezione (messaggio perso):
		// un file grande puo' restare in lavorazione ben oltre i 5 s, e rimandarlo lo faceva
		// caricare due volte (la seconda riproponeva la misura del file al posto di quella del sito)
		retry = setTimeout(() => {
			if (!acked && sentFor === file) send(true);
		}, 5000);
	}

	// Il motore si carica UNA volta per file/prodotto. Sagoma, materiale, lamina e
	// misura si mandano via messaggio: il file resta caricato e l'anteprima
	// non sparisce mai, si aggiorna al posto suo in pochi decimi di secondo.
	let lastSrc = '';
	/* UNA richiesta alla volta: finche' il motore non ha risposto (nuova anteprima) non gliene mando altre; quando risponde,
	   se nel frattempo la scelta e' cambiata gli mando solo l'ULTIMA. Prima i clic fatti in fretta finivano tutti in coda nel
	   motore, che li eseguiva uno a uno (oltre un secondo l'uno su telefono): l'anteprima sembrava bloccata. */
	let inFlight = false;
	let postedCfg = ''; // l'ultima combinazione davvero mandata al motore (o quella dell'indirizzo con cui e' stato caricato)
	let flightTimer: ReturnType<typeof setTimeout> | undefined;
	function fly() { inFlight = true; clearTimeout(flightTimer); flightTimer = setTimeout(() => { inFlight = false; flush(); }, 12000); } // mai in stallo se una risposta si perde
	function postCfg(cfg: string) {
		if (!frame?.contentWindow) return;
		sentCfg = cfg; postedCfg = cfg; busy = !!file; cfgSentAt = performance.now(); fly();
		frame.contentWindow.postMessage({ source: 'sito', type: 'config', config: JSON.parse(cfg) }, location.origin);
	}
	/** manda al motore la scelta attuale, se e' diversa dall'ultima mandata e il motore e' libero */
	function flush() {
		if (inFlight || !src || !(ready || (warm && up))) return;
		const cfg = cfgNow();
		if (cfg !== postedCfg) postCfg(cfg);
	}
	let srcCfg = ''; // la combinazione con cui il motore e' stato caricato (nell'indirizzo)
	const cfgNow = () => JSON.stringify({ forma, materiale, lamina: finitura, w, h, prodotto, foglio, rilievo, vetro, noang });
	let cfgTimer: ReturnType<typeof setTimeout> | undefined;
	let cfgSentAt = 0;
	let sentCfg = '';
	const resentFor = new WeakMap<File, number>(); // quante volte la misura del sito e' stata rimandata per quel file
	$effect(() => {
		const f = file;
		/* live: prodotto e foglio NON ricaricano il motore (li gestisce il messaggio 'config', come sagoma e materiale) */
		const key = live ? `${rilievo}|${vetro}|${panel}|${stage}` : `${prodotto}|${foglio}|${rilievo}|${vetro}|${panel}|${stage}`;
		const next = f || warm ? key : '';
		untrack(() => {
			if (!f && !warm) { src = ''; ready = false; up = false; lastSrc = ''; sentFor = null; sentCfg = ''; return; }
			if (!f) { ready = false; sentFor = null; busy = false; }   // a caldo senza file: il motore resta caricato
			if (next !== lastSrc) { lastSrc = next; sentFor = null; sentCfg = ''; busy = !!f; ready = false; up = false; src = buildSrc(); srcCfg = cfgNow(); postedCfg = srcCfg; inFlight = false; }
		});
	});
	$effect(() => {
		const cfg = JSON.stringify({ forma, materiale, lamina: finitura, w, h, prodotto, foglio, rilievo, vetro, noang });
		untrack(() => {
			if (!file || !src || cfg === sentCfg) return;
			clearTimeout(cfgTimer);
			if (file && (ready || up)) busy = true; // il messaggio di attesa compare subito, anche se la richiesta parte dopo
			cfgTimer = setTimeout(flush, 60);
		});
	});

	// occhio: mostra/nasconde la linea di taglio senza ricaricare
	$effect(() => {
		const on = showCut;
		untrack(() => frame?.contentWindow?.postMessage({ source: 'sito', type: 'cut', on }, location.origin));
	});

	function onMessage(e: MessageEvent) {
		if (e.origin !== location.origin) return;
		const d = e.data ?? {};
		if (d.source !== 'preprint') return;
		if (d.type === 'ready') {
			const first = !up; up = true;
			/* a caldo: le scelte fatte mentre il motore si caricava (diverse da quelle nell'indirizzo) vanno mandate subito */
			if (first && warm && !file) flush();
			send();
		}
		if (d.type === 'ricevuto') { acked = true; clearTimeout(retry); }
		if (d.type === 'studio' && d.detail?.id) {
			const p = pending.get(d.detail.id);
			if (p) { pending.delete(d.detail.id); if (d.detail.ok) p.ok(d.detail); else p.ko(new Error(d.detail.error || 'Errore del motore')); }
		}
		if (d.type === 'size' && panel && d.detail?.h) contentH = d.detail.h;
		if (d.type === 'render' && d.detail?.png) {
			if (!file) return;
			if (cfgSentAt) { console.debug('[anteprima] aggiornata in', Math.round(performance.now() - cfgSentAt), 'ms'); cfgSentAt = 0; }
			ready = true;
			inFlight = false; clearTimeout(flightTimer);
			const stale = cfgNow() !== postedCfg; // l'anteprima arrivata e' di una scelta gia' superata
			busy = stale;
			sentCfg = postedCfg;
			clearTimeout(retry);
			/* al caricamento il motore propone una misura sua (dalle proporzioni del file); sulle forme
			   geometriche la misura e' quella del sito e si rimanda subito (una volta per file) */
			const rw = Number(d.detail.w ?? 0), rh = Number(d.detail.h ?? 0);
			const cur = file;
			const n = cur ? (resentFor.get(cur) ?? 0) : 9;
			if (cur && w > 0 && h > 0 && forma !== 'sagomato' && n < 3 && (Math.abs(rw - w) > 0.6 || Math.abs(rh - h) > 0.6)) {
				resentFor.set(cur, n + 1);
				console.debug('[anteprima] misura del sito rimandata al motore', { w, h, rw, rh });
				postCfg(cfgNow());
			}
			onrender?.({ png: d.detail.png, name: d.detail.name ?? null, shape: d.detail.shape ?? null, w: d.detail.w ?? 0, h: d.detail.h ?? 0, srcMM: d.detail.srcMM ?? null, cut: d.detail.cut ?? null, view: d.detail.view ?? null, palette: d.detail.palette ?? [], palIdx: d.detail.palIdx ?? 0, rimuovi: !!d.detail.rimuovi, foglio: d.detail.foglio ?? null });
			frame?.contentWindow?.postMessage({ source: 'sito', type: 'cut', on: showCut }, location.origin);
			if (stale) flush();
		}
	}
</script>

<svelte:window onmessage={onMessage} />

{#if (file || warm) && src}
	{#if panel}
		<div class="engine-panel" style="height:{height}px">
			<iframe bind:this={frame} class="engine engine--panel" class:is-ready={ready} {src} title="Anteprima e regolazioni del tuo adesivo" onload={() => send()}></iframe>
			{#if busy}<div class="stage__busy" class:stage__busy--soft={ready} style="top:{ready ? 12 : stage / 2}px"><span class="spinner spinner--dark"></span> {ready ? 'Aggiorno…' : 'Genero l’anteprima…'}</div>{/if}
		</div>
	{:else}
		<iframe bind:this={frame} class="engine engine--live" class:is-ready={ready} {src} title="Anteprima del tuo adesivo" tabindex="-1" onload={() => send()}></iframe>
		{#if busy}<div class="stage__busy" class:stage__busy--soft={ready}><span class="spinner spinner--dark"></span> {ready ? 'Aggiorno…' : 'Genero l’anteprima…'}</div>{/if}
	{/if}
{/if}
