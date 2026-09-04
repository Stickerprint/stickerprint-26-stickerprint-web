<script lang="ts">
	/** "Pezzi che Meta non ha dato": mai uno zero al posto di un dato mancante, il motivo si scrive qui. */
	let { avvisi = [] }: { avvisi?: string[] } = $props();
</script>

{#if avvisi.length}
	<div class="mk-avvisi">
		<b>Pezzi che Meta non ha dato</b>
		{#each avvisi as a (a)}<span>{a}</span>{/each}
	</div>
{/if}
