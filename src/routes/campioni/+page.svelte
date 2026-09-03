<script lang="ts">
	import '$lib/styles/product.css';
	import '$lib/styles/pages.css';
	import { addToCart } from '$lib/cart';
	let { data } = $props();
	let added = $state(false);
	// Reel YouTube del kit campioni: inserire qui i link (anche Shorts)
	const REELS: string[] = [];
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	const ITEMS: { img: string; title: string; lines: string[] }[] = [
		{ img: 'camp1', title: '2x Adesivo Bianco', lines: ['Con protezione lucida e opaca'] },
		{ img: 'camp2', title: '2x Adesivo Trasparente', lines: ['Con protezione lucida e opaca', 'Con base di bianco e senza base di bianco'] },
		{ img: 'camp3', title: '2x Adesivo Glitterato', lines: ['Con protezione lucida', 'Con base di bianco e senza base di bianco'] },
		{ img: 'camp4', title: '2x Adesivo Argento Cromo', lines: ['Con protezione lucida e opaca', 'Con base di bianco e senza base di bianco'] },
		{ img: 'camp5', title: '2x Adesivo Oro Cromo', lines: ['Con protezione lucida e opaca', 'Con base di bianco e senza base di bianco'] },
		{ img: 'camp6', title: '2x Adesivo Olografico', lines: ['Con protezione lucida', 'Con base di bianco e senza base di bianco'] },
		{ img: 'camp7', title: '1x Adesivo Resinato Bianco', lines: [] },
		{ img: 'camp8', title: '1x Adesivo Resinato Oro Cromo', lines: ['Con base di bianco e senza base di bianco'] },
		{ img: 'camp9', title: '1x Adesivo Resinato Argento Cromo', lines: ['Con base di bianco e senza base di bianco'] },
		{ img: 'camp10', title: '1x Adesivo Resinato Bianco Super Adesivo', lines: [] },
		{ img: 'camp11', title: '1x Adesivo Resinato Trasparente', lines: ['Con base di bianco e senza base di bianco'] },
		{ img: 'camp12', title: '2x Adesivo Bianco in Rilievo', lines: ['Con finitura lucida e opaca'] }
	];
	function add() {
		addToCart({ product: 'campioni', productName: 'Kit campioni', forma: 'kit', materiale: 'misto', w: 0, h: 0, qty: 1, net: Math.round((10 / 1.22) * 100) / 100, gross: 10, fileName: null, filePath: 'campioni', note: '' });
		added = true;
	}
</script>

<svelte:head>
	<title>Kit campioni a 10 € | Stickerprint</title>
	<meta name="description" content="Scopri materiali e finiture dei nostri adesivi personalizzati, resinati e in rilievo: pacchetto campioni a 10 € con spedizione gratuita." />
</svelte:head>

<section class="container hero2">
	<div>
		<span class="tag tag--yellow">Offerta speciale</span>
		<h1 style="margin-top:14px"><span class="hl hl--yellow">Ordina un pacchetto di campioni</span></h1>
		<p class="lead">Scopri i materiali e le combinazioni che utilizziamo per preparare fantastici adesivi personalizzati, adesivi resinati e adesivi in rilievo. Tutto incluso in questo pacchetto di campioni per <b>10 euro e spedizione gratuita</b>.</p>
		<ul class="checks">
			<li><span class="ck">✓</span>Ricevi i nostri migliori adesivi</li>
			<li><span class="ck">✓</span>Tocchi con mano la nostra qualità</li>
			<li><span class="ck">✓</span>Li recuperi subito sul primo ordine</li>
		</ul>
		<div class="kit-buy">
			<span class="kit-buy__price">10€</span>
			<button type="button" class="btn btn--green btn--lg" onclick={add}>Aggiungi al carrello</button>
		</div>
		<p class="note" style="margin-top:10px">🚀 Pronti per la spedizione il <b>{data.shipDate}</b> · nessun file da caricare</p>
	</div>
	<div class="reels reels--kit">
		{#if REELS.length}
			{#each REELS as r (r)}<iframe class="reel" src="https://www.youtube.com/embed/{ytId(r)}" title="Kit campioni Stickerprint" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>{/each}
		{:else}
			<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
		{/if}
	</div>
</section>

<section class="section container">
	<h2 class="center"><span class="hl hl--green">Cosa c’è dentro</span></h2>
	<p class="lead center" style="margin-top:14px;max-width:760px;margin-inline:auto">In questo pacchetto di adesivi troverai una selezione dei nostri prodotti: adesivi fustellati, adesivi in rilievo e adesivi resinati realizzati con materiali e finiture diverse, perfetti per toccare con mano la nostra qualità e scegliere lo stile più adatto ai tuoi progetti.</p>
	<div class="kit-grid">
		{#each ITEMS as it (it.img)}
			<div class="kit-item">
				<img src="/images/campioni/{it.img}.webp" alt={it.title} loading="lazy" />
				<b>{it.title}</b>
				{#each it.lines as l (l)}<small>{l}</small>{/each}
			</div>
		{/each}
	</div>
</section>

{#if added}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="added-bg" onclick={(e) => { if (e.target === e.currentTarget) added = false; }} onkeydown={(e) => { if (e.key === 'Escape') added = false; }}>
		<div class="added" role="dialog" aria-modal="true" aria-label="Prodotto aggiunto al carrello">
			<span class="added__ck">✓</span>
			<h3>Kit campioni aggiunto al carrello</h3>
			<p>10 € · spedizione gratuita</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href="/checkout">Vai al checkout →</a>
				<a class="btn btn--ghost btn--lg" href="/prodotti">Continua gli acquisti</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.kit-buy { display: flex; align-items: center; gap: 18px; margin-top: 22px; }
	.kit-buy__price { font-family: var(--font-display); font-weight: 800; font-size: 44px; letter-spacing: -0.03em; color: var(--blue); }
	.reels--kit { grid-template-columns: minmax(0, 320px); margin-top: 0; }
	.kit-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 30px; }
	.kit-item { display: grid; justify-items: center; text-align: center; gap: 4px; padding: 14px; background: #fff; border: 1px solid var(--line); border-radius: 18px; }
	.kit-item img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; margin-bottom: 6px; }
	.kit-item b { font-size: 14px; }
	.kit-item small { font-size: 12px; color: var(--muted); }
	@media (max-width: 900px) { .kit-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
