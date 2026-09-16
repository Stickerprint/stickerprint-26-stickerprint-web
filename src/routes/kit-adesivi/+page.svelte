<script lang="ts">
	import '$lib/styles/pages.css';
	import '$lib/styles/product.css';
	import '$lib/styles/kit.css';
	import KitBuilder from '$lib/components/KitBuilder.svelte';
	import Carousel from '$lib/components/Carousel.svelte';
	import Stars from '$lib/components/Stars.svelte';
	let { data } = $props();

	/* foto dei kit: le quattro dell'hero e quella del tavolo per "Zero ansia" */
	const GALLERY = ['/images/prodotti/kit/1.webp', '/images/prodotti/kit/2.webp', '/images/prodotti/kit/3.webp', '/images/prodotti/kit/4.webp'];
	/* le tre foto di "Cosa stai stampando": in attesa di quelle definitive, intanto tre dei kit */
	const MOSAIC = ['/images/prodotti/kit/5.webp', '/images/prodotti/kit/2.webp', '/images/prodotti/kit/3.webp'];
</script>

<svelte:head>
	<title>Kit di adesivi personalizzati con cavallotto | Stickerprint</title>
	<meta name="description" content="Crea il tuo kit di adesivi personalizzati con fino a 6 grafiche, bustina trasparente e cavallotto stampato. Confezionato e pronto da vendere o regalare." />
</svelte:head>

<!-- HERO -->
<section class="container ph">
	<div>
		<h1>Pacchetti di adesivi <span class="hl hl--yellow">personalizzati.</span></h1>
		<p class="ph__desc" style="margin-top:18px">Crea il tuo sticker pack pronto da vendere, regalare o inserire nei tuoi ordini. Personalizzi gli adesivi e il cavallotto; noi stampiamo, tagliamo e confezioniamo ogni bustina.</p>
		{#if data.stats?.total}<div class="ph__stars" style="margin-top:14px"><Stars value={data.stats.average} count={data.stats.total} size={22} /></div>{/if}
		<ul class="ph__list" style="margin-top:22px">
			<li><span class="ck">✓</span><span>Fino a 6 adesivi diversi in ogni kit</span></li>
			<li><span class="ck">✓</span><span>Cavallotto personalizzato fronte e retro</span></li>
			<li><span class="ck">✓</span><span>Anteprima completa prima di ordinare</span></li>
			<li><span class="ck">✓</span><span>Confezionati a mano e pronti da distribuire</span></li>
			<li><span class="ck">✓</span><span>A partire da 10 kit</span></li>
			<li><span class="ck">✓</span><span>Spedizione stimata <mark class="ph__date">{data.shipDate}</mark> · gratuita da 50 €</span></li>
		</ul>
		<a class="ph__go" href="#kit">Configura il tuo kit qui sotto ↓</a>
	</div>
	<Carousel images={GALLERY} alt="Kit di adesivi personalizzati con cavallotto" />
</section>

<!-- CONFIGURATORE -->
<section class="container" id="kit" style="scroll-margin-top:80px">
	<KitBuilder cfg={data.engine} shipDate={data.shipDate} />
</section>

<!-- ZERO ANSIA -->
<section class="section container">
	<div class="split">
		<img src="/images/prodotti/kit/care.webp" alt="Kit di adesivi Wild Goods con i sei adesivi sagomati sul tavolo" loading="lazy" />
		<div>
			<h2>Zero ansia. <span class="hl hl--green">Ci pensiamo noi.</span></h2>
			<p class="lead">Più grafiche, un solo prodotto, nessuna complicazione. Prima di stampare controlliamo che ogni elemento del kit funzioni come deve.</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Controllo manuale del cavallotto e di ogni adesivo</li>
				<li><span class="ck">✓</span>Verifica di qualità, taglio, margini e proporzioni</li>
				<li><span class="ck">✓</span>Anteprima automatica del kit prima del pagamento</li>
				<li><span class="ck">✓</span>Se troviamo un problema, fermiamo la stampa e ti contattiamo</li>
				<li><span class="ck">✓</span>Confezionamento finale eseguito e controllato a mano</li>
			</ul>
			<p class="lead" style="margin-top:16px"><b>Tu carichi le grafiche. Noi ti consegniamo i kit pronti.</b></p>
		</div>
	</div>
</section>

<!-- COSA STAI STAMPANDO -->
<section class="section container center">
	<h2><span class="hl hl--yellow">Cosa stai stampando esattamente?</span></h2>
	<p class="lead" style="margin-top:16px">Non stai ordinando una semplice manciata di adesivi. Stai creando un prodotto completo: una bustina trasparente, fino a sei adesivi sagomati e un cavallotto personalizzato stampato fronte e retro, piegato e fissato con due punti metallici.</p>
	<p class="lead" style="margin-top:12px">Tutti gli adesivi del kit condividono la stessa misura, lo stesso materiale e la stessa finitura. Ogni bustina viene confezionata a mano ed è pronta per essere venduta, regalata o inserita nei tuoi ordini.</p>
	<p style="margin-top:20px"><span class="pill pill--yellow">Ideale per creator, artisti, brand, negozi, eventi e welcome kit.</span></p>
	<div class="mosaic">
		{#each MOSAIC as src (src)}<img {src} alt="" loading="lazy" />{/each}
	</div>
</section>
