<script lang="ts">
	import '$lib/styles/thanks.css';
	import { page } from '$app/state';
	const numbers = $derived((page.url.searchParams.get('n') ?? '').split(',').filter(Boolean));
	// stelle e scie sparse a caso (una volta sola)
	const stars = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, d: (i % 7) * 0.3 }));
	const streaks = Array.from({ length: 9 }, (_, i) => ({ x: 10 + ((i * 29) % 80), y: 8 + ((i * 41) % 84), d: 0.3 + i * 0.08 }));
</script>

<svelte:head><title>Ordine ricevuto | Stickerprint</title></svelte:head>

<section class="section container center" style="max-width:860px">
	<!-- il razzo Stickerprint parte a velocita' supersonica -->
	<div class="launch" aria-hidden="true">
		{#each stars as s, i (i)}<span class="launch__star" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		{#each streaks as s, i (i)}<span class="launch__streak" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		<span class="launch__boom"></span><span class="launch__boom b2"></span>
		<div class="launch__rocket"><span class="fire"></span><span class="e">🚀</span><img class="logo" src="/images/splogo-400.png" alt="" /></div>
		<div class="launch__idle"><span class="e">🚀</span><img class="logo" src="/images/splogo-400.png" alt="" /></div>
	</div>

	<h1 class="launch-title" style="font-size:clamp(30px,4vw,46px);margin-top:26px">Ottimo! <span class="hl hl--green">Il tuo ordine è andato correttamente in produzione.</span></h1>

	<div class="launch-rest">
		{#if numbers.length}<p class="lead" style="margin-top:10px">Numero ordine: <b>{numbers.join(', ')}</b></p>{/if}
		<div class="card" style="text-align:left;margin-top:26px;padding:24px 28px">
			<ol style="display:grid;gap:12px;padding-left:22px;font-size:15.5px">
				<li><b>Pagamento ricevuto:</b> conferma d’ordine e fattura sono in arrivo via email.</li>
				<li><b>Controlliamo il tuo file</b> e ti mandiamo la prova automatica: la approvi con un click (o ci dici cosa cambiare).</li>
				<li><b>Dopo il tuo ok</b> stampiamo, tagliamo e confezioniamo.</li>
				<li><b>Spediamo con corriere tracciato</b>: il codice arriva via email e nell’area personale.</li>
			</ol>
		</div>
		<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:26px">
			<a class="btn btn--green btn--lg" href="/account/ordini">Vai ai tuoi ordini</a>
			<a class="btn btn--ghost btn--lg" href="/prodotti">Continua gli acquisti</a>
		</div>
	</div>
</section>
