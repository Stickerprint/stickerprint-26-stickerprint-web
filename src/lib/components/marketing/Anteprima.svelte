<script lang="ts">
	import type { Contenuto } from '$lib/marketing/tipi';
	/** Anteprima di un contenuto: il file arriva firmato per un'ora dalla dashboard. */
	let { item }: { item: Contenuto } = $props();
</script>

<div class="mk-thumb">
	{#if item.url && item.media === 'immagine'}
		<img src={item.url} alt={item.title} loading="lazy" />
	{:else if item.url && item.media === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video src={item.url} muted playsinline preload="metadata"></video>
	{:else if item.url}
		<a class="link" href={item.url} target="_blank" rel="noopener">Apri il file ↗</a>
	{:else}
		<span>Nessun file</span>
	{/if}
</div>
