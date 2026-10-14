<script lang="ts">
	/** Linea piccola dell'andamento (es. spesa giorno per giorno dentro la scheda di un canale). */
	let { valori, colore = 'var(--blue)', altezza = 36 }: { valori: number[]; colore?: string; altezza?: number } = $props();
	const w = 160;
	const max = $derived(Math.max(1, ...valori));
	const pts = $derived(valori.map((v, i) => `${valori.length > 1 ? (i / (valori.length - 1)) * w : 0},${altezza - 2 - (v / max) * (altezza - 4)}`));
	const linea = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' '));
	const area = $derived(valori.length ? `${linea} L${w},${altezza} L0,${altezza} Z` : '');
</script>

{#if valori.length > 1}
	<svg class="mk-spark" viewBox="0 0 {w} {altezza}" preserveAspectRatio="none" aria-hidden="true">
		<path d={area} fill={colore} opacity=".12" />
		<path d={linea} fill="none" stroke={colore} stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
	</svg>
{/if}
