<script lang="ts">
	import type { HomeReview } from '../../routes/+page.server';

	let { reviews }: { reviews: HomeReview[] } = $props();
	let open: HomeReview | null = $state(null);

	// Duplichiamo la lista per far scorrere il nastro senza interruzioni
	const track = $derived([...reviews, ...reviews]);

	function stars(n: number) {
		return '★'.repeat(n) + '☆'.repeat(5 - n);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = null;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="rv-marquee">
	<div class="rv-track" style="animation-duration: {Math.max(30, reviews.length * 9)}s">
		{#each track as r, i (i)}
			<div
				class="review"
				role="button"
				tabindex={i < reviews.length ? 0 : -1}
				aria-hidden={i >= reviews.length}
				aria-label="Leggi tutta la recensione: {r.title}"
				onclick={() => (open = r)}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (open = r))}
			>
				<div class="review__stars" aria-label="{r.rating} stelle su 5">{stars(r.rating)}</div>
				<div class="review__title">{r.title}</div>
				<p class="review__text">{r.comment}</p>
				<div class="review__meta">
					<span class="verified" aria-hidden="true">✓</span> Ordine verificato ·
					<a class="review__product" href={r.href} onclick={(e) => e.stopPropagation()}>{r.product}</a>
				</div>
			</div>
		{/each}
	</div>
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
			<div class="review__meta">
				<span class="verified" aria-hidden="true">✓</span> Ordine verificato ·
				<a class="review__product" href={open.href}>{open.product}</a>
				{#if open.date}<span>· {open.date}</span>{/if}
			</div>
		</div>
	</div>
{/if}
