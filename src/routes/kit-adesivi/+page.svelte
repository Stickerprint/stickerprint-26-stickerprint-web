<script lang="ts">
	import '$lib/styles/pages.css';
	import '$lib/styles/product.css';
	import '$lib/styles/kit.css';
	import KitBuilder from '$lib/components/KitBuilder.svelte';
	import Carousel from '$lib/components/Carousel.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import HowTo from '$lib/components/HowTo.svelte';
	import SamplesBlock from '$lib/components/SamplesBlock.svelte';
	import FaqList from '$lib/components/FaqList.svelte';
	import FinalCta from '$lib/components/FinalCta.svelte';
	let { data } = $props();

	/* foto dei kit: le quattro dell'hero e quella del tavolo per "Zero ansia" */
	const GALLERY = ['/images/prodotti/kit/1.webp', '/images/prodotti/kit/2.webp', '/images/prodotti/kit/3.webp', '/images/prodotti/kit/4.webp'];
	/* le tre foto di "Cosa stai stampando" */
	const MOSAIC = ['/images/prodotti/kit/other-1.webp', '/images/prodotti/kit/other-2.webp', '/images/prodotti/kit/other-3.webp'];
	const avg = $derived((data.stats?.average ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	/* domande frequenti del kit (se in dashboard c'e' la categoria FAQ del kit, vince quella) */
	const FAQ = [
		{ q: 'Quanti adesivi posso mettere in un kit?', a: 'Fino a 6 adesivi diversi tra loro. Carichi un file per ogni adesivo e ognuno viene scontornato come un adesivo sagomato. Puoi anche farne meno di sei: il prezzo del kit scende di conseguenza.' },
		{ q: 'Gli adesivi possono avere materiali o misure diverse?', a: 'No. Tutti gli adesivi del kit condividono la stessa misura, lo stesso materiale e la stessa finitura: è quello che rende il kit un prodotto unico e coerente. Se vuoi materiali diversi, puoi ordinare più kit.' },
		{ q: 'Cosa devo caricare per il cavallotto?', a: 'Un solo file con la tua grafica (logo, nome della collezione, illustrazione). Lo impaginiamo noi sulla linguetta piegata in cima alla bustina, stampata fronte e retro e fissata con due punti metallici. Nell’anteprima vedi subito come viene.' },
		{ q: 'Qual è la quantità minima?', a: 'Si parte da 10 kit. Il prezzo per kit scende salendo di quantità: 50, 100, 250, 500 e 1000 kit.' },
		{ q: 'Che misura hanno gli adesivi del kit?', a: 'Scegli tu il lato lungo: 40, 50, 60 o 80 mm. La misura vale per tutti gli adesivi del kit, e la vedi in anteprima dentro la bustina prima di ordinare.' },
		{ q: 'Posso vedere il kit prima di pagare?', a: 'Sì. Mentre carichi i file l’anteprima si compone in tempo reale: cavallotto, bustina e adesivi. Prima di stampare controlliamo comunque a mano ogni file e, se troviamo un problema, fermiamo la stampa e ti contattiamo.' },
		{ q: 'Come arrivano i kit?', a: 'Già confezionati a mano: bustina trasparente chiusa dal cavallotto, adesivi dentro. Pronti da vendere, regalare o inserire nei tuoi ordini, senza altro lavoro da parte tua.' }
	];
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
	<p class="lead" style="margin-top:16px">Non stai ordinando una semplice manciata di adesivi. Stai creando un prodotto completo.</p>
	<p class="lead" style="margin-top:12px">Ogni bustina viene confezionata a mano nel nostro laboratorio, ed è pronta per essere venduta, regalata o inserita nei tuoi ordini.</p>
	<p style="margin-top:20px"><span class="pill pill--yellow">Ideale per creator, artisti, brand, negozi, eventi e welcome kit.</span></p>
	<div class="mosaic">
		{#each MOSAIC as src (src)}<img {src} alt="" loading="lazy" />{/each}
	</div>
</section>

<!-- RECENSIONI -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>Cosa dicono di <span class="hl hl--yellow">questi kit.</span></h2>
		<p class="lead" style="margin-top:18px">Ordini reali. Risultati concreti. Valutazione media {avg} su 5.</p>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- COME FUNZIONA -->
<HowTo shipDate={data.shipDate} />

<!-- KIT CAMPIONI -->
<SamplesBlock />

<!-- FAQ -->
<FaqList items={data.faq?.length ? data.faq : FAQ} title="Le domande" hl="più frequenti." intro={`Cerchi altre risposte? Guarda la nostra <a class="link" href="/support" style="color:var(--blue)">sezione di supporto</a>.`} />

<!-- CTA FINALE -->
<FinalCta shipDate={data.shipDate} href="#kit" label="Voglio i miei kit" />
