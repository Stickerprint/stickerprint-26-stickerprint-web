<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo } = usaLingua();
	let { data } = $props();
	/* tutte le card del catalogo: stesse grafiche e colori delle card in home, ogni card porta alla sua pagina; nome e descrizione dal catalogo pagine.prodotti */
	const products = [
		{ slug: 'adesivi_personalizzati', href: '/adesivi-personalizzati', img: '/images/prodotti/adesivi-personalizzati/other-3.webp', chiave: 'personalizzati', pill: 'pill--yellow', color: 'var(--yellow)' },
		{ slug: 'adesivi_resinati', href: '/adesivi-resinati', img: '/images/prodotti/resinati/other-3.webp', chiave: 'resinati', pill: 'pill--blue', color: 'var(--blue)' },
		{ slug: 'adesivi_rilievo', href: '/adesivi-rilievo', img: '/images/home/rilievo-card.webp', chiave: 'rilievo', pill: 'pill--pink', color: 'var(--pink)' },
		{ slug: 'etichette', href: '/etichette', img: '/images/prodotti/etichette/other-4.webp', chiave: 'etichette', pill: 'pill--green', color: 'var(--green)' },
		{ slug: 'fogli_adesivi', href: '/fogli', img: '/images/prodotti/fogli/other-3.webp', chiave: 'fogli', pill: 'pill--purple', color: 'var(--purple)' },
		{ slug: 'vetrofanie', href: '/vetrofanie', img: '/images/prodotti/vetrofanie/1.webp', chiave: 'vetrofanie', pill: 'pill--blue', color: 'var(--blue)' },
		{ slug: 'kit_adesivi', href: '/kit-adesivi', img: '/images/prodotti/kit/other-2.webp', chiave: 'kit', pill: 'pill--yellow', color: 'var(--yellow)' },
		{ slug: 'campioni', href: '/campioni', img: '/images/home/kit-campioni.webp', chiave: 'campioni', pill: 'pill--green', color: 'var(--green)', fixedEur: 10 }
	];
</script>

<Seo title={t('pagine.prodotti.seoTitolo')} description={t('pagine.prodotti.seoDescrizione')} />

<section class="section container center catalog">
	<h1><span class="hl hl--yellow">{t('pagine.prodotti.titolo')}</span></h1>
	<p class="lead" style="margin-top:18px">{@html t('pagine.prodotti.testo')}</p>
	<div class="products" style="text-align:left">
		{#each products as p (p.slug)}
			<a class="product" href={path(p.href)} style="--c:{p.color}">
				<div class="product__art"><img src={p.img} alt={t(`pagine.prodotti.${p.chiave}`)} width="600" height="600" loading="lazy" /></div>
				<div class="product__name">{t(`pagine.prodotti.${p.chiave}`)}</div>
				<div class="product__desc">{t(`pagine.prodotti.${p.chiave}Desc`)}</div>
				{#if p.fixedEur}
					<div class="product__from {p.pill}"><span>{t('pagine.prodotti.solo')}</span> <b>{prezzo(p.fixedEur, 0)}</b></div>
				{:else if data.fromPrices?.[p.slug]}
					<div class="product__from {p.pill}"><span>{t('pagine.prodotti.aPartireDa')}</span> <b>{prezzo(data.fromPrices[p.slug], 0)}</b></div>
				{/if}
			</a>
		{/each}
	</div>
</section>

<style>
	.catalog h1 { font-size: clamp(34px, 4.6vw, 58px); }
	.catalog .products { margin-top: 36px; }
</style>
