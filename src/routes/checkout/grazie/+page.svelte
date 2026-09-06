<script lang="ts">
	import '$lib/styles/thanks.css';
	import { page } from '$app/state';
	let { data } = $props();
	const numbers = $derived((page.url.searchParams.get('n') ?? '').split(',').filter(Boolean));
	// stelle e scie sparse a caso (una volta sola)
	const stars = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, d: (i % 7) * 0.3 }));
	const streaks = Array.from({ length: 9 }, (_, i) => ({ x: 10 + ((i * 29) % 80), y: 8 + ((i * 41) % 84), d: 0.3 + i * 0.08 }));
	const areaHref = $derived(data.loggedIn ? '/account/ordini' : '/signup');
</script>

<svelte:head><title>Ordine ricevuto | Stickerprint</title></svelte:head>

<section class="thanks">
	<!-- il razzo Stickerprint parte a velocita' supersonica e si posa al centro -->
	<div class="launch" aria-hidden="true">
		{#each stars as s, i (i)}<span class="launch__star" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		{#each streaks as s, i (i)}<span class="launch__streak" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		<span class="launch__boom"></span><span class="launch__boom b2"></span>
		<div class="launch__rocket"><span class="fire"></span><span class="e">🚀</span></div>
		<div class="launch__idle"><span class="e">🚀</span></div>
	</div>

	<div class="container thanks__inner">
		<h1 class="launch-title thanks__ottimo">Ottimo!</h1>
		<div class="launch-rest">
			<p class="thanks__sub">Il tuo ordine è andato correttamente in produzione</p>
			<p class="thanks__line">e dovrebbe arrivare il <mark>{data.shipDate}</mark></p>
			{#if numbers.length}<p class="thanks__line">Numero d'ordine <mark>{numbers.join(', ')}</mark></p>{/if}
			<p class="thanks__meanwhile">Nel frattempo puoi controllare lo stato della produzione dalla tua<a href={areaHref}>area personale</a></p>

			{#if !data.loggedIn}
				<div class="thanks__reg">
					<img src="/images/coin-sp.png" alt="Credito Stickerprint" />
					<div>
						<b>Non sei ancora registrato?</b>
						<p>Registrati ora e inizia a guadagnare credito da spendere in negozio: il 2% di ogni ordine torna nel tuo portafoglio, fino al 6% salendo di livello.</p>
						<a class="btn btn--yellow" href="/signup">Registrati ora</a>
					</div>
				</div>
			{/if}

			<div class="thanks__btns">
				<a class="btn btn--pink btn--lg" href={areaHref}>Vai ai tuoi ordini</a>
				<a class="btn btn--purple btn--lg" href="/prodotti">Continua i tuoi acquisti</a>
			</div>
		</div>
	</div>
</section>
