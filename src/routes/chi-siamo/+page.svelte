<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/pages.css';
	import { usaLingua } from '$lib/traduzioni';
	const { t } = usaLingua();
</script>

<Seo title={t('pagine.chiSiamo.seoTitolo')} description={t('pagine.chiSiamo.seoDescrizione')} />

<section class="container hero2 hero2--about">
	<div>
		<h1>{@html t('pagine.chiSiamo.titolo')}</h1>
		<p class="lead">{t('pagine.chiSiamo.p1')}</p>
		<p class="lead">{t('pagine.chiSiamo.p2')}</p>
		<p class="lead">{t('pagine.chiSiamo.p3')}</p>
	</div>
	<img class="photo" src="/images/chi-siamo/team.webp" alt={t('pagine.chiSiamo.teamAlt')} />
</section>

<section class="section container">
	<div class="split2">
		<img class="photo" src="/images/chi-siamo/mastersp.webp" alt="" loading="lazy" />
		<div>
			<h2>{@html t('pagine.chiSiamo.metodoTitolo')}</h2>
			<p class="lead">{t('pagine.chiSiamo.metodoTesto')}</p>
			<ul class="checks">
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.metodo1')}</li>
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.metodo2')}</li>
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.metodo3')}</li>
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.metodo4')}</li>
			</ul>
		</div>
	</div>
</section>

<section class="section container">
	<div class="split2">
		<div>
			<h2>{@html t('pagine.chiSiamo.mondoTitolo')}</h2>
			<p class="lead">{t('pagine.chiSiamo.mondoTesto')}</p>
			<ul class="checks">
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.mondo1')}</li>
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.mondo2')}</li>
				<li><span class="ck">✓</span>{t('pagine.chiSiamo.mondo3')}</li>
			</ul>
			<p class="lead" style="margin-top:16px"><b>{t('pagine.chiSiamo.mondoChiusura')}</b></p>
		</div>
		<img src="/images/chi-siamo/worldsp.webp" alt="" loading="lazy" />
	</div>
</section>
