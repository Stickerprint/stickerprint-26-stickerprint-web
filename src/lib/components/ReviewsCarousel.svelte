<script lang="ts">
	import type { HomeReview } from '$lib/server/reviews';

	let { reviews }: { reviews: HomeReview[] } = $props();
	let open: HomeReview | null = $state(null);

	import { onMount } from 'svelte';
	let vp = $state<HTMLDivElement | undefined>();
	let hover = $state(false);
	let page = $state(0);
	let pages = $state(1);
	/* quante schede stanno nel riquadro: si legge dalla larghezza vera della prima scheda */
	const perView = () => { if (!vp) return 1; const c = vp.querySelector<HTMLElement>('.rv__card'); return c ? Math.max(1, Math.round(vp.clientWidth / (c.offsetWidth + 16))) : 1; };
	const step = () => { const c = vp?.querySelector<HTMLElement>('.rv__card'); return c ? c.offsetWidth + 16 : 320; };
	function onScroll() { if (!vp) return; page = Math.round(vp.scrollLeft / (step() * perView())); }
	function goPage(i: number) { if (!vp) return; const n = perView(); vp.scrollTo({ left: i * step() * n, behavior: 'smooth' }); }
	function go(d: number) {
		if (!vp) return;
		const n = perView(); const max = Math.max(0, Math.ceil(reviews.length / n) - 1);
		let next = page + d; if (next > max) next = 0; if (next < 0) next = max;
		goPage(next);
	}
	onMount(() => {
		const calc = () => { pages = Math.max(1, Math.ceil(reviews.length / perView())); };
		calc(); const ro = new ResizeObserver(calc); if (vp) ro.observe(vp);
		const t = setInterval(() => { if (!hover && !open && document.visibilityState === 'visible') go(1); }, 5000);
		return () => { clearInterval(t); ro.disconnect(); };
	});

	function stars(n: number) {
		return '★'.repeat(n) + '☆'.repeat(5 - n);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = null;
	}
</script>

{#snippet meta(r: HomeReview)}
	<div class="review__meta">
		<span class="review__author">{r.author}</span>
		{#if !r.source || r.source === 'ordine'}<span><span class="verified" aria-hidden="true">✓</span> Ordine verificato</span>{:else}<span title="Recensione ricevuta fuori dal sito e riportata da noi">{r.source}</span>{/if}
		<span><a class="review__product" href={r.href} onclick={(e) => e.stopPropagation()}>{r.product}</a></span>
	</div>
{/snippet}

<svelte:window onkeydown={onKey} />

<!-- carosello a scatti: le schede si fermano allineate dentro il riquadro (3 su desktop, 2 su tablet, 1 su telefono),
     niente sfumature ai lati; frecce, puntini e scorrimento automatico che si ferma al passaggio del mouse o al tocco -->
<div class="rv" role="region" aria-label="Recensioni dei clienti" onmouseenter={() => (hover = true)} onmouseleave={() => (hover = false)}>
	<button type="button" class="rv__arrow rv__arrow--prev" aria-label="Recensioni precedenti" onclick={() => go(-1)}>‹</button>
	<div class="rv__viewport" bind:this={vp} onscroll={onScroll} ontouchstart={() => (hover = true)} ontouchend={() => setTimeout(() => (hover = false), 4000)}>
		{#each reviews as r, i (i)}
			<div class="review rv__card" role="button" tabindex="0" aria-label="Leggi tutta la recensione di {r.author}: {r.title}" onclick={() => (open = r)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (open = r))}>
				<div class="review__stars" aria-label="{r.rating} stelle su 5">{stars(r.rating)}</div>
				<div class="review__title">{r.title}</div>
				<p class="review__text">{r.comment}</p>
				{@render meta(r)}
			</div>
		{/each}
	</div>
	<button type="button" class="rv__arrow rv__arrow--next" aria-label="Recensioni successive" onclick={() => go(1)}>›</button>
	<p class="rv__note note">Recensioni di clienti che hanno acquistato davvero; se raccolta su un altro canale, è indicato. <a class="link" href="/recensioni">Come le gestiamo</a>.</p>
	{#if pages > 1}<div class="rv__dots">{#each Array(pages) as _, i (i)}<button type="button" class:is-on={i === page} aria-label="Vai alla pagina {i + 1}" onclick={() => goPage(i)}></button>{/each}</div>{/if}
</div>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" role="presentation" onclick={() => (open = null)}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rv-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<button class="modal__close" type="button" aria-label="Chiudi" onclick={() => (open = null)}>✕</button>
			<div class="review__stars">{stars(open.rating)}</div>
			<h3 id="rv-title" class="review__title" style="font-size:22px">{open.title}</h3>
			<p class="review__text">{open.comment}</p>
			{@render meta(open)}
			{#if open.date}<p class="note">{open.date}</p>{/if}
		</div>
	</div>
{/if}
