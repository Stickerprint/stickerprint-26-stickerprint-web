<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	/* Reel dell'hero (YouTube, Shorts o file .mp4): link da inserire qui */
	import LiteYouTube from '$lib/components/LiteYouTube.svelte';
	const REEL = '';
	import '$lib/styles/pages.css';
	import Stars from '$lib/components/Stars.svelte';
	import BrandMarquee from '$lib/components/BrandMarquee.svelte';
	import { track } from '$lib/tracking';
	import { enhance } from '$app/forms';
	import Carousel from '$lib/components/Carousel.svelte';
	let { form, data } = $props();
	$effect(() => { if (form?.ok) track.generateLead('aziende'); });
	/* Reel dei clienti: per ognuno il logo dell'azienda (in alto), il link YouTube
	   (anche Shorts; finché manca compare il segnaposto) e il caso studio in due
	   righe: cosa abbiamo fatto e con che risultato. Basta compilare qui. */
	type Reel = { brand: string; logo: string; url?: string; caso?: string };
	/* i reel dei progetti (YouTube Shorts), uno per logo */
	const REELS: Reel[] = [
		{ brand: 'Golden Goose', logo: '/images/aziende/logo/1.webp', url: 'https://youtube.com/shorts/FGh1Y1d42l0' },
		{ brand: 'Sephora', logo: '/images/aziende/logo/4.webp', url: 'https://youtube.com/shorts/fIoQs88BwfQ' },
		{ brand: 'Moscot', logo: '/images/aziende/logo/3.webp', url: 'https://youtube.com/shorts/Sj96mdpp03k' },
		{ brand: 'VeraLab', logo: '/images/aziende/logo/2.webp', url: 'https://youtube.com/shorts/0cP9ccRh0SY' },
		{ brand: 'Samsung', logo: '/images/aziende/logo/7.webp', url: 'https://youtube.com/shorts/AofMPTxfWp4' },
		{ brand: 'Guerlain', logo: '/images/aziende/logo/6.webp', url: 'https://youtube.com/shorts/Eqg70M83vX4' },
		{ brand: 'MAC', logo: '/images/aziende/logo/5.webp', url: 'https://youtube.com/shorts/BkrM1Eg_MBo' }
	];
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	const VISIBILI = 4;
	let start = $state(0);
	let paused = $state(false);
	const reel = $derived(REELS[start]);
	const shown = $derived(Array.from({ length: Math.min(VISIBILI, REELS.length) }, (_, i) => REELS[(start + i) % REELS.length]));
	const next = () => (start = (start + 1) % REELS.length);
	const prev = () => (start = (start - 1 + REELS.length) % REELS.length);
	// swipe a sinistra o a destra per sfogliare
	let touchX = 0;
	const tStart = (e: TouchEvent) => { touchX = e.touches[0].clientX; paused = true; };
	const tEnd = (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - touchX; if (dx < -40) next(); else if (dx > 40) prev(); paused = false; };
	/* niente scorrimento automatico: si sfoglia con le frecce (desktop) o con lo swipe (mobile) */
	let sending = $state(false);
	const gallery = ['1.webp', '2.webp', '3.webp', '4.webp', '5.webp', '6.webp', '7.webp', '8.webp', '9.webp'].map((g) => `/images/aziende/gallery/${g}`);
</script>

<Seo title="Adesivi personalizzati per aziende e grandi quantità | Stickerprint" description="Produzioni complesse, grandi volumi o richieste speciali: referente dedicato, preventivi su misura e un processo sotto controllo dall’inizio alla consegna." />

