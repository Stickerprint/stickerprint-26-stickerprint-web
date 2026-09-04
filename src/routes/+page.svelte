<script lang="ts">
	import UploadPreview from '$lib/components/UploadPreview.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';

	let { data } = $props();

	const products = [
		{ href: '/adesivi-personalizzati', img: '/images/ig-1.jpg', name: 'Adesivi personalizzati', desc: 'Vinile fustellato, qualsiasi forma. Opachi o lucidi.', from: 'Anteprima automatica ✓' },
		{ href: '/adesivi-resinati', img: '/images/ig-7.jpg', name: 'Adesivi resinati', desc: 'Effetto 3D con cupola in resina. Premium.', from: 'Anteprima automatica ✓' },
		{ href: '/etichette', img: '/images/ig-5.jpg', name: 'Etichette', desc: 'In rotolo o in fogli per prodotti e packaging.', from: 'Da 200 pezzi' },
		{ href: '/vetrofanie', img: '/images/ig-8.jpg', name: 'Vetrofanie & fogli', desc: 'Per vetrine, insegne e grandi formati.', from: 'Su misura' }
	];

	// loghi dei brand: immagine in /images/brands, oppure solo il nome se il logo non c'è ancora
	const brands: { name: string; img?: string }[] = [
		{ name: 'VeraLab', img: 'veralab.png' }, { name: 'Samsung', img: 'samsung.png' }, { name: 'Jordan' }, { name: 'Moscot NY', img: 'moscot.png' },
		{ name: 'Sephora', img: 'sephora.png' }, { name: 'Golden Goose', img: 'goldengoose.png' }, { name: 'Red Bull', img: 'redbull.png' }, { name: 'Würth', img: 'wurth.png' },
		{ name: 'Tiffany & Co.', img: 'tiffany.png' }, { name: 'Technogym', img: 'technogym.png' }, { name: 'Ralph Lauren', img: 'ralphlauren.png' }, { name: 'MAC Cosmetics', img: 'maccosmetics.png' },
		{ name: 'Dolce & Gabbana', img: 'dolcegabbana.png' }, { name: 'Guerlain', img: 'guerlain.png' }, { name: 'Borotalco' }, { name: 'Rapid Bike' }
	];
	const IG_URL = 'https://www.instagram.com/stickerprint.it/';
	// feed e follower live: dal server, poi riletti ogni minuto dal browser (contatore che si aggiorna da solo)
	// svelte-ignore state_referenced_locally
	let ig = $state(data.instagram);
	// svelte-ignore state_referenced_locally
	let shown = $state(data.instagram.followers ?? 6455);
	const followers = $derived(Math.round(shown));
	$effect(() => {
		const target = ig.followers ?? 6455;
		const from = shown; if (from === target) return;
		const t0 = performance.now(); const dur = 900;
		const step = (t: number) => { const k = Math.min(1, (t - t0) / dur); shown = from + (target - from) * (1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); };
		requestAnimationFrame(step);
	});
	$effect(() => {
		const id = setInterval(async () => { try { const r = await fetch('/api/instagram'); if (r.ok) ig = await r.json(); } catch { /* si ritenta al giro dopo */ } }, 60000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>Stickerprint | Adesivi personalizzati con anteprima automatica</title>
	<meta name="description" content="Adesivi perfetti, zero sorprese. Carica il file, guarda subito l’anteprima automatica e conferma. Prova di stampa inclusa, spedizione in 5 giorni, fino al 6% in credito su ogni ordine." />
	<link rel="canonical" href="https://stickerprint.it/" />
	<meta property="og:title" content="Stickerprint — Adesivi perfetti. Zero sorprese." />
	<meta property="og:description" content="Carica il file e guarda subito l’anteprima automatica dei tuoi adesivi." />
	<meta property="og:image" content="https://stickerprint.it/images/splogo.png" />
	<meta property="og:type" content="website" />
</svelte:head>

<!-- HERO -->
<section class="hero container">
	<div class="hero__grid">
		<div>
			<h1>Adesivi perfetti.<br /><span class="hl hl--green">Zero sorprese.</span></h1>
			<p class="lead" style="margin-top:34px">
				Carica il tuo file e visualizza <strong>subito l’anteprima automatica</strong> dei tuoi adesivi. Ti piace? Conferma. Vuoi cambiare qualcosa? Ce ne occupiamo noi.
			</p>
			<div class="hero__stars"><span class="stars">★★★★★</span> {data.stats.average.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} su 5 · recensioni verificate</div>
			<div class="hero__ctas">
				<a class="btn btn--blue btn--lg" href="/adesivi-personalizzati">Stampa ora</a>
				<a class="btn btn--yellow btn--lg" href="/campioni">Campioni</a>
			</div>
			<div class="hero__pill"><span>✦ Anteprima immediata</span><span>✦ Fino al 6% di Credito Stickerprint</span></div>
			<p class="hero__ship">🚀 Ordina ora: pronti per la spedizione il <b>{data.shipDate}</b></p>
		</div>
		<div class="hero__visual">
			<img src="/images/ig-3.jpg" alt="Adesivi fustellati Bubu's Smashburger stampati da Stickerprint" width="600" height="600" />
			<div class="hero__sticker" style="left:18px;bottom:18px">✅ Prova approvata in 2 min</div>
			<div class="hero__sticker" style="right:18px;top:18px">📦 Spedito in 5 gg</div>
		</div>
	</div>
</section>

<!-- LOGHI -->
<section class="section--tight logos container center">
	<h2><span class="hl hl--purple">Abbiamo stampato per</span></h2>
	<div class="marquee" aria-hidden="true">
		<div class="marquee__track">
			{#each [...brands, ...brands] as b, k (k)}{#if b.img}<img src="/images/brands/{b.img}" alt={b.name} title={b.name} />{:else}<span>{b.name}</span>{/if}{/each}
		</div>
	</div>
</section>

<!-- PRODOTTI -->
<section class="section container center">
	<h2><span class="hl hl--yellow">Cosa creiamo oggi?</span></h2>
	<p class="lead" style="margin-top:18px">
		Scelti ogni giorno da Brand, Creator e Aziende che vogliono lasciare il segno.<br /><strong>Per davvero.</strong>
	</p>
	<div class="products" style="text-align:left">
		{#each products as p}
			<a class="product" href={p.href}>
				<div class="product__art"><img src={p.img} alt="" width="600" height="600" loading="lazy" /></div>
				<div class="product__name">{p.name}</div>
				<div class="product__desc">{p.desc}</div>
				<div class="product__from">{p.from}</div>
			</a>
		{/each}
	</div>
	<p style="margin-top:32px"><a class="link" href="/prodotti">Vedi tutti i prodotti →</a></p>
</section>

<!-- ANTEPRIMA AUTOMATICA -->
<section class="section container" id="anteprima">
	<div class="preview">
		<div class="preview__panel">
			<span class="tag tag--blue">Anteprima automatica</span>
			<h2 style="margin-top:14px">Prima lo vedi.<br /><span class="hl hl--blue">Poi lo stampiamo.</span></h2>
			<p class="lead" style="margin-top:18px;font-size:17px">
				Carica il tuo file e scopri subito come prenderà forma il tuo adesivo. Niente attese, niente salti nel buio.
			</p>
			<ol class="steps">
				<li><span class="n">1</span><div><b>Carica il file</b><span>PNG, PDF, JPG, AI, SVG</span></div></li>
				<li><span class="n">2</span><div><b>Guarda il risultato</b><span>Sagoma e linea di taglio in pochi secondi</span></div></li>
				<li><span class="n">3</span><div><b>Decidi tu</b><span>Conferma, oppure chiedici una modifica</span></div></li>
				<li><span class="n">4</span><div><b>Controllo finale</b><span>Un umano controllerà manualmente che il tuo file rispetti i nostri standard prima di andare in stampa</span></div></li>
			</ol>
			<p class="note preview__beta">Il sistema è attualmente in fase beta solo per Adesivi personalizzati e Adesivi resinati.</p>
		</div>
		<div class="preview__right"><UploadPreview /></div>
	</div>
</section>

<!-- SOCIAL PROOF -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>Scelti da chi vuole adesivi<br /><span class="hl hl--yellow">fatti come si deve.</span></h2>
		<p class="lead" style="margin-top:22px">
			Il <strong>100%</strong> di chi ordina su <strong>Stickerprint</strong> sa esattamente cosa riceverà.<br />E torna a stampare con noi.
		</p>
		<div class="stats">
			<div class="stat stat--blue"><b>3K+</b><span>Ordini spediti</span></div>
			<div class="stat stat--yellow"><b>{data.stats.average.toLocaleString('it-IT', { minimumFractionDigits: 1 })} ★</b><span>Valutazione media</span></div>
			<div class="stat stat--pink"><b>5 gg</b><span>Media di produzione</span></div>
		</div>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- CREDITO -->
<section class="section container">
	<div class="credit">
		<div class="credit__visual"><img src="/images/credit-card.png" alt="Portafoglio Credito Stickerprint" width="492" height="423" loading="lazy" /></div>
		<div>
			<span class="tag tag--green">Il tuo prossimo ordine inizia da questo</span>
			<h2 style="margin-top:14px">Ogni ordine ti lascia <span class="hl hl--green">qualcosa.</span></h2>
			<p class="lead" style="margin-top:16px">Con ogni acquisto accumuli Credito Stickerprint. Lo trovi automaticamente nel tuo account e lo usi sul prossimo ordine.</p>
			<p style="margin-top:18px;font-weight:800">Più ordini fai, più guadagni.</p>
			<div class="credit__levels">
				<div class="credit__lv credit__lv--creator"><img src="/images/loyalty/creator.png" alt="" /><b>Creator</b><span class="credit__pct">2%</span><small>di credito</small></div>
				<div class="credit__lv credit__lv--partner"><img src="/images/loyalty/partner.png" alt="" /><b>Partner</b><span class="credit__pct">4%</span><small>di credito</small></div>
				<div class="credit__lv credit__lv--ambassador"><img src="/images/loyalty/ambassador.png" alt="" /><b>Ambassador</b><span class="credit__pct">6%</span><small>di credito</small></div>
			</div>
			<p class="note" style="margin-top:10px">Il tuo livello cresce insieme ai tuoi ordini.</p>
			<div class="credit__example"><span><b>100€</b> di prodotti</span><span class="arrow">→</span><span>fino a <b class="blue">6€</b> di credito</span></div>
			<p style="margin-top:20px"><a class="btn btn--green btn--lg" style="width:100%;text-align:center" href={data.user ? '/account' : '/signup'}>{data.user ? 'Vai al tuo account' : 'Crea il tuo account'}</a></p>
			<p class="note" style="margin-top:10px;text-align:center">Credito calcolato sul valore dei prodotti IVA esclusa. Validità 6 mesi.</p>
		</div>
	</div>
</section>

<!-- BUSINESS -->
<section class="section--tight container">
	<div class="business">
		<div class="business__text">
			<span class="tag tag--periwinkle">Stickerprint for business</span>
			<h2 style="margin-top:16px">Da grandi poteri derivano grandi <span class="hl hl--periwinkle">responsabilità.</span></h2>
			<p>Dalla prima prova alla produzione in quantità: affianchiamo aziende, agenzie e retail con un referente dedicato.</p>
			<p style="margin-top:30px"><a class="btn btn--periwinkle" href="/aziende">Scopri di più</a></p>
		</div>
		<div class="business__visual"><img src="/images/ig-4.jpg" alt="Etichette Gravelland in produzione" width="600" height="600" loading="lazy" /></div>
	</div>
</section>

<!-- CAMPIONI -->
<section class="section--tight container">
	<div class="samples">
		<div class="samples__pile"><img src="/images/sticker-pile.png" alt="Pila di adesivi campione Stickerprint" loading="lazy" /></div>
		<div class="samples__body">
			<span class="tag tag--yellow">Tocca con mano la qualità</span>
			<h2 style="margin-top:14px">Prova i nostri <span class="hl hl--yellow">adesivi</span></h2>
			<ul class="samples__list">
				<li><span class="ck">✓</span>Ricevi i nostri migliori adesivi</li>
				<li><span class="ck">✓</span>Tocchi con mano la nostra qualità</li>
				<li><span class="ck">✓</span>Provi tutti i nostri prodotti</li>
				<li><span class="ck">✓</span>Scegli il materiale perfetto per te</li>
				<li><span class="ck">✓</span>Li recuperi subito sul primo ordine</li>
			</ul>
		</div>
		<div class="samples__cta">
			<a class="btn btn--yellow btn--lg" href="/campioni">Ordina il kit</a>
			<div class="samples__price"><b>10€</b><span>Li recuperi <strong>subito</strong><br />sul primo ordine</span></div>
		</div>
	</div>
</section>

<!-- INSTAGRAM -->
<section class="section container ig">
	<div class="ig-head">
		<a class="tag tag--pink" href={IG_URL} target="_blank" rel="noopener" style="text-decoration:none">@stickerprint.it</a>
		<h2><span class="hl hl--pink">Più di <span class="ig-count" class:is-live={ig.live}>{followers.toLocaleString('it-IT')}</span> creativi sono già con noi.</span></h2>
		<p class="lead">Lavorazioni, novità e progetti reali <strong>LIVE</strong> direttamente dal nostro laboratorio.</p>
	</div>
	<div class="ig-grid">
		{#each ig.media as m (m.id)}
			<a href={m.permalink} target="_blank" rel="noopener" title={m.caption || 'Apri su Instagram'}>
				<img src={m.image} alt={m.caption || 'Post Instagram di Stickerprint'} width="600" height="600" loading="lazy" />
				{#if m.isVideo}<span class="ig-play" aria-hidden="true">▶</span>{/if}
			</a>
		{/each}
	</div>
<p class="center" style="margin-top:26px"><a class="btn btn--pink btn--lg" href={IG_URL} target="_blank" rel="noopener">Seguici su Instagram</a></p>
</section>

<!-- FINALE -->
<section class="section--tight container">
	<div class="final">
		<p class="kicker">Pronto a vederli dal vivo?</p>
		<h2>Carica il file.<br />Guarda subito l’anteprima.</h2>
		<p class="lead">Conferma quando sei soddisfatto. E con l’ordine, guadagni già credito per il prossimo.</p>
		<div class="final__cta">
			<a class="btn btn--blue btn--lg" href="/adesivi-personalizzati">Ordina ora</a>
			<div class="final__date">Spedizione prevista: <b>{data.shipDate}</b></div>
		</div>
	</div>
</section>
