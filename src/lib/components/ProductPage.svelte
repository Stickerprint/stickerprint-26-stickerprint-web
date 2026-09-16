<script lang="ts">
	import '$lib/styles/product.css';
	import Carousel from '$lib/components/Carousel.svelte';
	import Configurator from '$lib/components/Configurator.svelte';
	import SheetBuilder from '$lib/components/SheetBuilder.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import { type ProductContent } from '$lib/products';
	import SamplesBlock from '$lib/components/SamplesBlock.svelte';
	import FinalCta from '$lib/components/FinalCta.svelte';
	import FaqList from '$lib/components/FaqList.svelte';
	import HowTo from '$lib/components/HowTo.svelte';
	import type { EngineConfig } from '$lib/pricing/engine';
	import type { HomeReview } from '$lib/server/reviews';
	import Stars from './Stars.svelte';
	import Seo from './Seo.svelte';
	import Breadcrumb from './Breadcrumb.svelte';
	import { breadcrumbLd, productLd } from '$lib/seo';
	import { lowestPrice } from '$lib/pricing/engine';

	let { p, engine, reviews, stats, shipDate, shipShort, faq = [] }: {
		p: ProductContent; engine: EngineConfig; reviews: HomeReview[]; stats: { total: number; average: number; real?: boolean }; shipDate: string; shipShort: string; faq?: { q: string; a: string }[];
	} = $props();
	const avg = $derived(stats.average.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	/* SEO: prezzo "a partire da" dal listino (lo stesso della home), recensioni SOLO se vere (dal database, mai quelle di esempio) */
	const fromPrice = $derived.by(() => { try { return lowestPrice(engine); } catch { return null; } });
	const realReviews = $derived(reviews.filter((r) => r.real && r.comment));
	const crumbs = $derived([{ name: 'Home', path: '/' }, { name: p.engineProduct === 'resinati' || p.slug.startsWith('adesivi') || p.slug === 'vetrofanie' ? 'Adesivi' : 'Etichette', path: '/prodotti' }, { name: p.title, path: p.route }]);
	const ld = $derived([
		productLd({ path: p.route, name: p.title, description: p.seoDesc ?? `${p.sub} ${p.desc}`, images: p.gallery, sku: p.slug, category: p.seoCategory, material: p.engineProduct === 'resinati' ? 'Vinile con resina poliuretanica' : 'Vinile', fromPrice, rating: stats.real ? { average: stats.average, count: stats.total } : null, reviews: realReviews.map((r) => ({ author: r.author, body: r.comment, rating: r.rating, date: r.dateIso, title: r.title })) }),
		breadcrumbLd(crumbs)
	]);
	const big = $derived(p.careImg ?? p.others[0] ?? p.gallery[0]);
	const mosaic = $derived(p.mosaic ?? [p.others[1] ?? p.gallery[1], p.others[2] ?? p.gallery[2], p.gallery[p.gallery.length - 1]]);
</script>

<Seo title={p.seoTitle ?? `${p.title} | Stickerprint`} description={p.seoDesc ?? `${p.title}: ${p.sub} ${p.desc}`} image={p.gallery[0]} type="product" {ld} />

<!-- HERO -->
<section class="container ph">
	<div>
		<Breadcrumb items={crumbs} />
		<h1 style="margin-top:10px">{#if p.h1}{p.h1[0]}<br /><span class="hl hl--yellow">{p.h1[1]}</span>{:else}<span class="hl hl--yellow">{p.title}</span>{/if}</h1>
		<p class="ph__sub">{p.sub}</p>
		<div class="ph__stars"><Stars value={stats.average} count={stats.total} size={22} /></div>
		<p class="ph__desc">{p.desc}</p>
		<p class="ph__label">Su ogni ordine:</p>
		<ul class="ph__list">
			{#each p.checks as c (c)}
				<li><span class="ck">✓</span><span>{#if c.includes('{ship}')}{c.split('{ship}')[0]} <mark class="ph__date">{shipDate}</mark>{:else}{c}{/if}</span></li>
			{/each}
		</ul>
		<a class="ph__go" href="#configura">Configura {p.cta} qui sotto ↓</a>
	</div>
	<Carousel images={p.gallery} alt={p.title} />
</section>

<!-- PREVENTIVATORE -->
<section class="container" id="preventivatore" style="scroll-margin-top:80px">
	{#if p.slug === 'fogli_adesivi'}
		<SheetBuilder cfg={engine} {shipDate} />
	{:else}
		<Configurator {shipDate} cfg={engine} product={p.slug} productName={p.cta.replace(/^(i tuoi|le tue) /, '')} engineProduct={p.engineProduct} />
	{/if}
</section>

<!-- CONTROLLI PRIMA DELLA STAMPA -->
<section class="section container">
	<div class="split">
		<img src={big} alt={p.title} loading="lazy" />
		<div>
			<h2>{p.care.title} <span class="hl hl--green">{p.care.hl}</span></h2>
			<p class="lead">{p.care.intro}</p>
			<ul class="checks">
				{#each p.care.checks as c (c)}<li><span class="ck">✓</span>{c}</li>{/each}
			</ul>
			{#if p.care.closing}<p class="lead" style="margin-top:16px"><b>{p.care.closing}</b></p>{/if}
		</div>
	</div>
</section>

<!-- COSA STAI STAMPANDO -->
<section class="section container center">
	<h2><span class="hl hl--yellow">Cosa stai stampando, esattamente</span></h2>
	<p class="lead" style="margin-top:16px">{p.cosa}</p>
	<div class="mosaic">
		{#each mosaic as src (src)}<img {src} alt="" loading="lazy" />{/each}
	</div>
</section>

<!-- RECENSIONI -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>{p.reviewsTitle} <span class="hl hl--yellow">{p.reviewsHl}</span></h2>
		<p class="lead" style="margin-top:18px">{p.reviewsSub} Valutazione media {avg} su 5.</p>
		<ReviewsCarousel {reviews} />
	</div>
</section>

<!-- COME FUNZIONA (stesso blocco della home) -->
<HowTo {shipDate} />

<!-- KIT CAMPIONI (stesso blocco della home) -->
<SamplesBlock />

<!-- FAQ (stile della pagina Offerte; dal database se in dashboard c'e' la categoria del prodotto) -->
<FaqList items={faq.length ? faq : p.faq} title="Le domande" hl="più frequenti." intro={`Cerchi altre risposte? Guarda la nostra <a class="link" href="/support" style="color:var(--blue)">sezione di supporto</a>.`} />

<!-- CTA FINALE -->
<FinalCta {shipDate} href="#configura" />
