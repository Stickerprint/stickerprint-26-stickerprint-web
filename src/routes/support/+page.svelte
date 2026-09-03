<script lang="ts">
	import '$lib/styles/pages.css';
	import Faq from '$lib/components/Faq.svelte';
	import { SUPPORT_TOPICS } from '$lib/support-faq';
	let current = $state(0);
	const topic = $derived(SUPPORT_TOPICS[current]);
</script>

<svelte:head>
	<title>Supporto: argomenti di aiuto | Stickerprint</title>
	<meta name="description" content="Materiali, finiture, ordini, spedizioni, resi: le risposte alle domande più frequenti su Stickerprint." />
</svelte:head>

<section class="section container center" style="padding-bottom:8px">
	<h1 style="font-size:clamp(34px,4.5vw,56px)">Argomenti di aiuto</h1>
	<p class="lead" style="margin-top:12px">Cerca qui la risposta. Se non la trovi, scrivici: rispondiamo in giornata.</p>
	<a class="support__mail" style="margin-top:20px" href="/support/email">Manda un’email al servizio clienti</a>
</section>

<section class="section container">
	<div class="support">
		<nav class="support__topics" aria-label="Argomenti">
			{#each SUPPORT_TOPICS as t, i (t.title)}
				<button type="button" class:is-active={current === i} onclick={() => (current = i)}>{t.title}</button>
			{/each}
		</nav>
		<div>
			<h2 style="margin-bottom:12px">{topic.title}</h2>
			{#key current}<Faq items={topic.faqs} />{/key}
		</div>
	</div>
</section>
