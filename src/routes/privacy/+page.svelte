<script lang="ts">
	import '$lib/styles/pages.css';
	import IubendaPolicy from '$lib/components/IubendaPolicy.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
</script>
<svelte:head><title>{t('pagine.privacy.seoTitolo')}</title><meta name="description" content={t('pagine.privacy.seoDescrizione')} /></svelte:head>
<section class="section container" style="max-width:860px">
	<h1 style="font-size:clamp(30px,4vw,46px)">{t('pagine.privacy.titolo')}</h1>
	<p class="lead" style="margin-top:10px">{t('pagine.privacy.testo')}</p>
	<div class="card policy" style="padding:28px;margin-top:22px"><IubendaPolicy href="https://www.iubenda.com/privacy-policy/42500812" title={t('pagine.privacy.documento')} /></div>
	<p class="note" style="margin-top:14px"><a class="link" href={path('/cookie-policy')}>{t('pagine.privacy.cookie')}</a> · <a class="link iubenda-cs-preferences-link" href={path('/cookie-policy')}>{t('pagine.privacy.preferenze')}</a></p>
</section>
