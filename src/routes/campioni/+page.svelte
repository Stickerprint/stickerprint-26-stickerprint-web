<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/product.css';
	import '$lib/styles/pages.css';
	import { addToCart } from '$lib/cart';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo, data: dataIn } = usaLingua();
	let { data } = $props();
	let added = $state(false);
	// Reel YouTube del kit campioni: inserire qui i link (anche Shorts)
	import LiteYouTube from '$lib/components/LiteYouTube.svelte';
	const REELS: string[] = [];
	const ytId = (u: string) => u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] ?? u;
	/* prezzo del kit in euro: nella pagina si mostra con prezzo() (dollari in /us) */
	const KIT_EUR = 10;
	const prezzoKit = $derived(prezzo(KIT_EUR, 0));
	function add() {
		addToCart({ product: 'campioni', productName: t('header.kitCampioni'), forma: 'kit', materiale: 'misto', w: 0, h: 0, qty: 1, net: Math.round((KIT_EUR / 1.22) * 100) / 100, gross: KIT_EUR, fileName: null, filePath: 'campioni', note: '' });
		added = true;
	}
</script>

<Seo title={t('pagine.campioni.seoTitolo', { prezzo: prezzoKit })} description={t('pagine.campioni.seoDescrizione', { prezzo: prezzoKit })} />

<section class="container hero2 hero2--about">
	<div>
		<span class="tag tag--yellow">{t('pagine.campioni.tag')}</span>
		<h1 style="margin-top:14px"><span class="hl hl--yellow">{t('pagine.campioni.titolo')}</span></h1>
		<p class="lead">{@html t('pagine.campioni.testo', { prezzo: prezzoKit })}</p>
		<ul class="checks">
			<li><span class="ck">✓</span>{t('pagine.campioni.p1')}</li>
			<li><span class="ck">✓</span>{t('pagine.campioni.p2')}</li>
			<li><span class="ck">✓</span>{t('pagine.campioni.p3')}</li>
		</ul>
		<div class="kit-buy">
			<span class="kit-buy__price hl hl--yellow">{prezzoKit}</span>
			<button type="button" class="btn btn--yellow btn--lg" onclick={add}>{t('pagine.campioni.aggiungi')}</button>
		</div>
		<p class="note" style="margin-top:10px">{@html t('pagine.campioni.spedizione', { data: dataIn(data.shipDate, true) })}</p>
	</div>
	<div class="reels reels--kit">
		{#if REELS.length}
			{#each REELS as r (r)}<LiteYouTube id={ytId(r)} title={t('pagine.campioni.reelTitolo')} />{/each}
		{:else}
			<div class="reel reel--soon"><span>▶</span><small>{t('pagine.comuni.reelInArrivo')}</small></div>
		{/if}
	</div>
</section>


{#if added}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="added-bg" onclick={(e) => { if (e.target === e.currentTarget) added = false; }} onkeydown={(e) => { if (e.key === 'Escape') added = false; }}>
		<div class="added" role="dialog" aria-modal="true" aria-label={t('pagine.comuni.aggiuntoCarrello')}>
			<span class="added__ck">✓</span>
			<h3>{t('pagine.campioni.aggiuntoTitolo')}</h3>
			<p>{t('pagine.campioni.aggiuntoTesto', { prezzo: prezzoKit })}</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href={path('/checkout')}>{t('pagine.comuni.vaiCheckout')}</a>
				<a class="btn btn--ghost btn--lg" href={path('/prodotti')}>{t('pagine.comuni.continuaAcquisti')}</a>
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
