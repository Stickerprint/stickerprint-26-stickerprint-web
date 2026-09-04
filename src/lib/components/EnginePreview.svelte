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
		w = 0,
		h = 0,
		panel = false,
		stage = 380,
		showCut = true,
		onrender
	}: {
		file: File | null;
		forma?: string;
		materiale?: string;
		finitura?: string;
		prodotto?: string;
		foglio?: boolean;
		rilievo?: boolean;
		w?: number;
		h?: number;
		panel?: boolean;
		stage?: number;
		showCut?: boolean;
		onrender?: (s: { png: string | null; w: number; h: number; srcMM: { w: number; h: number } | null; palette?: { hex: string; img?: string }[]; palIdx?: number; rimuovi?: boolean; foglio?: { n: number; cols: number; rows: number; w: number; h: number } | null }) => void;
	} = $props();

	let frame = $state<HTMLIFrameElement | undefined>();
	let src = $state('');
	let busy = $state(false);
	let ready = $state(false);
	let contentH = $state(0);
	const height = $derived(Math.max(stage, contentH));
	let sentFor: File | null = null;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;

	function buildSrc() {
		const q = new URLSearchParams({ embed: '1', forma, materiale, prodotto, lamina: finitura });
		if (foglio) q.set('foglio', '1');
		if (rilievo) q.set('rilievo', '1');
		if (w > 0) q.set('w', String(w));
		if (h > 0) q.set('h', String(h));
		if (panel) {
			q.set('panel', '1');
			q.set('stage', String(stage));
		}
		return `/preprint/index.html?${q.toString()}`;
	}

	/** comandi della barra del sito (colore di sfondo, rimuovi sfondo) */
	export function post(type: string, detail: Record<string, unknown> = {}) {
		frame?.contentWindow?.postMessage({ source: 'sito', type, ...detail }, location.origin);
	}
	// un file nuovo (Cambia file) si manda al motore gia' caricato, senza ricaricarlo
	$effect(() => {
		const f = file;
		untrack(() => { if (f && src && ready && sentFor !== f) { busy = true; send(true); } });
	});
	function send(force = false) {
		if (!file || !frame?.contentWindow) return;
		if (sentFor === file && !force) return;
		sentFor = file;
		frame.contentWindow.postMessage({ source: 'sito', type: 'file', file }, location.origin);
		clearTimeout(retry);
		retry = setTimeout(() => {
			if (busy && sentFor === file) send(true);
		}, 5000);
	}

	// Il motore si carica UNA volta per file/prodotto. Sagoma, materiale, lamina e
	// misura si mandano via messaggio: il file resta caricato e l'anteprima
	// non sparisce mai, si aggiorna al posto suo in pochi decimi di secondo.
	let lastSrc = '';
	let cfgTimer: ReturnType<typeof setTimeout> | undefined;
	let cfgSentAt = 0;
	let sentCfg = '';
	$effect(() => {
		const f = file;
		const next = f ? `${prodotto}|${foglio}|${rilievo}|${panel}|${stage}` : '';
		untrack(() => {
			if (!f) { src = ''; ready = false; lastSrc = ''; sentFor = null; sentCfg = ''; return; }
			if (next !== lastSrc) { lastSrc = next; sentFor = null; sentCfg = ''; busy = true; ready = false; src = buildSrc(); }
		});
	});
	$effect(() => {
		const cfg = JSON.stringify({ forma, materiale, lamina: finitura, w, h, prodotto, foglio, rilievo });
		untrack(() => {
			if (!file || !src || cfg === sentCfg) return;
			clearTimeout(cfgTimer);
			cfgTimer = setTimeout(() => {
				if (!frame?.contentWindow || !ready) return;
				sentCfg = cfg;
				busy = true;
				cfgSentAt = performance.now();
				frame.contentWindow.postMessage({ source: 'sito', type: 'config', config: JSON.parse(cfg) }, location.origin);
			}, 60);
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
		if (d.type === 'ready') send();
		if (d.type === 'size' && panel && d.detail?.h) contentH = d.detail.h;
		if (d.type === 'render' && d.detail?.png) {
			if (cfgSentAt) { console.debug('[anteprima] aggiornata in', Math.round(performance.now() - cfgSentAt), 'ms'); cfgSentAt = 0; }
			busy = false;
			ready = true;
			sentCfg = JSON.stringify({ forma, materiale, lamina: finitura, w, h, prodotto, foglio, rilievo });
			clearTimeout(retry);
			onrender?.({ png: d.detail.png, w: d.detail.w ?? 0, h: d.detail.h ?? 0, srcMM: d.detail.srcMM ?? null, palette: d.detail.palette ?? [], palIdx: d.detail.palIdx ?? 0, rimuovi: !!d.detail.rimuovi, foglio: d.detail.foglio ?? null });
			frame?.contentWindow?.postMessage({ source: 'sito', type: 'cut', on: showCut }, location.origin);
		}
	}
</script>

<svelte:window onmessage={onMessage} />

{#if file && src}
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
