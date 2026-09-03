<script lang="ts">
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	import Carousel from '$lib/components/Carousel.svelte';
	let { form } = $props();
	// Reel: inserire qui i link YouTube (anche Shorts). Finché è vuoto compaiono i segnaposto.
	const REELS: string[] = [];
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	let sending = $state(false);
	const gallery = ['1.jpg', '2.webp', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg'].map((g) => `/images/aziende/gallery/${g}`);
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

<section class="section container center">
	<h2>Produzioni vere. <span class="hl hl--blue">Non mockup.</span></h2>
	<p class="lead" style="margin-top:12px;max-width:720px;margin-inline:auto">Brand, agenzie e team che ci hanno scelto per progetti strutturati e produzioni che non ammettono improvvisazioni.</p>
	<div class="logos">
		{#each [1, 2, 3, 4, 5, 6, 7] as n (n)}<img src="/images/aziende/logo/{n}.png" alt="" loading="lazy" />{/each}
	</div>
	<div class="reels">
		{#if REELS.length}
			{#each REELS as r (r)}<iframe class="reel" src="https://www.youtube.com/embed/{ytId(r)}" title="Reel Stickerprint" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>{/each}
		{:else}
			{#each [1, 2, 3] as n (n)}<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>{/each}
		{/if}
	</div>
</section>

<section class="section container" id="contatto">
	<div class="split2" style="align-items:start">
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
