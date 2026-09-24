<script lang="ts">
	/**
	 * Lente dello studio: il pezzo a tutto schermo con il tracciato di taglio sopra, zoom libero
	 * (rotella o cursore), trascinamento per spostarsi, e i due selettori del tracciato.
	 * Serve a guardare gli angoli da vicino prima di mandare in macchina.
	 */
	let {
		open = false,
		img = '',
		w = 0,
		h = 0,
		paths = [] as { d: string; x?: number; y?: number }[],
		color = '#ec008c',
		nodes = 0,
		semplifica = $bindable(50),
		morbido = $bindable(50),
		busy = false,
		onclose = () => {}
	}: {
		open?: boolean; img?: string; w?: number; h?: number;
		paths?: { d: string; x?: number; y?: number }[];
		color?: string; nodes?: number; semplifica?: number; morbido?: number; busy?: boolean;
		onclose?: () => void;
	} = $props();

	let zoom = $state(1);
	let dx = $state(0);
	let dy = $state(0);
	let box = $state<HTMLDivElement | undefined>();
	let drag: { x: number; y: number; dx: number; dy: number } | null = null;

	$effect(() => {
		if (open) { zoom = 1; dx = 0; dy = 0; }
	});

	function wheel(e: WheelEvent) {
		e.preventDefault();
		const r = box?.getBoundingClientRect();
		if (!r) return;
		/* si ingrandisce dove sta il puntatore, come in Illustrator */
		const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
		const k = Math.exp(-e.deltaY / 400);
		const z2 = Math.min(40, Math.max(1, zoom * k));
		const f = z2 / zoom;
		dx = cx - (cx - dx) * f;
		dy = cy - (cy - dy) * f;
		zoom = z2;
	}
	function down(e: PointerEvent) {
		drag = { x: e.clientX, y: e.clientY, dx, dy };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		dx = drag.dx + (e.clientX - drag.x);
		dy = drag.dy + (e.clientY - drag.y);
	}
	const up = () => (drag = null);
	const adatta = () => { zoom = 1; dx = 0; dy = 0; };
	/* il tratto resta sempre sottile uguale, anche ingrandendo */
	const tratto = $derived(Math.max(w, h) / 700 / zoom);
</script>

{#if open}
	<div class="lente" role="dialog" aria-label="Tracciato di taglio da vicino">
		<div class="lente__top">
			<b>Tracciato da vicino</b>
			<span class="lente__nodi">{nodes} punti di ancoraggio</span>
			<span class="lente__sp">zoom {zoom.toFixed(1)}×</span>
			<button type="button" class="lente__x" onclick={onclose} aria-label="Chiudi">✕</button>
		</div>

		<div
			class="lente__box"
			bind:this={box}
			onwheel={wheel}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<div class="lente__art" style="--ar:{w} / {h}; transform: translate({dx}px, {dy}px) scale({zoom})">
				{#if img}<img src={img} alt="Pezzo" />{/if}
				<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet">
					{#each paths as p, i (i)}
						<path d={p.d} transform={p.x || p.y ? `translate(${p.x ?? 0} ${p.y ?? 0})` : undefined} fill="none" stroke={color} stroke-width={tratto} vector-effect="non-scaling-stroke" />
					{/each}
				</svg>
			</div>
			{#if busy}<span class="lente__wait">Ricalcolo il tracciato…</span>{/if}
		</div>

		<div class="lente__cmd">
			<label class="lente__sl">
				<span>Zoom</span>
				<input type="range" min="1" max="40" step="0.1" bind:value={zoom} />
				<button type="button" class="lente__fit" onclick={adatta}>adatta</button>
			</label>
			<label class="lente__sl">
				<span>Semplifica tracciato <em>{semplifica}</em></span>
				<input type="range" min="0" max="100" step="1" bind:value={semplifica} />
				<small>a destra meno punti e linee pulite (via le zigrinature), a sinistra più fedele al disegno</small>
			</label>
			<label class="lente__sl">
				<span>Morbido <em>{morbido}</em></span>
				<input type="range" min="0" max="100" step="1" bind:value={morbido} />
				<small>a destra angoli tondi e linee morbide, a sinistra sagoma spigolosa e dettagliata</small>
			</label>
		</div>
	</div>
{/if}

<style>
	.lente { position: fixed; inset: 0; z-index: 90; display: grid; grid-template-rows: auto 1fr auto; background: rgba(8, 8, 30, .93); color: #fff; }
	.lente__top { display: flex; align-items: center; gap: 14px; padding: 12px 18px; font: 600 14px Montserrat, system-ui, sans-serif; border-bottom: 1px solid rgba(255, 255, 255, .12); }
	.lente__nodi, .lente__sp { font-weight: 500; color: #b9bee6; }
	.lente__x { margin-left: auto; background: none; border: 0; color: #fff; font-size: 20px; cursor: pointer; line-height: 1; }
	.lente__box { position: relative; overflow: hidden; touch-action: none; cursor: grab; display: grid; place-items: center; }
	.lente__box:active { cursor: grabbing; }
	.lente__art { position: relative; width: min(88vw, 78vh); aspect-ratio: var(--ar, 1); display: grid; place-items: center; }
	.lente__art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
	.lente__art svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	.lente__wait { position: absolute; top: 12px; left: 16px; background: rgba(255, 255, 255, .14); border-radius: 8px; padding: 5px 10px; font: 600 12px Montserrat, system-ui, sans-serif; }
	.lente__cmd { display: flex; flex-wrap: wrap; gap: 22px; padding: 14px 18px 20px; border-top: 1px solid rgba(255, 255, 255, .12); }
	.lente__sl { display: flex; flex-direction: column; gap: 5px; min-width: 260px; flex: 1 1 260px; font: 600 13px Montserrat, system-ui, sans-serif; }
	.lente__sl em { font-style: normal; color: var(--yellow, #ffc93c); margin-left: 6px; }
	.lente__sl small { font-weight: 500; font-size: 11.5px; color: #b9bee6; }
	.lente__sl input[type='range'] { accent-color: var(--yellow, #ffc93c); }
	.lente__fit { align-self: flex-start; background: rgba(255, 255, 255, .14); border: 0; color: #fff; border-radius: 8px; padding: 4px 10px; font: 600 12px Montserrat, system-ui, sans-serif; cursor: pointer; }
	@media (max-width: 700px) { .lente__art { width: 92vw; } }
</style>
