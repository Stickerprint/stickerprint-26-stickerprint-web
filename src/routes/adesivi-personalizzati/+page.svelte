<script lang="ts">
	import '$lib/styles/product.css';
	import Carousel from '$lib/components/Carousel.svelte';
	import Configurator from '$lib/components/Configurator.svelte';
	import Faq from '$lib/components/Faq.svelte';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';

	let { data } = $props();

	const gallery = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `/images/prodotti/adesivi-personalizzati/${i}.webp`);

	const faq = [
		{ q: 'Cosa significa taglio sagomato?', a: 'Il taglio sagomato segue esattamente il contorno del tuo design, eliminando il bordo bianco rettangolare. L’adesivo viene tagliato su misura con una macchina di precisione che segue la forma del tuo file grafico, creando un risultato professionale e pulito.' },
		{ q: 'Serve la stampa del colore bianco?', a: 'In genere no. I nostri adesivi personalizzati vengono stampati su vinile bianco, quindi il bianco è già presente come base. Il colore bianco in stampa serve solo se hai bisogno di un bianco coprente su materiali trasparenti o colorati.' },
		{ q: 'Quanto resiste all’esterno?', a: 'I nostri adesivi personalizzati sono realizzati in vinile di alta qualità con lamina protettiva. Resistono a pioggia, sole, vento e freddo. In condizioni normali mantengono colori brillanti e aderenza per diversi anni, anche in ambienti esterni.' },
		{ q: 'Come viene protetto l’adesivo?', a: 'Ogni adesivo viene rivestito con una lamina protettiva trasparente che lo protegge da graffi, raggi UV, umidità e usura quotidiana. Questa protezione mantiene i colori vividi e la superficie intatta nel tempo.' }
	];
</script>

<svelte:head>
	<title>Adesivi personalizzati | Stickerprint</title>
	<meta name="description" content="Adesivi personalizzati stampati in Italia: materiali premium, taglio sagomato, prova di stampa gratuita. Configura e ordina online." />
</svelte:head>

<!-- TESTATA -->
<section class="container ph">
	<div>
		<h1>Adesivi personalizzati</h1>
		<p class="ph__sub">Fatti bene. Punto.</p>
		<div class="ph__stars"><span class="stars">{'★'.repeat(Math.round(data.stats.average))}</span> {data.stats.total} recensioni</div>
		<p class="ph__desc">Materiali premium. Stampa di alta qualità. Taglio preciso.<br />Carichi il file, al resto pensiamo noi.</p>
		<p class="ph__label">Su ogni ordine:</p>
		<ul class="ph__list">
			<li><span class="ck">✓</span>Prova di stampa gratuita</li>
			<li><span class="ck">✓</span>Spedizione veloce: pronti per la spedizione il <em>{data.shipShort}</em></li>
			<li><span class="ck">✓</span>Stampiamo solo se viene bene</li>
			<li><span class="ck">✓</span>Nessuna sorpresa sul risultato</li>
		</ul>
		<a class="ph__go" href="#configura">Configura i tuoi Adesivi personalizzati qui sotto ↓</a>
	</div>
	<Carousel images={gallery} alt="Adesivi personalizzati Stickerprint" />
</section>

<!-- PREVENTIVATORE -->
<section class="container">
	<Configurator shipDate={data.shipDate} />
</section>

<!-- ZERO ANSIA -->
<section class="section container">
	<div class="split">
		<img src="/images/prodotti/adesivi-personalizzati/other-2.webp" alt="Adesivo olografico tenuto in mano" loading="lazy" />
		<div>
			<h2>Zero ansia. <span class="hl hl--green">Ci pensiamo noi.</span></h2>
			<p class="lead">È il tuo primo ordine? Non ti preoccupare.<br />Ecco la checklist che eseguiamo su ogni ordine:</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Controllo manuale di ogni file</li>
				<li><span class="ck">✓</span>Se serve, sistemiamo il file prima di stampare</li>
				<li><span class="ck">✓</span>Ti mandiamo una prova da approvare</li>
				<li><span class="ck">✓</span>Vedrai esattamente come realizzeremo il tuo adesivo</li>
				<li><span class="ck">✓</span>Solo dopo il tuo ok andiamo in stampa</li>
			</ul>
		</div>
	</div>
</section>

<!-- COSA STAI STAMPANDO -->
<section class="section container center">
	<h2><span class="hl hl--yellow">Cosa stai stampando, esattamente</span></h2>
	<p class="lead" style="margin-top:16px">Adesivi tagliati su misura e stampati per durare. Colori pieni, dettagli puliti, materiali che reggono uso, tempo e spedizioni.<br />Li attacchi, li spedisci, li fai girare. E fanno il loro lavoro. A lungo.</p>
	<div class="mosaic">
		<img src="/images/prodotti/adesivi-personalizzati/other-3.webp" alt="Adesivi olografici su un bicchiere di birra" loading="lazy" />
		<img src="/images/prodotti/adesivi-personalizzati/other-4.webp" alt="Tre adesivi sagomati su legno" loading="lazy" />
		<img src="/images/prodotti/adesivi-personalizzati/8.webp" alt="Adesivo su borraccia" loading="lazy" />
	</div>
</section>

<!-- FAQ -->
<section class="section container">
	<div class="faq-wrap">
		<div>
			<h2>Domande frequenti sugli <span class="hl hl--blue">Adesivi personalizzati</span></h2>
			<p class="lead" style="margin-top:16px">Cerchi risposte? Dai un’occhiata a queste domande correlate o cerca nella nostra <a class="link" href="/support" style="color:var(--blue)">sezione di supporto</a>.</p>
		</div>
		<Faq items={faq} />
	</div>
</section>

<!-- RECENSIONI DEL PRODOTTO -->
<section class="section container">
	<div class="panel panel--navy social-proof center">
		<h2>Cosa dicono di questi <span class="hl hl--yellow">adesivi.</span></h2>
		<p class="lead" style="margin-top:18px">{data.stats.total} recensioni verificate sugli Adesivi personalizzati, valutazione media {data.stats.average.toLocaleString('it-IT')} su 5.</p>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>
