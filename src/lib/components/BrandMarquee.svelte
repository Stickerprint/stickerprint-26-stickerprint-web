<script lang="ts">
	/**
	 * Fascia dei loghi che scorre (home e pagina Aziende).
	 *
	 * Su iPhone i loghi comparivano e sparivano. Un'animazione CSS con transform trasforma il nastro in un unico
	 * livello grafico: il nastro e' largo migliaia di pixel, che sul telefono (schermo a 3x) superano la dimensione
	 * massima di un livello, e Safari lo svuota. Succedeva sia con il nastro unico + mask-image, sia con due nastri.
	 *
	 * Qui non c'e' nessuna animazione CSS: il contenitore e' un normale riquadro che scorre (overflow) e lo si fa
	 * avanzare cambiando scrollLeft a ogni fotogramma. Lo scorrimento e' gestito a piastrelle dal browser, quindi
	 * la larghezza non e' piu' un problema. I loghi sono ripetuti due volte: arrivati a meta' si riparte da capo.
	 * Si ferma quando la fascia non e' sullo schermo o la scheda e' nascosta; chi ha chiesto meno animazioni la
	 * scorre col dito.
	 */
	import { onMount } from 'svelte';
	import { BRANDS } from '$lib/brands';
	const fallback = (e: Event, name: string) => { const el = e.currentTarget as HTMLImageElement; const s = document.createElement('span'); s.textContent = name; el.replaceWith(s); };
	const SPEED = 38; // pixel al secondo

	let box = $state<HTMLDivElement | undefined>();
	let manual = $state(false);

	onMount(() => {
		const el = box;
		if (!el) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { manual = true; return; }
		let raf = 0, last = 0, pos = 0, visible = true, paused = false;
		const half = () => (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
		const tick = () => {
			raf = requestAnimationFrame(tick);
			const t = performance.now(); // l'orologio vero: il tempo passato da requestAnimationFrame in certi casi non avanza
			const dt = last ? Math.min(64, t - last) : 0;
			last = t;
			if (!visible || paused || document.hidden) return;
			const h = half();
			if (h <= el.clientWidth) return; // loghi non ancora caricati: niente da far scorrere
			pos += (SPEED * dt) / 1000;
			if (pos >= h) pos -= h;
			el.scrollLeft = pos;
		};
		raf = requestAnimationFrame(tick);
		const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); last = 0; }, { rootMargin: '120px' });
		io.observe(el);
		/* il dito (o il mouse) ferma lo scorrimento; alla ripresa si riparte da dove e' stato lasciato */
		const stop = () => { paused = true; };
		const go = () => { pos = el.scrollLeft % Math.max(1, half()); paused = false; last = 0; };
		el.addEventListener('touchstart', stop, { passive: true });
		el.addEventListener('touchend', go, { passive: true });
		el.addEventListener('touchcancel', go, { passive: true });
		return () => { cancelAnimationFrame(raf); io.disconnect(); el.removeEventListener('touchstart', stop); el.removeEventListener('touchend', go); el.removeEventListener('touchcancel', go); };
	});
</script>

<div class="bm" aria-hidden="true">
	<div class="bm__box" class:is-manual={manual} bind:this={box}>
		{#each [0, 1] as t (t)}
			<div class="bm__track">
				{#each BRANDS as b (b.name)}
					{#if b.img}<img src="/images/brands/{b.img}" alt={b.name} title={b.name} height="36" loading="eager" decoding="async" draggable="false" onerror={(e) => fallback(e, b.name)} />{:else}<span>{b.name}</span>{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.bm { --gap: 64px; --fade: var(--paper, #fff); position: relative; margin-top: 52px; width: 100%; opacity: 1; display: block; }
	.bm::before, .bm::after { content: ""; position: absolute; top: 0; bottom: 0; width: 9%; z-index: 1; pointer-events: none; }
	.bm::before { left: 0; background: linear-gradient(90deg, var(--fade), transparent); }
	.bm::after { right: 0; background: linear-gradient(270deg, var(--fade), transparent); }
	/* riquadro che scorre: nessuna trasformazione, nessun livello grafico gigante */
	.bm__box { display: flex; flex-wrap: nowrap; overflow-x: hidden; overflow-y: hidden; width: 100%; scrollbar-width: none; -webkit-overflow-scrolling: auto; }
	.bm__box::-webkit-scrollbar { display: none; }
	.bm__box.is-manual { overflow-x: auto; }
	.bm__track { flex: 0 0 auto; display: flex; align-items: center; gap: var(--gap); padding-right: var(--gap); }
	.bm__track img { height: 36px; width: auto; max-width: 180px; object-fit: contain; flex: 0 0 auto; display: block; user-select: none; -webkit-user-drag: none; }
	.bm__track span { font-weight: 800; font-size: 22px; color: var(--ink); letter-spacing: -0.02em; white-space: nowrap; }
	@media (max-width: 700px) {
		.bm { --gap: 38px; margin-top: 30px; }
		.bm__track img { height: 28px; max-width: 120px; }
		.bm__track span { font-size: 17px; }
	}
</style>
