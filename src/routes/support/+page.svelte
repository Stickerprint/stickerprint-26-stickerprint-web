<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/pages.css';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { data } = $props();
	let current = $state(0);
	const cats = $derived(data.categories);
	const cat = $derived(cats[current] ?? cats[0]);
</script>

<Seo title={t('pagine.support.seoTitolo')} description={t('pagine.support.seoDescrizione')} />

<section class="section container center" style="padding-bottom:8px">
	<h1 style="font-size:clamp(34px,4.5vw,56px)">{@html t('pagine.support.titolo')}</h1>
	<p class="lead" style="margin-top:12px">{t('pagine.support.testo')}</p>
	<a class="support__mail" style="margin-top:20px" href={path('/support/email')}>{t('pagine.support.scrivi')}</a>
	{#if cats.length}
		<div class="faq-cats" role="tablist" aria-label={t('pagine.support.argomenti')}>
			{#each cats as c, i (c.id)}
				<button type="button" role="tab" aria-selected={current === i} class:is-active={current === i} onclick={() => (current = i)}>{c.name}</button>
			{/each}
		</div>
	{/if}
</section>

<section class="section container center" style="padding-top:10px">
	{#if cat}
		<h2 style="font-size:clamp(26px,3vw,38px)">{cat.name}</h2>
		<div class="faq3" style="text-align:left">
			{#key cat.id}
				{#each cat.items as it (it.id)}
					<details><summary>{it.q}</summary><p>{it.a}</p></details>
				{/each}
			{/key}
		</div>
	{:else}
		<p class="lead">{t('pagine.support.nessuna')}</p>
	{/if}
</section>
