<script lang="ts">
	import '$lib/styles/pages.css';
	import { usaLingua } from '$lib/traduzioni';
	const { t } = usaLingua();
</script>

<svelte:head><title>{t('pagine.recensioni.seoTitolo')}</title><meta name="description" content={t('pagine.recensioni.seoDescrizione')} /></svelte:head>

<section class="section container" style="max-width:760px">
	<h1 style="font-size:clamp(30px,4vw,46px)">{t('pagine.recensioni.titolo')}</h1>
	<p class="lead" style="margin-top:10px">{t('pagine.recensioni.testo')}</p>
	<div class="card" style="padding:28px;margin-top:22px;display:grid;gap:18px;font-size:15.5px;line-height:1.6">
		<div>{@html t('pagine.recensioni.chi')}</div>
		<div>{@html t('pagine.recensioni.regalo')}</div>
		<div>{@html t('pagine.recensioni.pubblichiamo')}</div>
		<div>{@html t('pagine.recensioni.nonFacciamo')}</div>
		<div>{@html t('pagine.recensioni.correggere')}</div>
	</div>
</section>
