<script lang="ts">
	import '$lib/styles/pages.css';
	let { data } = $props();
	let current = $state(0);
	const cats = $derived(data.categories);
	const cat = $derived(cats[current] ?? cats[0]);
</script>

<svelte:head>
	<title>Supporto: le domande più frequenti | Stickerprint</title>
	<meta name="description" content="Materiali, finiture, ordini, spedizioni, resi: le risposte alle domande più frequenti su Stickerprint." />
</svelte:head>

<section class="section container center" style="padding-bottom:8px">
	<h1 style="font-size:clamp(34px,4.5vw,56px)">Le domande <span class="hl hl--yellow">più frequenti.</span></h1>
	<p class="lead" style="margin-top:12px">Cerca qui la risposta. Se non la trovi, scrivici: rispondiamo in giornata.</p>
	<a class="support__mail" style="margin-top:20px" href="/support/email">Manda un’email al servizio clienti</a>
	{#if cats.length}
		<div class="faq-cats" role="tablist" aria-label="Argomenti">
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
		<p class="lead">Nessuna domanda ancora pubblicata.</p>
	{/if}
</section>
