<script lang="ts">
	import '$lib/styles/pages.css';
	import '$lib/styles/product.css';
	import '$lib/styles/kit.css';
	import KitBuilder from '$lib/components/KitBuilder.svelte';
	import Carousel from '$lib/components/Carousel.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import HowTo from '$lib/components/HowTo.svelte';
	import SamplesBlock from '$lib/components/SamplesBlock.svelte';
	import FaqList from '$lib/components/FaqList.svelte';
	import FinalCta from '$lib/components/FinalCta.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import { breadcrumbLd, productLd } from '$lib/seo';
	import { kitBaseGross } from '$lib/pricing/kit';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';
	let { data } = $props();
	const { t, path, lang, locale } = usaLingua();
	/* soglia della spedizione gratuita del locale (50 € IT, 69 € UE, 99 $ USA), mai scritta a mano */
	const soglia = formatAmount(locale.freeShipping, locale, 0);

	/* foto dei kit: le quattro dell'hero e quella del tavolo per "Zero ansia" */
	const GALLERY = ['/images/prodotti/kit/1.webp', '/images/prodotti/kit/2.webp', '/images/prodotti/kit/3.webp', '/images/prodotti/kit/4.webp'];
	/* le tre foto di "Cosa stai stampando" */
	const MOSAIC = ['/images/prodotti/kit/other-1.webp', '/images/prodotti/kit/other-2.webp', '/images/prodotti/kit/other-3.webp'];
	/* media recensioni con un decimale fisso (4,0 / 4.0), nel formato della lingua */
	const avg = $derived(new Intl.NumberFormat(locale.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.stats?.average ?? 0));
	const crumbs = [{ name: t('kit.pagina.briciole.home'), path: path('/') }, { name: t('kit.pagina.briciole.adesivi'), path: path('/prodotti') }, { name: t('kit.pagina.briciole.kit'), path: path('/kit-adesivi') }];
	/* JSON-LD: prezzo del kit tipo (10 kit, 6 adesivi da 50 mm) come mostrato in pagina; niente recensioni finche' non ce ne sono di specifiche del kit */
	const ld = [
		productLd({ path: path('/kit-adesivi'), name: t('kit.pagina.ldNome'), description: t('kit.pagina.ldDesc'), images: GALLERY, sku: 'kit_adesivi', category: t('kit.pagina.ldCategoria'), material: t('kit.pagina.ldMateriale'), fromPrice: kitBaseGross(10) }),
		breadcrumbLd(crumbs)
	];
	/* domande frequenti del kit dal catalogo; in italiano, se in dashboard c'e' la categoria FAQ del kit, vince quella */
	const FAQ = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ q: t(`kit.pagina.faq.d${i}q`), a: t(`kit.pagina.faq.d${i}a`) }));
	const faq = $derived(lang === 'it' && data.faq?.length ? data.faq : FAQ);
</script>

<Seo title={t('kit.pagina.seoTitolo')} description={t('kit.pagina.seoDesc')} image={GALLERY[0]} type="product" {ld} />

<!-- HERO -->
<section class="container ph">
	<div>
		<Breadcrumb items={crumbs} />
		<h1 style="margin-top:10px">{t('kit.pagina.hero.titolo')} <span class="hl hl--yellow">{t('kit.pagina.hero.titoloHl')}</span></h1>
		<p class="ph__desc" style="margin-top:18px">{t('kit.pagina.hero.desc')}</p>
		{#if data.stats?.total}<div class="ph__stars" style="margin-top:14px"><Stars value={data.stats.average} count={data.stats.total} size={22} countLabel={t('kit.pagina.recensioni.verificate')} /></div>{/if}
		<ul class="ph__list" style="margin-top:22px">
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.sei')}</span></li>
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.cavallotto')}</span></li>
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.anteprima')}</span></li>
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.confezionati')}</span></li>
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.minimo')}</span></li>
			<li><span class="ck">✓</span><span>{t('kit.pagina.hero.spedizione')} <mark class="ph__date">{data.shipDate}</mark> · {t('kit.pagina.hero.spedizioneGratis', { soglia })}</span></li>
		</ul>
		<a class="ph__go" href="#kit">{t('kit.pagina.hero.vai')}</a>
	</div>
	<Carousel images={GALLERY} alt={t('kit.pagina.hero.altCarosello')} />
</section>

<!-- CONFIGURATORE -->
<section class="container" id="kit" style="scroll-margin-top:80px">
	<KitBuilder cfg={data.engine} shipDate={data.shipDate} />
</section>

<!-- ZERO ANSIA -->
<section class="section container">
	<div class="split">
		<img src="/images/prodotti/kit/care.webp" alt={t('kit.pagina.zeroAnsia.alt')} loading="lazy" />
		<div>
			<h2>{t('kit.pagina.zeroAnsia.titolo')} <span class="hl hl--green">{t('kit.pagina.zeroAnsia.hl')}</span></h2>
			<p class="lead">{t('kit.pagina.zeroAnsia.lead')}</p>
			<ul class="checks">
				<li><span class="ck">✓</span>{t('kit.pagina.zeroAnsia.controllo')}</li>
				<li><span class="ck">✓</span>{t('kit.pagina.zeroAnsia.verifica')}</li>
				<li><span class="ck">✓</span>{t('kit.pagina.zeroAnsia.anteprima')}</li>
				<li><span class="ck">✓</span>{t('kit.pagina.zeroAnsia.problema')}</li>
				<li><span class="ck">✓</span>{t('kit.pagina.zeroAnsia.confezionamento')}</li>
			</ul>
			<p class="lead" style="margin-top:16px"><b>{t('kit.pagina.zeroAnsia.chiusura')}</b></p>
		</div>
	</div>
</section>

<!-- COSA STAI STAMPANDO -->
<section class="section container center">
	<h2><span class="hl hl--yellow">{t('kit.pagina.cosa.titolo')}</span></h2>
	<p class="lead" style="margin-top:16px">{t('kit.pagina.cosa.lead1')}</p>
	<p class="lead" style="margin-top:12px">{t('kit.pagina.cosa.lead2')}</p>
	<p style="margin-top:20px"><span class="pill pill--yellow">{t('kit.pagina.cosa.pill')}</span></p>
	<div class="mosaic">
		{#each MOSAIC as src (src)}<img {src} alt="" loading="lazy" />{/each}
	</div>
</section>

<!-- RECENSIONI -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>{t('kit.pagina.recensioni.titolo')} <span class="hl hl--yellow">{t('kit.pagina.recensioni.hl')}</span></h2>
		<p class="lead" style="margin-top:18px">{t('kit.pagina.recensioni.lead', { media: avg })}</p>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- COME FUNZIONA -->
<HowTo shipDate={data.shipDate} />

<!-- KIT CAMPIONI -->
<SamplesBlock />

<!-- FAQ -->
<FaqList items={faq} title={t('kit.pagina.faq.titolo')} hl={t('kit.pagina.faq.hl')} intro={t('kit.pagina.faq.intro', { href: path('/support') })} />

<!-- CTA FINALE -->
<FinalCta shipDate={data.shipDate} href="#kit" label={t('kit.pagina.cta')} />
