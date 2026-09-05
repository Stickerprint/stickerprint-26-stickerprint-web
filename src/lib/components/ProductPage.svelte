<script lang="ts">
	import '$lib/styles/product.css';
	import Carousel from '$lib/components/Carousel.svelte';
	import Configurator from '$lib/components/Configurator.svelte';
	import Faq from '$lib/components/Faq.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import { KIT, type ProductContent } from '$lib/products';
	import type { EngineConfig } from '$lib/pricing/engine';
	import type { HomeReview } from '$lib/server/reviews';

	let { p, engine, reviews, stats, shipDate, shipShort }: {
		p: ProductContent; engine: EngineConfig; reviews: HomeReview[]; stats: { total: number; average: number }; shipDate: string; shipShort: string;
	} = $props();
	const avg = $derived(stats.average.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	const [big, s1, s2] = $derived([p.others[0] ?? p.gallery[0], p.others[1] ?? p.gallery[1], p.others[2] ?? p.gallery[2]]);
</script>

<svelte:head>
	<title>{p.title} | Stickerprint</title>
	<meta name="description" content="{p.title}: {p.sub} {p.desc}" />
</svelte:head>

<!-- HERO -->
<section class="container ph">
	<div>
		<h1><span class="hl hl--yellow">{p.title}</span></h1>
		<p class="ph__sub">{p.sub}</p>
		<div class="ph__stars"><span class="stars">★★★★★</span> {avg} su 5</div>
		<p class="ph__desc">{p.desc}</p>
		<p class="ph__label">Su ogni ordine:</p>
		<ul class="ph__list">
			{#each p.checks as c (c)}
				<li><span class="ck">✓</span><span>{#if c.includes('{ship}')}{c.split('{ship}')[0]} <em>{shipShort}</em>{:else}{c}{/if}</span></li>
			{/each}
		</ul>
		<a class="ph__go" href="#configura">Configura {p.cta} qui sotto ↓</a>
	</div>
	<Carousel images={p.gallery} alt={p.title} />
</section>

<!-- PREVENTIVATORE -->
<section class="container">
	<Configurator {shipDate} cfg={engine} product={p.slug} productName={p.cta.replace(/^(i tuoi|le tue) /, '')} engineProduct={p.engineProduct} />
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
		<img src={s1} alt="" loading="lazy" />
		<img src={s2} alt="" loading="lazy" />
		<img src={p.gallery[p.gallery.length - 1]} alt="" loading="lazy" />
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

<!-- KIT CAMPIONI -->
<section class="section container">
	<div class="panel panel--peach kit">
		<div class="kit__copy">
			<p class="eyebrow">Offerta speciale</p>
			<h2>Prova i nostri adesivi. <span class="hl hl--yellow">Kit campioni a {KIT.price}</span></h2>
			<ul class="checks">
				{#each KIT.checks as c (c)}<li><span class="ck">✓</span>{c}</li>{/each}
			</ul>
			<div class="kit__cta">
				<a class="btn btn--yellow btn--lg" href="/campioni">Prova ora il kit →</a>
				<small>Li recuperi sul primo ordine</small>
			</div>
		</div>
		<img class="kit__img" src={KIT.img} alt="Kit campioni Stickerprint" loading="lazy" />
	</div>
</section>

<!-- FAQ -->
<section class="section container">
	<div class="faq-wrap">
		<div>
			<h2>{p.faqTitle.replace(/ (sugli|sulle|sui) .*$/, '')} <span class="hl hl--blue">{p.title}</span></h2>
			<p class="lead" style="margin-top:16px">Cerchi risposte? Dai un’occhiata a queste domande correlate o cerca nella nostra <a class="link" href="/support" style="color:var(--blue)">sezione di supporto</a>.</p>
		</div>
		<Faq items={p.faq} />
	</div>
</section>

<!-- CTA FINALE -->
<section class="section container center">
	<div class="final-cta">
		<h2>Carica il tuo file, <span class="hl hl--green">al resto pensiamo noi.</span></h2>
		<p class="lead" style="margin-top:12px">Stampa ora: pronti per la spedizione il <b>{shipShort}</b>.</p>
		<a class="btn btn--green btn--lg" style="margin-top:22px" href="#configura">Inizia subito →</a>
	</div>
</section>
