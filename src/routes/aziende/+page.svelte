<script lang="ts">
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import Carousel from '$lib/components/Carousel.svelte';
	let { form, data } = $props();
	/* Reel dei clienti: per ognuno il logo dell'azienda (in alto), il link YouTube
	   (anche Shorts; finché manca compare il segnaposto) e il caso studio in due
	   righe: cosa abbiamo fatto e con che risultato. Basta compilare qui. */
	type Reel = { brand: string; logo: string; url?: string; caso?: string };
	const REELS: Reel[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ brand: `Cliente ${n}`, logo: `/images/aziende/logo/${n}.png` }));
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	const VISIBILI = 4;
	let start = $state(0);
	let paused = $state(false);
	const shown = $derived(Array.from({ length: Math.min(VISIBILI, REELS.length) }, (_, i) => REELS[(start + i) % REELS.length]));
	const next = () => (start = (start + 1) % REELS.length);
	const prev = () => (start = (start - 1 + REELS.length) % REELS.length);
	onMount(() => {
		if (REELS.length <= VISIBILI) return;
		const t = setInterval(() => { if (!paused) next(); }, 4500);
		return () => clearInterval(t);
	});
	let sending = $state(false);
	const gallery = ['1.jpg', '2.webp', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg'].map((g) => `/images/aziende/gallery/${g}`);
	const avg = $derived((data.stats?.average ?? 4.9).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
</script>

<svelte:head>
	<title>Aziende: produzioni importanti, nessuna improvvisazione | Stickerprint</title>
	<meta name="description" content="Produzioni strutturate, grandi volumi o richieste speciali: quando il configuratore non basta, entriamo in gioco noi." />
</svelte:head>

<section class="container hero2">
	<div>
		<h1>Produzioni importanti.<br /><span class="hl hl--yellow">Nessuna improvvisazione.</span></h1>
		<p class="lead">Produzioni strutturate, grandi volumi, o richieste speciali. Quando il configuratore non basta, entriamo in gioco noi.</p>
		<div class="hero2__cta">
			<a class="btn btn--green btn--lg" href="#contatto">Parla con noi</a>
			<a class="btn btn--ghost btn--lg" href="#processo">Vedi come lavoriamo</a>
		</div>
	</div>
	<img class="photo" src="/images/aziende/hero.webp" alt="Produzione Stickerprint per aziende" />
</section>

<!-- subito sotto la testata: chi ci ha scelto e i reel dei progetti -->
<section class="section container center">
	<h2>Produzioni vere. <span class="hl hl--blue">Non mockup.</span></h2>
	<p class="lead" style="margin-top:12px;max-width:720px;margin-inline:auto">Brand, agenzie e team che ci hanno scelto per progetti strutturati e produzioni che non ammettono improvvisazioni.</p>
	<div class="logos">
		{#each [1, 2, 3, 4, 5, 6, 7] as n (n)}<img src="/images/aziende/logo/{n}.png" alt="" loading="lazy" />{/each}
	</div>
	<div class="reels-wrap" role="region" aria-label="Reel dei clienti" onmouseenter={() => (paused = true)} onmouseleave={() => (paused = false)}>
		{#if REELS.length > VISIBILI}
			<button type="button" class="reels__arrow reels__arrow--prev" onclick={prev} aria-label="Reel precedenti">‹</button>
			<button type="button" class="reels__arrow reels__arrow--next" onclick={next} aria-label="Reel successivi">›</button>
		{/if}
		<div class="reels">
			{#each shown as r (r.logo)}
				<article class="reel-card">
					<div class="reel-card__brand"><img src={r.logo} alt={r.brand} loading="lazy" /></div>
					{#if r.url}
						<iframe class="reel" src="https://www.youtube.com/embed/{ytId(r.url)}" title="Reel {r.brand}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
					{:else}
						<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
					{/if}
					{#if r.caso}<p class="reel-card__caso">{r.caso}</p>{/if}
				</article>
			{/each}
		</div>
		{#if REELS.length > VISIBILI}
			<div class="reels__dots" aria-hidden="true">{#each REELS as _, i (i)}<i class:is-on={i === start}></i>{/each}</div>
		{/if}
	</div>
</section>

<section class="section container">
	<div class="feat3">
		<div class="card"><h3>Non sei solo nel progetto</h3><p class="lead" style="font-size:15.5px">Parli con una persona reale, che segue tutto, dall’idea alla consegna.</p></div>
		<div class="card"><h3>Tutto sotto controllo</h3><p class="lead" style="font-size:15.5px">Materiali, stampa, tempi. Ogni scelta è verificata prima di produrre.</p></div>
		<div class="card"><h3>Preventivi su misura</h3><p class="lead" style="font-size:15.5px">Ogni proposta nasce dal tuo progetto, non da un listino standard.</p></div>
	</div>
</section>

<section class="section container">
	<div class="split2">
		<div>
			<h2>Quando ha senso <span class="hl hl--green">contattarci.</span></h2>
			<p class="lead">Qui seguiamo progetti e produzioni che richiedono attenzione, esperienza e confronto. Perfetto se:</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Hai grosse produzioni</li>
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
			<h2>Un processo chiaro. <span class="hl hl--yellow">Senza sorprese.</span></h2>
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

<section class="section container" id="contatto">
	<div class="split2">
		<div>
			<h2>Raccontaci il progetto. <span class="hl hl--green">Al resto pensiamo noi.</span></h2>
			<p class="lead">Che siano 4000 o 400.000 pezzi, partiamo sempre da una cosa: capire cosa serve davvero. Ti rispondiamo con una proposta chiara, realistica e su misura.</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Volumi importanti o produzioni programmate</li>
				<li><span class="ck">✓</span>Progetti speciali, non standard o multi formato</li>
				<li><span class="ck">✓</span>Eventi, campagne marketing, lancio prodotto</li>
				<li><span class="ck">✓</span>Tempi stretti e scadenze da rispettare</li>
				<li><span class="ck">✓</span>Dubbi tecnici? Li risolviamo prima di stampare</li>
			</ul>
			<p class="stat-big" style="margin-top:26px">+580 <span style="font-size:.5em;color:var(--ink)">aziende servite</span></p>
			<div class="hero__stars" style="margin-top:10px"><span class="stars">★★★★★</span> {avg} su 5 · recensioni verificate</div>
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
