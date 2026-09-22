<script lang="ts">
	import { page } from '$app/state';
	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Pagina non trovata' : 'Qualcosa è andato storto'} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="section container center errp">
	<span class="tag tag--yellow">{page.status}</span>
	<h1>{#if notFound}Questa pagina <span class="hl hl--green">non c'è.</span>{:else}Qualcosa è <span class="hl hl--pink">andato storto.</span>{/if}</h1>
	<p class="lead">{#if notFound}Forse il link è vecchio o scritto male. Da qui puoi ripartire.{:else}Ci abbiamo provato, ma non è andata. Riprova tra un attimo: se continua, scrivici e lo sistemiamo noi.{/if}</p>
	<div class="errp__btns">
		<a class="btn btn--blue" href="/">Torna alla home</a>
		<a class="btn btn--yellow" href="/adesivi-personalizzati">Stampa adesivi</a>
		<a class="btn btn--ghost" href="/support">Scrivici</a>
	</div>
</section>

<style>
	.errp { padding-top: clamp(48px, 8vw, 96px); padding-bottom: clamp(48px, 8vw, 96px); display: grid; justify-items: center; gap: 18px; }
	.errp h1 { font-size: clamp(34px, 5vw, 58px); max-width: 720px; }
	.errp .lead { max-width: 560px; }
	.errp__btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
</style>
