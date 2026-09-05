<script lang="ts">
	/** Domande frequenti nello stile della pagina Offerte: titolo centrato ed elenco di riquadri apribili */
	let { items, title = 'Le domande', hl = 'più frequenti.', color = 'hl--yellow', intro = '' }: { items: { q: string; a: string }[]; title?: string; hl?: string; color?: string; intro?: string } = $props();
</script>

<section class="section container center">
	<h2>{title} <span class="hl {color}">{hl}</span></h2>
	{#if intro}<p class="lead" style="margin-top:12px">{@html intro}</p>{/if}
	<div class="faq3" style="text-align:left">
		{#each items as it (it.q)}
			<details><summary>{it.q}</summary><p>{it.a}</p></details>
		{/each}
	</div>
</section>
