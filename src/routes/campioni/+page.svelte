<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/product.css';
	import '$lib/styles/pages.css';
	import { addToCart } from '$lib/cart';
	let { data } = $props();
	let added = $state(false);
	// Reel YouTube del kit campioni: inserire qui i link (anche Shorts)
	import LiteYouTube from '$lib/components/LiteYouTube.svelte';
	const REELS: string[] = [];
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	function add() {
		addToCart({ product: 'campioni', productName: 'Kit campioni', forma: 'kit', materiale: 'misto', w: 0, h: 0, qty: 1, net: Math.round((10 / 1.22) * 100) / 100, gross: 10, fileName: null, filePath: 'campioni', note: '' });
		added = true;
	}
</script>

<Seo title="Kit campioni a 10 € | Stickerprint" description="Scopri materiali e finiture dei nostri adesivi personalizzati, resinati e in rilievo: pacchetto campioni a 10 € con spedizione gratuita." />

<section class="container hero2 hero2--about">
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
			<span class="kit-buy__price hl hl--yellow">10€</span>
			<button type="button" class="btn btn--yellow btn--lg" onclick={add}>Aggiungi al carrello</button>
		</div>
		<p class="note" style="margin-top:10px">🚀 Spedizione stimata <b>{data.shipDate}</b> · nessun file da caricare</p>
	</div>
	<div class="reels reels--kit">
		{#if REELS.length}
			{#each REELS as r (r)}<LiteYouTube id={ytId(r)} title="Kit campioni Stickerprint" />{/each}
		{:else}
			<div class="reel reel--soon"><span>▶</span><small>Reel in arrivo</small></div>
		{/if}
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
	.kit-buy { display: flex; align-items: center; gap: 18px; margin-top: 22px; flex-wrap: wrap; }
	@media (max-width: 700px) { .kit-buy { flex-direction: column; align-items: stretch; gap: 14px; } .kit-buy__price { font-size: 54px; text-align: center; align-self: center; } .kit-buy .btn { width: 100%; } }
	.kit-buy__price { font-family: var(--font-display); font-weight: 800; font-size: 60px; letter-spacing: -0.03em; color: var(--ink); line-height: 1; }
	.reels--kit { grid-template-columns: minmax(0, 300px); justify-content: end; margin-top: 0; }
	@media (max-width: 900px) { .reels--kit { justify-content: center; } }
</style>