<!-- hero su fascia blu scuro, come in home -->
<div class="hero-band">
<section class="container hero2">
	<div>
		<h1 class="hero2__big">Il tuo progetto è grande.<br /><span class="hl hl--periwinkle">Trattiamolo come tale.</span></h1>
		<p class="lead">Produzioni complesse, grandi volumi o richieste speciali: ti affianchiamo con un referente dedicato, preventivi su misura e un processo sotto controllo dall’inizio alla consegna.</p>
		<div class="pills">
			<div class="pills__row"><span class="pill pill--green">✦ Referente dedicato</span><span class="pill pill--yellow">✦ Preventivi su misura</span></div>
			<div class="pills__row"><span class="pill pill--blue">✦ Produzione sotto controllo</span></div>
		</div>
		<div class="hero2__cta">
			<a class="btn btn--yellow btn--lg" href="#contatto">Richiedi un preventivo</a>
			<a class="btn btn--periwinkle btn--lg" href="#processo">Scopri come lavoriamo</a>
		</div>
	</div>
	<!-- reel dell'hero, stesso blocco di quelli sotto: il link si mette in REEL (YouTube/Shorts oppure un file .mp4) -->
	<div class="reels reels--hero">
		{#if REEL && /\.mp4($|\?)/i.test(REEL)}
			<video class="reel" src={REEL} autoplay muted loop playsinline></video>
		{:else if REEL}
			<LiteYouTube id={ytId(REEL)} title="Stickerprint per le aziende" />
		{:else}
			<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
		{/if}
	</div>
</section>
</div>

<!-- subito sotto la testata: chi ci ha scelto e i reel dei progetti -->
<section class="section container center">
	<h2>Questi non sono mockup.<br /><span class="hl hl--blue">Sono lavori veri.</span></h2>
	<p class="lead" style="margin-top:12px;max-width:720px;margin-inline:auto">Brand, agenzie e team che ci hanno scelto per progetti strutturati e produzioni che non ammettono improvvisazioni.</p>
	<div class="reels-wrap" role="region" aria-label="Reel dei clienti" onmouseenter={() => (paused = true)} onmouseleave={() => (paused = false)} ontouchstart={tStart} ontouchend={tEnd}>
		{#if REELS.length > 1}
			<button type="button" class="reels__arrow reels__arrow--prev" onclick={prev} aria-label="Reel precedente">‹</button>
			<button type="button" class="reels__arrow reels__arrow--next" onclick={next} aria-label="Reel successivo">›</button>
		{/if}
		<!-- desktop: quattro reel affiancati, come prima -->
		<div class="reels reels--desktop">
			{#each shown as r (r.logo)}
				<article class="reel-card">
					<div class="reel-card__brand"><img src={r.logo} alt={r.brand} loading="lazy" /></div>
					{#if r.url}
						<LiteYouTube id={ytId(r.url)} title="Reel {r.brand}" />
					{:else}
						<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
					{/if}
					{#if r.caso}<p class="reel-card__caso">{r.caso}</p>{/if}
				</article>
			{/each}
		</div>
		<!-- mobile: un reel solo, grande, con lo swipe -->
		<div class="reels--mobile">
			{#key start}
				<article class="reel-card reel-card--big">
					<div class="reel-card__brand"><img src={reel.logo} alt={reel.brand} loading="lazy" /></div>
					{#if reel.url}
						<LiteYouTube id={ytId(reel.url)} title="Reel {reel.brand}" />
					{:else}
						<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
					{/if}
					{#if reel.caso}<p class="reel-card__caso">{reel.caso}</p>{/if}
				</article>
			{/key}
		</div>
		{#if REELS.length > 1}
			<div class="reels__dots" aria-hidden="true">{#each REELS as _, i (i)}<i class:is-on={i === start}></i>{/each}</div>
		{/if}
	</div>
</section>

<section class="section container">
	<div class="split2">
		<div>
			<h2 class="h2-big">Quando ha senso<br /><span class="hl hl--blue">contattarci.</span></h2>
			<p class="lead">Qui seguiamo progetti e produzioni che richiedono attenzione, esperienza e confronto. Perfetto se:</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Devi gestire grandi volumi o produzioni ricorrenti</li>
				<li><span class="ck">✓</span>Il progetto richiede studio, test o campioni</li>
				<li><span class="ck">✓</span>Vuoi controllo sul risultato finale</li>
				<li><span class="ck">✓</span>Hai scadenze reali da rispettare</li>
			</ul>
			<p class="note" style="margin-top:16px">Per ordini spot, piccole quantità e file regolari puoi usare i preventivatori del sito.</p>
		</div>
		<Carousel images={gallery} alt="Produzioni Stickerprint per aziende" />
	</div>
</section>

<section class="section container" id="processo">
	<div class="split2">
		<img src="/images/aziende/bus2.webp" alt="Il processo di produzione Stickerprint" loading="lazy" />
		<div>
			<h2 class="h2-big">Un processo chiaro.<br /><span class="hl hl--yellow">Senza sorprese.</span></h2>
			<p class="lead">Quando serve, ci sediamo, guardiamo il progetto e costruiamo la soluzione migliore.</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Analisi del progetto e dei file</li>
				<li><span class="ck">✓</span>Verifica tecnica e scelta dei materiali più adatti</li>
				<li><span class="ck">✓</span>Campioni e test personalizzati</li>
				<li><span class="ck">✓</span>Produzione su misura</li>
				<li><span class="ck">✓</span>Spedizione organizzata</li>
			</ul>
			<p class="lead" style="margin-top:16px"><b>Produciamo solo quando siamo sicuri del risultato finale.</b></p>
		</div>
	</div>
</section>

<!-- LOGHI (come nella home) -->
<section class="section--tight logos container center">
	<h2><span class="hl hl--purple">Produzioni realizzate per</span></h2>
	<p class="lead" style="margin-top:14px;max-width:720px;margin-inline:auto">Dai brand internazionali alle realtà emergenti: ogni progetto riceve la stessa attenzione.</p>
	<BrandMarquee />
</section>

<section class="section container" id="contatto">
	<div class="split2">
		<div>
			<h2 class="h2-big">Raccontaci il progetto.<br /><span class="hl hl--green">Al resto pensiamo noi.</span></h2>
			<p class="lead">Che siano 4000 o 400.000 pezzi, partiamo sempre da una cosa: capire cosa serve davvero. Ti rispondiamo con una proposta chiara, realistica e su misura.</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Volumi importanti o produzioni programmate</li>
				<li><span class="ck">✓</span>Progetti speciali, non standard o multi formato</li>
				<li><span class="ck">✓</span>Eventi, campagne marketing, lancio prodotto</li>
				<li><span class="ck">✓</span>Tempi stretti e scadenze da rispettare</li>
				<li><span class="ck">✓</span>Dubbi tecnici? Li risolviamo prima di stampare</li>
			</ul>
			<p class="stat-big" style="margin-top:26px"><mark>+580</mark> <span>aziende servite</span></p>
			<div class="hero__stars" style="margin-top:10px"><Stars value={data.stats?.average ?? 4.9} count={data.stats?.total ?? null} size={22} countLabel="recensioni verificate" /></div>
		</div>
		<div class="card" style="padding:28px">
			<h3 style="margin-bottom:14px">Iniziamo da qui.</h3>
			{#if form?.ok}
				<p class="success">Richiesta ricevuta. Ti rispondiamo a breve con una proposta su misura.</p>
			{:else}
				<form class="form2" method="POST" enctype="multipart/form-data" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }}>
					<div class="row">
						<label>Nome*<input name="name" required /></label>
						<label>Azienda*<input name="company" required /></label>
					</div>
					<div class="row">
						<label>E-mail*<input name="email" type="email" required /></label>
						<label>Telefono*<input name="phone" type="tel" required /></label>
					</div>
					<label>Carica il tuo file<input name="file" type="file" accept="image/*,.pdf,.ai,.eps,.svg,.zip" /></label>
					<label>Richiesta*<textarea name="message" rows="5" required placeholder="Prodotto, quantità, tempi, materiali…"></textarea></label>
					{#if form?.error}<p class="error">{form.error}</p>{/if}
					<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? 'Invio…' : 'Ottieni una proposta su misura'}</button>
				</form>
			{/if}
		</div>
	</div>
</section>
