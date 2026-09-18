<script lang="ts">
	import { STUDIO_PRODUCTS } from '$lib/studio/products';
</script>

<svelte:head><title>Stickerprint Studio</title></svelte:head>

<section class="st-home">
	<h1 class="st-hello">Buongiorno <span class="hl hl--yellow">Stickerprint</span></h1>
	<p class="st-ask">Cosa creiamo oggi?</p>

	<div class="st-grid">
		{#each STUDIO_PRODUCTS as p (p.id)}
			<a class="st-card" class:is-soon={!!p.soon} href={p.soon ? undefined : `/studio/${p.id}`} aria-disabled={p.soon ? 'true' : undefined}>
				<span class="st-card__img"><img src={p.img} alt="" loading="lazy" /></span>
				<span class="st-card__name">{p.name}</span>
				<span class="st-card__hint">{p.soon ? 'In arrivo' : p.hint}</span>
			</a>
		{/each}
	</div>
</section>
