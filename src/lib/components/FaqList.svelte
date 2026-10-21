<script lang="ts">
	/** Domande frequenti nello stile della pagina Offerte: titolo centrato ed elenco di riquadri apribili.
	 *  Titolo e riga evidenziata, se non passati, vengono dal catalogo nella lingua della pagina. */
	import { usaLingua } from '$lib/traduzioni';
	let { items, title, hl, color = 'hl--yellow', intro = '' }: { items: { q: string; a: string }[]; title?: string; hl?: string; color?: string; intro?: string } = $props();
	const { t } = usaLingua();
	const titolo = $derived(title ?? t('prodotti.pagina.faqTitolo'));
	const evidenza = $derived(hl ?? t('prodotti.pagina.faqHl'));
</script>

<section class="section container center">
	<h2>{titolo} <span class="hl {color}">{evidenza}</span></h2>
	{#if intro}<p class="lead" style="margin-top:12px">{@html intro}</p>{/if}
	<div class="faq3" style="text-align:left">
		{#each items as it (it.q)}
			<details><summary>{it.q}</summary><p>{it.a}</p></details>
		{/each}
	</div>
</section>
