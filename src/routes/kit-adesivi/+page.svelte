<script lang="ts">
	import '$lib/styles/pages.css';
	import '$lib/styles/product.css';
	import '$lib/styles/kit.css';
	import KitBuilder from '$lib/components/KitBuilder.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>Kit di adesivi personalizzati · Stickerprint</title>
	<meta name="description" content="Bustina trasparente con cavallotto personalizzato e fino a 6 adesivi diversi. Carica i file, guarda il kit comporsi, ordina da 10 kit." />
</svelte:head>

<section class="container hero2">
	<div>
		<h1>Kit di adesivi.<br /><span class="hl hl--yellow">Sei adesivi, una bustina, il tuo cavallotto.</span></h1>
		<p class="lead">Il regalo, il merch, il gadget da banco: una bustina trasparente con la tua linguetta personalizzata e dentro fino a sei adesivi diversi, tutti dello stesso materiale. Carica i file e guardali cadere nella bustina.</p>
		<ul class="checks">
			<li><span class="ck">✓</span>Da 10 kit in su</li>
			<li><span class="ck">✓</span>Fino a 6 adesivi diversi per kit</li>
			<li><span class="ck">✓</span>Cavallotto stampato con il tuo file</li>
			<li><span class="ck">✓</span>Stesso materiale e stessa misura per tutto il kit</li>
			<li><span class="ck">✓</span>Spedizione stimata {data.shipDate} · gratuita da 50 €</li>
		</ul>
	</div>
</section>

<section class="section container" id="kit">
	<KitBuilder cfg={data.engine} shipDate={data.shipDate} />
</section>

<section class="section container center">
	<h2><span class="hl hl--purple">Come funziona</span></h2>
	<div class="split" style="margin-top:24px;text-align:left">
		<div>
			<ul class="checks">
				<li><span class="ck">✓</span><b>Cavallotto</b>: carichi un file (logo, grafica, nome). Lo impaginiamo sulla linguetta piegata in cima alla bustina, fronte e retro.</li>
				<li><span class="ck">✓</span><b>Adesivi</b>: un file per ogni adesivo, fino a sei. Ognuno viene scontornato dal nostro motore come un adesivo personalizzato sagomato.</li>
				<li><span class="ck">✓</span><b>Materiale e misura</b>: li scegli una volta e valgono per tutto il kit. Olografico? Tutti e sei olografici.</li>
				<li><span class="ck">✓</span><b>Prova prima della stampa</b>: come per tutti i nostri prodotti, vedi il risultato e diamo l'ok insieme.</li>
			</ul>
		</div>
		<div>
			<ul class="checks">
				<li><span class="ck">✓</span>Confezionato a mano, bustina richiudibile.</li>
				<li><span class="ck">✓</span>Prezzo per kit che scende con la quantità.</li>
				<li><span class="ck">✓</span>Ideale per eventi, negozi, merch, packaging e regali.</li>
			</ul>
		</div>
	</div>
</section>
