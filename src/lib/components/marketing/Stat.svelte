<script lang="ts">
	/** Una casella numero: trattino in grigio quando il dato non è arrivato. Con icona e tono colorato in testa per leggerla a colpo d'occhio. */
	let { etichetta, valore, delta = '', nota = '', icona = '', tono = 'gray' }: { etichetta: string; valore: string; delta?: string; nota?: string; icona?: string; tono?: 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'gray' } = $props();
	const vuoto = $derived(valore === '—');
	const classeDelta = $derived(delta.startsWith('+') ? 'su' : delta.startsWith('-') ? 'giu' : '');
</script>

<div class="dcard mk-stat" class:has-ico={!!icona}>
	{#if icona}<span class="mk-stat__ico mk-stat__ico--{tono}">{icona}</span>{/if}
	<small>{etichetta}</small>
	<b class:vuoto>{valore}</b>
	{#if delta}<span class="mk-delta {classeDelta}">{classeDelta === 'su' ? '▲' : classeDelta === 'giu' ? '▼' : ''} {delta} rispetto al periodo prima</span>{:else if nota}<span class="mk-delta">{nota}</span>{/if}
</div>
