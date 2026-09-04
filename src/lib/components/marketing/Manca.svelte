<script lang="ts">
	/**
	 * Il terzo stato di ogni riquadro: non "errore", ma un pezzo che manca
	 * (collegamento Meta, chiave, script SQL). Dice cosa andare a sistemare.
	 */
	let { titolo = 'Dato non disponibile', testo = '' }: { titolo?: string; testo?: string } = $props();
</script>

<div class="mk-manca">
	<b>{titolo}</b>
	{#if testo}<p>{testo}</p>{/if}
</div>
