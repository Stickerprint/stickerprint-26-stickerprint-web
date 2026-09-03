<script lang="ts">
	import { page } from '$app/state';
	const numbers = $derived((page.url.searchParams.get('n') ?? '').split(',').filter(Boolean));
</script>

<svelte:head><title>Ordine ricevuto | Stickerprint</title></svelte:head>

<section class="section container center" style="max-width:760px">
	<span style="display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--green);font-size:30px;font-weight:800">✓</span>
	<h1 style="font-size:clamp(30px,4vw,46px);margin-top:16px">Ordine ricevuto. <span class="hl hl--green">Grazie!</span></h1>
	{#if numbers.length}<p class="lead" style="margin-top:10px">Numero ordine: <b>{numbers.join(', ')}</b></p>{/if}
	<div class="card" style="text-align:left;margin-top:26px;padding:24px 28px">
		<ol style="display:grid;gap:12px;padding-left:22px;font-size:15.5px">
			<li><b>Controlliamo il tuo file</b> e prepariamo la prova di stampa.</li>
			<li><b>Ti mandiamo la prova via email</b>: la approvi con un click (o ci dici cosa cambiare).</li>
			<li><b>Solo dopo il tuo ok</b> andiamo in stampa e addebitiamo il pagamento.</li>
			<li><b>Spediamo con corriere tracciato</b>: il codice arriva nella tua area personale.</li>
		</ol>
	</div>
	<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:26px">
		<a class="btn btn--green btn--lg" href="/account/ordini">Vai ai tuoi ordini</a>
		<a class="btn btn--ghost btn--lg" href="/prodotti">Continua gli acquisti</a>
	</div>
</section>
