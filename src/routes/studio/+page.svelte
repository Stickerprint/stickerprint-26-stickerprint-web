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

	<!-- il montaggio non e' un prodotto: e' il banco dove piu' soggetti finiscono sulla stessa striscia -->
	<a class="st-monta" href="/studio/montaggio">
		<span class="st-monta__i" aria-hidden="true">
			<svg viewBox="0 0 48 24" width="48" height="24"><rect x="1" y="3" width="13" height="18" rx="2" fill="#0a95ff" /><rect x="17" y="3" width="13" height="18" rx="2" fill="#f4b400" /><rect x="33" y="3" width="13" height="18" rx="2" fill="#2fbf71" /></svg>
		</span>
		<span>
			<b>Montaggio</b>
			<em>Piu' soggetti su una striscia sola: un file di stampa, un file di taglio, un avviamento</em>
		</span>
	</a>
</section>

<style>
	.st-monta { display: flex; gap: 14px; align-items: center; margin-top: 18px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: #fff; text-decoration: none; color: inherit; }
	.st-monta:hover { border-color: var(--blue); }
	.st-monta__i { flex: none; display: flex; }
	.st-monta b { display: block; font-size: 15px; }
	.st-monta em { font-style: normal; color: var(--muted); font-size: 12.5px; }
</style>
