<script lang="ts">
	/** Barre della spesa giorno per giorno, con gli ordini sopra. */
	import { euro } from '$lib/marketing/formato';
	let { giorni, titolo = 'Spesa giorno per giorno' }: { giorni: { giorno: string; spesa: number; clic: number; conversioni: number }[]; titolo?: string } = $props();
	const max = $derived(Math.max(1, ...giorni.map((g) => g.spesa)));
	const passo = $derived(giorni.length > 40 ? 7 : giorni.length > 14 ? 2 : 1);
</script>

<div class="dcard">
	<h3>{titolo}</h3>
	<div class="mk-bars" style={giorni.length > 40 ? 'gap:2px' : ''}>
		{#each giorni as g, i (g.giorno)}
			<div class="mk-bar" title="{g.giorno.split('-').reverse().join('/')}: {euro(g.spesa, 2)} · {g.clic} clic · {g.conversioni} ordini">
				{#if g.conversioni}<b>{g.conversioni}</b>{/if}
				<i style="height:{Math.round((g.spesa / max) * 100)}%"></i>
				<span>{i % passo === 0 ? g.giorno.slice(8) : ''}</span>
			</div>
		{/each}
	</div>
</div>
