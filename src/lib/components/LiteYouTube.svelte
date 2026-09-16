<script lang="ts">
	/**
	 * Video YouTube leggero: all'inizio solo la miniatura con il tasto play (un'immagine),
	 * il player vero (iframe) si carica al clic. Sette iframe caricati subito pesavano piu' di tutto il resto della pagina.
	 */
	let { id, title, autoplay = false }: { id: string; title: string; autoplay?: boolean } = $props();
	let open = $state(false);
	const thumb = $derived(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
	const src = $derived(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0${autoplay ? '&mute=1&loop=1&playlist=' + id : ''}`);
</script>

{#if open}
	<iframe class="reel" {src} {title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
{:else}
	<button type="button" class="reel lite" onclick={() => (open = true)} aria-label="Guarda: {title}">
		<img src={thumb} alt="" loading="lazy" width="480" height="360" />
		<span class="lite__play" aria-hidden="true"><svg viewBox="0 0 68 48" width="56" height="40"><path d="M66.5 7.7c-.8-2.9-3-5.2-5.9-6C55.4.3 34 .3 34 .3S12.6.3 7.4 1.7c-2.9.8-5.1 3.1-5.9 6C.1 13 .1 24 .1 24s0 11 1.4 16.3c.8 2.9 3 5.2 5.9 6 5.2 1.4 26.6 1.4 26.6 1.4s21.4 0 26.6-1.4c2.9-.8 5.1-3.1 5.9-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#f00"/><path d="M27 34l17.3-10L27 14z" fill="#fff"/></svg></span>
	</button>
{/if}

<style>
	.lite { position: relative; display: block; padding: 0; border: 0; cursor: pointer; overflow: hidden; }
	.lite img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.lite__play { position: absolute; inset: 0; display: grid; place-items: center; }
	.lite__play svg { filter: drop-shadow(0 4px 12px rgba(0,0,0,.4)); transition: transform .15s; }
	.lite:hover .lite__play svg { transform: scale(1.08); }
</style>
