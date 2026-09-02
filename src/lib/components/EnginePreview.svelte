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
		w = 0,
		h = 0,
		panel = false,
		stage = 380,
		onrender
	}: {
		file: File | null;
		forma?: string;
		materiale?: string;
		finitura?: string;
		prodotto?: string;
		w?: number;
		h?: number;
		panel?: boolean;
		stage?: number;
		onrender?: (s: { png: string | null; w: number; h: number }) => void;
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
		if (w > 0) q.set('w', String(w));
		if (h > 0) q.set('h', String(h));
		if (panel) {
			q.set('panel', '1');
			q.set('stage', String(stage));
		}
		return `/preprint/index.html?${q.toString()}`;
	}

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

	// ricarica il motore quando cambia una qualsiasi impostazione (con un piccolo debounce sulle misure).
	// Legge solo le props: lo stato interno è in untrack, così l'effetto non si riesegue da solo.
	let lastSrc = '';
	$effect(() => {
		const next = buildSrc();
		const f = file;
		untrack(() => {
			if (!f) {
				src = '';
				ready = false;
				lastSrc = '';
				sentFor = null;
				return;
			}
			if (next === lastSrc && sentFor === f) return;
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(() => {
				busy = true;
				ready = false;
				sentFor = null;
				lastSrc = next;
				if (src === next) send(true);
				else src = next;
			}, 250);
		});
	});

	function onMessage(e: MessageEvent) {
		if (e.origin !== location.origin) return;
		const d = e.data ?? {};
		if (d.source !== 'preprint') return;
		if (d.type === 'ready') send();
		if (d.type === 'size' && panel && d.detail?.h) contentH = d.detail.h;
		if (d.type === 'render' && d.detail?.png) {
			busy = false;
			ready = true;
			clearTimeout(retry);
			onrender?.({ png: d.detail.png, w: d.detail.w ?? 0, h: d.detail.h ?? 0 });
		}
	}
</script>

<svelte:window onmessage={onMessage} />

{#if file && src}
	{#if panel}
		<div class="engine-panel" style="height:{height}px">
			<iframe bind:this={frame} class="engine engine--panel" class:is-ready={ready} {src} title="Anteprima e regolazioni del tuo adesivo" onload={() => send()}></iframe>
			{#if busy}<div class="stage__busy" style="top:{stage / 2}px"><span class="spinner spinner--dark"></span> Genero l’anteprima…</div>{/if}
		</div>
	{:else}
		<iframe bind:this={frame} class="engine engine--live" class:is-ready={ready} {src} title="Anteprima del tuo adesivo" tabindex="-1" onload={() => send()}></iframe>
		{#if busy}<div class="stage__busy"><span class="spinner spinner--dark"></span> Genero l’anteprima…</div>{/if}
	{/if}
{/if}
