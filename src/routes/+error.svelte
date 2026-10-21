<script lang="ts">
	import { page } from '$app/state';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? t('pagine.errore.nonTrovata') : t('pagine.errore.storto')} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="section container center errp">
	<span class="tag tag--yellow">{page.status}</span>
	<h1>{#if notFound}{@html t('pagine.errore.titoloNonTrovata')}{:else}{@html t('pagine.errore.titoloStorto')}{/if}</h1>
	<p class="lead">{notFound ? t('pagine.errore.testoNonTrovata') : t('pagine.errore.testoStorto')}</p>
	<div class="errp__btns">
		<a class="btn btn--blue" href={path('/')}>{t('pagine.errore.home')}</a>
		<a class="btn btn--yellow" href={path('/adesivi-personalizzati')}>{t('pagine.errore.stampa')}</a>
		<a class="btn btn--ghost" href={path('/support')}>{t('pagine.errore.scrivici')}</a>
	</div>
</section>

<style>
	.errp { padding-top: clamp(48px, 8vw, 96px); padding-bottom: clamp(48px, 8vw, 96px); display: grid; justify-items: center; gap: 18px; }
	.errp h1 { font-size: clamp(34px, 5vw, 58px); max-width: 720px; }
	.errp .lead { max-width: 560px; }
	.errp__btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
</style>
