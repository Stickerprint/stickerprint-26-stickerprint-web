<script lang="ts">
	/**
	 * Stelle disegnate dalla media: arrotondata al mezzo punto (4,7 → 4 stelle e mezza), accanto il
	 * numero esatto con una cifra decimale. Stessa resa ovunque: home, pagine prodotto, aziende.
	 */
	let { value, size = 20, count, label = true, countLabel = 'recensioni' }: { value: number; size?: number; count?: number | null; label?: boolean; countLabel?: string } = $props();
	const half = $derived(Math.max(0, Math.min(5, Math.round(value * 2) / 2)));
	const fmt = $derived(value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	const kind = (i: number) => (half >= i ? 'full' : half >= i - 0.5 ? 'half' : 'empty');
</script>

<span class="rating" style="--s:{size}px" aria-label="{fmt} su 5">
	<span class="rating__stars">
		{#each [1, 2, 3, 4, 5] as i (i)}
			<svg class="star star--{kind(i)}" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
				<defs><clipPath id="h{i}{size}"><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
				<path class="star__bg" d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z" />
				{#if kind(i) === 'half'}<path class="star__fg" clip-path="url(#h{i}{size})" d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z" />{/if}
			</svg>
		{/each}
	</span>
	{#if label}<b class="rating__n">{fmt}</b><span class="rating__sub"> su 5{#if count} · {count.toLocaleString('it-IT')} {count === 1 ? countLabel.replace(/i$/, 'e').replace(/e verificate$/, 'e verificata') : countLabel}{/if}</span>{/if}
</span>

<style>
	.rating { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
	.rating__stars { display: inline-flex; gap: 1px; }
	.star__bg { fill: #d9dde6; }
	.star--full .star__bg { fill: #f5b301; }
	.star__fg { fill: #f5b301; }
	.rating__n { font-size: calc(var(--s) * 0.8); }
	.rating__sub { font-weight: 700; opacity: .85; white-space: nowrap; }
</style>
