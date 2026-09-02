<script lang="ts">
	let { images, alt = '' }: { images: string[]; alt?: string } = $props();
	let i = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	function go(n: number) {
		i = (n + images.length) % images.length;
	}
	$effect(() => {
		timer = setInterval(() => go(i + 1), 4500);
		return () => clearInterval(timer);
	});
</script>

<div class="carousel" aria-roledescription="carosello">
	<div class="carousel__track" style="transform: translateX(-{i * 100}%)">
		{#each images as src, k (src)}
			<img {src} alt={k === 0 ? alt : ''} loading={k === 0 ? 'eager' : 'lazy'} />
		{/each}
	</div>
	<button class="carousel__arrow carousel__arrow--prev" type="button" aria-label="Immagine precedente" onclick={() => go(i - 1)}>‹</button>
	<button class="carousel__arrow carousel__arrow--next" type="button" aria-label="Immagine successiva" onclick={() => go(i + 1)}>›</button>
	<div class="carousel__dots">
		{#each images as _, k (k)}
			<button type="button" class:is-active={k === i} aria-label="Vai all’immagine {k + 1}" onclick={() => go(k)}></button>
		{/each}
	</div>
</div>
