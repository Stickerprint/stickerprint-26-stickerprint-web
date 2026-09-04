<script lang="ts">
	/** Una casella numero: trattino in grigio quando il dato non è arrivato. */
	let { etichetta, valore, delta = '', nota = '' }: { etichetta: string; valore: string; delta?: string; nota?: string } = $props();
	const vuoto = $derived(valore === '—');
	const classeDelta = $derived(delta.startsWith('+') ? 'su' : delta.startsWith('-') ? 'giu' : '');
</script>

<div class="dcard mk-stat">
	<small>{etichetta}</small>
	<b class:vuoto>{valore}</b>
	{#if delta}<span class="mk-delta {classeDelta}">{delta} rispetto al periodo prima</span>{:else if nota}<span class="mk-delta">{nota}</span>{/if}
</div>
