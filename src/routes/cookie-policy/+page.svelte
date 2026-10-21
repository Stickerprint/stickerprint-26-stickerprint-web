<script lang="ts">
	import '$lib/styles/pages.css';
	import IubendaPolicy from '$lib/components/IubendaPolicy.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
</script>
<svelte:head><title>{t('pagine.cookie.seoTitolo')}</title><meta name="description" content={t('pagine.cookie.seoDescrizione')} /></svelte:head>
<section class="section container" style="max-width:860px">
	<h1 style="font-size:clamp(30px,4vw,46px)">{t('pagine.cookie.titolo')}</h1>
	<p class="lead" style="margin-top:10px">{t('pagine.cookie.testo')}</p>
	<p style="margin-top:14px"><a class="btn btn--ghost iubenda-cs-preferences-link" href={path('/cookie-policy')}>{t('pagine.cookie.gestisci')}</a></p>
	<div class="card policy" style="padding:28px;margin-top:22px"><IubendaPolicy href="https://www.iubenda.com/privacy-policy/42500812/cookie-policy" title={t('pagine.cookie.documento')} /></div>
</section>
