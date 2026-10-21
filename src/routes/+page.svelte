<script lang="ts">
	import UploadPreview from '$lib/components/UploadPreview.svelte';
	/* i tre livelli del credito si animano quando entrano nello schermo (una volta sola) */
	let credIn = $state(false);
	function credObserve(el: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') { credIn = true; return; }
		const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { credIn = true; io.disconnect(); } }, { threshold: 0.35 });
		io.observe(el);
		return { destroy: () => io.disconnect() };
	}
	import Stars from '$lib/components/Stars.svelte';
	import BrandMarquee from '$lib/components/BrandMarquee.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import SamplesBlock from '$lib/components/SamplesBlock.svelte';
	import FinalCta from '$lib/components/FinalCta.svelte';
	import HowTo from '$lib/components/HowTo.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { HOME_LD } from '$lib/seo-home';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';

	let { data } = $props();

	/* testi, link, prezzi e date nella lingua della pagina (docs/traduzioni.md); `data` e' gia' il nome dei dati della pagina */
	const { t, path, prezzo, numero, data: giorno, locale } = usaLingua();
	/* soglia della spedizione gratuita nella valuta del locale, mai scritta a mano nei testi */
	const soglia = formatAmount(locale.freeShipping, locale, 0);
	/* "venerdì 24 ottobre" / "Friday, October 24": la data stimata di spedizione, dal server come mezzogiorno locale */
	const shipDate = $derived(giorno(data.shipAt, true));
	/* media delle recensioni con una cifra decimale (4,8 / 4.8) nel formato della lingua */
	const mediaRecensioni = $derived(new Intl.NumberFormat(locale.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.stats.average));

	// card "Cosa creiamo oggi?": ordine fisso, un colore per card, prezzo minimo dal listino (data.fromPrices)
	const products = [
		{ slug: 'adesivi_resinati', href: '/adesivi-resinati', img: '/images/prodotti/resinati/other-3.webp', name: t('home.prodotti.resinati.nome'), desc: t('home.prodotti.resinati.desc'), pill: 'pill--blue', color: 'var(--blue)' },
		{ slug: 'adesivi_personalizzati', href: '/adesivi-personalizzati', img: '/images/prodotti/adesivi-personalizzati/other-3.webp', name: t('home.prodotti.personalizzati.nome'), desc: t('home.prodotti.personalizzati.desc'), pill: 'pill--yellow', color: 'var(--yellow)' },
		{ slug: 'adesivi_rilievo', href: '/adesivi-rilievo', img: '/images/home/rilievo-card.webp', name: t('home.prodotti.rilievo.nome'), desc: t('home.prodotti.rilievo.desc'), pill: 'pill--pink', color: 'var(--pink)' },
		{ slug: 'etichette', href: '/etichette', img: '/images/prodotti/etichette/other-4.webp', name: t('home.prodotti.etichette.nome'), desc: t('home.prodotti.etichette.desc'), pill: 'pill--green', color: 'var(--green)' }
	];

	import { untrack } from 'svelte';
	const IG_URL = 'https://www.instagram.com/stickerprint.it/';
	// feed e follower live: dal server, poi riletti ogni minuto dal browser (contatore che si aggiorna da solo)
	// svelte-ignore state_referenced_locally
	let ig = $state(data.instagram);
	// svelte-ignore state_referenced_locally
	let shown = $state(data.instagram.followers ?? 6455);
	const followers = $derived(Math.round(shown));
	/* il numero dei follower sta dentro la frase tradotta: il contatore e' uno span con la classe "live", il testo viene dal catalogo (non da input utente) */
	const igTitolo = $derived(t('home.instagram.titolo', { n: `<span class="ig-count${ig.live ? ' is-live' : ''}">${numero(followers)}</span>` }));
	$effect(() => {
		const target = ig.followers ?? 6455;
		/* untrack: l'animazione scrive `shown` a ogni fotogramma; se l'effetto lo leggesse come dipendenza
		   si riavvierebbe a ogni scrittura (loop di requestAnimationFrame, secondi di CPU sul telefono) */
		const from = untrack(() => shown); if (from === target) return;
		const t0 = performance.now(); const dur = 900;
		const step = (t: number) => { const k = Math.min(1, (t - t0) / dur); shown = from + (target - from) * (1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); };
		requestAnimationFrame(step);
	});
	$effect(() => {
		const leggi = async () => { try { const r = await fetch('/api/instagram'); if (r.ok) ig = await r.json(); } catch { /* si ritenta al giro dopo */ } };
		// il server non aspetta l'agenzia: se ha mandato il feed statico, il browser legge subito quello vero
		if (ig.source === 'static') leggi();
		const id = setInterval(leggi, 60000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<link rel="preload" as="image" href="/images/ig-3.webp" fetchpriority="high" />
</svelte:head>
<Seo title={t('home.seo.titolo')} description={t('home.seo.descrizione', { soglia })} image="/images/og-stickerprint.jpg" ld={HOME_LD} />

<!-- HERO: fascia blu scuro come l'header, a tutta larghezza (solo in home) -->
<div class="hero-band">
<section class="hero container">
	<div class="hero__grid">
		<div>
			<h1>{t('home.hero.titolo')}<br /><span class="hl hl--green">{t('home.hero.evidenza')}</span></h1>
			<p class="lead" style="margin-top:34px">
				{@html t('home.hero.testo')}
			</p>
			<div class="hero__stars"><Stars value={data.stats.average} count={data.stats.total} size={22} countLabel={t('home.hero.recensioni')} /></div>
			<div class="hero__ctas">
				<a class="btn btn--blue btn--lg" href={path('/adesivi-personalizzati')}>{t('home.hero.stampaOra')}</a>
				<a class="btn btn--yellow btn--lg" href={path('/campioni')}>{t('home.hero.campioni')}</a>
			</div>
			<div class="pills"><div class="pills__row"><span class="pill pill--green">{t('home.hero.pillAnteprima')}</span><span class="pill pill--yellow">{t('home.hero.pillCredito')}</span></div></div>
			<p class="hero__ship"><span class="hero__rocket" aria-hidden="true">🚀</span><span class="hero__ship-txt"><span>{t('home.hero.spedizioneStimata')}</span><i class="hero__ship-sep">&nbsp;</i><b>{shipDate}</b><i class="hero__ship-sep">,&nbsp;</i><span>{t('home.hero.gratuitaDa', { soglia })}</span></span></p>
		</div>
		<div class="hero__visual hero__visual--pile">
			<img src="/images/hero-pila-adesivi.webp" alt={t('home.hero.altPila')} width="1400" height="660" fetchpriority="high" />
			<div class="hero__sticker" style="left:18px;bottom:18px">{t('home.hero.stickerAnteprima')}</div>
			<div class="hero__sticker" style="right:18px;top:18px">{t('home.hero.stickerSpedizione', { giorno: shipDate })}</div>
		</div>
	</div>
</section>
</div>

<!-- LOGHI -->
<section class="section--tight logos container center">
	<h2><span class="hl hl--purple">{t('home.loghi.titolo')}</span></h2>
	<BrandMarquee />
</section>

<!-- PRODOTTI -->
<section class="section container center">
	<h2><span class="hl hl--yellow">{t('home.prodotti.titolo')}</span></h2>
	<p class="lead" style="margin-top:18px">
		{@html t('home.prodotti.testo')}
	</p>
	<div class="products" style="text-align:left">
		{#each products as p (p.slug)}
			<a class="product" href={path(p.href)} style="--c:{p.color}">
				<div class="product__art"><img src={p.img} alt="" width="600" height="600" loading="lazy" /></div>
				<div class="product__name">{p.name}</div>
				<div class="product__desc">{p.desc}</div>
				{#if data.fromPrices?.[p.slug]}
					<div class="product__from {p.pill}"><span>{t('home.prodotti.aPartireDa')}</span> <b>{prezzo(data.fromPrices[p.slug], 0)}</b></div>
				{/if}
			</a>
		{/each}
	</div>
	<p style="margin-top:32px"><a class="link" href={path('/prodotti')}>{t('home.prodotti.tutti')}</a></p>
</section>

<!-- ANTEPRIMA AUTOMATICA -->
<section class="section container" id="anteprima">
	<div class="center">
		<span class="tag tag--blue">{t('home.anteprima.tag')}</span>
		<h2 style="margin-top:14px">{t('home.anteprima.titolo')} <span class="hl hl--blue">{t('home.anteprima.evidenza')}</span></h2>
		<p class="lead" style="margin-top:14px;max-width:640px;margin-inline:auto">{@html t('home.anteprima.testo')}</p>
	</div>
	<div class="up-card">
		<UploadPreview />
	</div>
	<div class="up-strip">
		<div><b>{t('home.anteprima.passo1')}</b><span>{t('home.anteprima.passo1Nota')}</span></div>
		<div><b>{t('home.anteprima.passo2')}</b><span>{t('home.anteprima.passo2Nota')}</span></div>
		<div><b>{t('home.anteprima.passo3')}</b><span>{t('home.anteprima.passo3Nota')}</span></div>
		<div><b>{t('home.anteprima.passo4')}</b><span>{t('home.anteprima.passo4Nota')}</span></div>
	</div>
</section>

<!-- SOCIAL PROOF -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>{t('home.fiducia.titolo')}<br /><span class="hl hl--yellow">{t('home.fiducia.evidenza')}</span></h2>
		<p class="lead" style="margin-top:22px">
			{@html t('home.fiducia.testo')}
		</p>
		<div class="stats">
			<div class="stat stat--blue"><b>{t('home.fiducia.ordini')}</b><span>{t('home.fiducia.ordiniLabel')}</span></div>
			<div class="stat stat--yellow"><b>{mediaRecensioni} ★</b><span>{t('home.fiducia.valutazioneLabel')}</span></div>
			<div class="stat stat--pink"><b>{t('home.fiducia.produzione')}</b><span>{t('home.fiducia.produzioneLabel')}</span></div>
		</div>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- CREDITO -->
<!-- PERCHE' STICKERPRINT -->
<HowTo {shipDate} />

<section class="section container">
	<div class="cred">
		<div class="cred__text">
			<span class="tag tag--green">{t('home.credito.tag')}</span>
			<h2 style="margin-top:14px">{t('home.credito.titolo')} <span class="hl hl--green">{t('home.credito.evidenza')}</span></h2>
			<p class="lead" style="margin-top:14px">{t('home.credito.testo')}</p>
			<!-- esempio in proporzione (100 → 6): importi nella valuta del locale, senza cambio -->
			<div class="cred__calc" aria-label={t('home.credito.esempio')}>
				<div><small>{t('home.credito.ordiniPer')}</small><b>{formatAmount(100, locale, 0)}</b></div>
				<span class="cred__arrow" aria-hidden="true">→</span>
				<div><small>{t('home.credito.tiTornano')}</small><b class="is-green">{formatAmount(6, locale, 0)}</b></div>
				<img src="/images/coin-sp.png" alt="" width="64" height="60" loading="lazy" />
			</div>
			<p style="margin-top:22px"><a class="btn btn--green btn--lg" href={path(data.user ? '/account' : '/signup')}>{data.user ? t('home.credito.vaiCredito') : t('home.credito.creaAccount')}</a></p>
			<p class="note" style="margin-top:10px">{t('home.credito.nota')}</p>
		</div>
		<div class="cred__path" class:is-in={credIn} use:credObserve>
			<div class="cred__line" aria-hidden="true"></div>
			<div class="cred__lv">
				<img src="/images/loyalty/creator.webp" alt="" loading="lazy" />
				<b>{t('home.credito.creator')}</b><span class="cred__pct">2%</span><small>{t('home.credito.dalPrimoOrdine')}</small>
			</div>
			<div class="cred__lv is-mid">
				<img src="/images/loyalty/partner.webp" alt="" loading="lazy" />
				<b>{t('home.credito.partner')}</b><span class="cred__pct">4%</span><small>{t('home.credito.daPunti', { punti: numero(500) })}</small>
			</div>
			<div class="cred__lv is-top">
				<i class="cred__shine" aria-hidden="true"></i>
				<img src="/images/loyalty/ambassador.webp" alt="" loading="lazy" />
				<b>{t('home.credito.ambassador')}</b><span class="cred__pct">6%</span><small>{t('home.credito.daPunti', { punti: numero(1500) })}</small>
			</div>
		</div>
	</div>
</section>

<!-- BUSINESS -->
<section class="section--tight container">
	<div class="business">
		<div class="business__text">
			<span class="tag tag--periwinkle">{t('home.business.tag')}</span>
			<h2 style="margin-top:16px">{t('home.business.titolo')}<br /><span class="hl hl--periwinkle">{t('home.business.evidenza')}</span></h2>
			<p>{t('home.business.testo')}</p>
			<p style="margin-top:30px"><a class="btn btn--periwinkle" href={path('/aziende')}>{t('home.business.cta')}</a></p>
		</div>
		<div class="business__visual"><img src="/images/home/business.webp" alt={t('home.business.alt')} width="2000" height="1526" loading="lazy" /></div>
	</div>
</section>

<!-- CAMPIONI -->
<SamplesBlock />

<!-- INSTAGRAM -->
<section class="section container ig">
	<div class="ig-head">
		<a class="tag tag--pink" href={IG_URL} target="_blank" rel="noopener" style="text-decoration:none">@stickerprint.it</a>
		<h2><span class="hl hl--pink">{@html igTitolo}</span></h2>
		<p class="lead">{@html t('home.instagram.testo')}</p>
	</div>
	<div class="ig-grid">
		{#each ig.media as m (m.id)}
			<a href={m.permalink} target="_blank" rel="noopener" title={m.caption || t('home.instagram.apri')}>
				<img src={m.image} alt={m.caption || t('home.instagram.altPost')} width="600" height="600" loading="lazy" />
				{#if m.isVideo}<span class="ig-play" aria-hidden="true">▶</span>{/if}
			</a>
		{/each}
	</div>
<p class="center" style="margin-top:26px"><a class="btn btn--pink btn--lg" href={IG_URL} target="_blank" rel="noopener">{t('home.instagram.seguici')}</a></p>
</section>

<!-- FINALE -->
<FinalCta {shipDate} />
