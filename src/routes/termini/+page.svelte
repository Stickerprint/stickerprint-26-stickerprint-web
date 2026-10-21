<script lang="ts">
	import '$lib/styles/pages.css';
	import IubendaPolicy from '$lib/components/IubendaPolicy.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
</script>
<svelte:head><title>{t('pagine.termini.seoTitolo')}</title><meta name="description" content={t('pagine.termini.seoDescrizione')} /></svelte:head>
<section class="section container" style="max-width:860px">
	<h1 style="font-size:clamp(30px,4vw,46px)">{t('pagine.termini.titolo')}</h1>
	<p class="lead" style="margin-top:10px">{t('pagine.termini.testo')}</p>
	<div class="card policy" style="padding:28px;margin-top:22px"><IubendaPolicy href="https://www.iubenda.com/terms-and-conditions/42500812" title={t('pagine.termini.documento')} /></div>
	<p class="note" style="margin-top:14px">{@html t('pagine.termini.nota', { href: path('/resi') })}</p>
</section>
