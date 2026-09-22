<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	let { data } = $props();
	/* tutte le card del catalogo: stesse grafiche e colori delle card in home, ogni card porta alla sua pagina */
	const products = [
		{ slug: 'adesivi_personalizzati', href: '/adesivi-personalizzati', img: '/images/prodotti/adesivi-personalizzati/other-3.webp', name: 'Adesivi personalizzati', desc: 'Vinile fustellato, qualsiasi forma. Opachi o lucidi.', pill: 'pill--yellow', color: 'var(--yellow)' },
		{ slug: 'adesivi_resinati', href: '/adesivi-resinati', img: '/images/prodotti/resinati/other-3.webp', name: 'Adesivi resinati', desc: 'Effetto 3D con cupola in resina. Premium.', pill: 'pill--blue', color: 'var(--blue)' },
		{ slug: 'adesivi_rilievo', href: '/adesivi-rilievo', img: '/images/home/rilievo-card.webp', name: 'Adesivi in rilievo', desc: 'Dettagli in rilievo che si sentono al tatto.', pill: 'pill--pink', color: 'var(--pink)' },
		{ slug: 'etichette', href: '/etichette', img: '/images/prodotti/etichette/other-4.webp', name: 'Etichette in fogli', desc: 'Per prodotti, packaging e confezioni.', pill: 'pill--green', color: 'var(--green)' },
		{ slug: 'fogli_adesivi', href: '/fogli', img: '/images/prodotti/fogli/other-3.webp', name: 'Fogli di adesivi', desc: 'Più adesivi, anche diversi, in un unico foglio.', pill: 'pill--purple', color: 'var(--purple)' },
		{ slug: 'vetrofanie', href: '/vetrofanie', img: '/images/prodotti/vetrofanie/1.webp', name: 'Vetrofanie', desc: 'Per il vetro: si applicano dentro, si leggono fuori.', pill: 'pill--blue', color: 'var(--blue)' },
		{ slug: 'kit_adesivi', href: '/kit-adesivi', img: '/images/prodotti/kit/other-2.webp', name: 'Kit di adesivi', desc: 'Bustina con cavallotto e 6 adesivi: pronto da regalare o vendere.', pill: 'pill--yellow', color: 'var(--yellow)' },
		{ slug: 'campioni', href: '/campioni', img: '/images/home/kit-campioni.webp', name: 'Kit campioni', desc: 'Tocca con mano materiali e finiture. Lo recuperi sul primo ordine.', pill: 'pill--green', color: 'var(--green)', fixed: '10 €' }
	];
	const eur0 = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €';
</script>

<Seo title="Tutti i prodotti: adesivi, etichette, kit e vetrofanie | Stickerprint" description="Il catalogo Stickerprint: adesivi personalizzati, resinati e in rilievo, etichette in fogli, fogli di adesivi, vetrofanie, kit di adesivi e kit campioni. Stampati in Italia, anteprima immediata." />

<section class="section container center catalog">
	<h1><span class="hl hl--yellow">Tutti i prodotti</span></h1>
	<p class="lead" style="margin-top:18px">Scegli cosa stampare: carichi il file, vedi subito l'anteprima e confermi.<br /><strong>Al resto pensiamo noi.</strong></p>
	<div class="products" style="text-align:left">
		{#each products as p (p.slug)}
			<a class="product" href={p.href} style="--c:{p.color}">
				<div class="product__art"><img src={p.img} alt={p.name} width="600" height="600" loading="lazy" /></div>
				<div class="product__name">{p.name}</div>
				<div class="product__desc">{p.desc}</div>
				{#if p.fixed}
					<div class="product__from {p.pill}"><span>solo</span> <b>{p.fixed}</b></div>
				{:else if data.fromPrices?.[p.slug]}
					<div class="product__from {p.pill}"><span>a partire da</span> <b>{eur0(data.fromPrices[p.slug])}</b></div>
				{/if}
			</a>
		{/each}
	</div>
</section>

<style>
	.catalog h1 { font-size: clamp(34px, 4.6vw, 58px); }
	.catalog .products { margin-top: 36px; }
</style>
