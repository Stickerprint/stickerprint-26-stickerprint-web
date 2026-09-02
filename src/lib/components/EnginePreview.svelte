<script lang="ts">
	/**
	 * Anteprima viva generata dal motore preprint (static/preprint/index.html) in un iframe:
	 * riceve file + combinazione, mostra il canvas animato e riporta l'istantanea.
	 */
	let {
		file,
		forma = 'sagomato',
		materiale = 'bianco',
		prodotto = 'sticker',
		w = 0,
		h = 0,
		onrender
	}: {
		file: File | null;
		forma?: string;
		materiale?: string;
		prodotto?: string;
		w?: number;
		h?: number;
		onrender?: (s: { png: string | null; w: number; h: number }) => void;
	} = $props();

	let frame = $state<HTMLIFrameElement | undefined>();
	let src = $state('');
	let busy = $state(false);
	let ready = $state(false);
	let sentFor: File | null = null;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;

	function buildSrc() {
		const q = new URLSearchParams({ embed: '1', forma, materiale, prodotto });
		if (w > 0) q.set('w', String(w));
		if (h > 0) q.set('h', String(h));
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

	// ricarica il motore quando cambia una qualsiasi impostazione (con un piccolo debounce sulle misure)
	$effect(() => {
		const next = buildSrc();
		file; // dipendenza
		if (!file) {
			src = '';
			ready = false;
			return;
		}
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(() => {
			if (next !== src || sentFor !== file) {
				busy = true;
				ready = false;
				sentFor = null;
				src = next;
				if (frame && frame.getAttribute('src') === next) send(true);
			}
		}, next === src ? 0 : 250);
	});

	function onMessage(e: MessageEvent) {
		if (e.origin !== location.origin) return;
		const d = e.data ?? {};
		if (d.source !== 'preprint') return;
		if (d.type === 'ready') send();
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
	<iframe bind:this={frame} class="engine engine--live" class:is-ready={ready} {src} title="Anteprima del tuo adesivo" tabindex="-1" onload={() => send()}></iframe>
	{#if busy}<div class="stage__busy"><span class="spinner spinner--dark"></span> Genero l’anteprima…</div>{/if}
{/if}
