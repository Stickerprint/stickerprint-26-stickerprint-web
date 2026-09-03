<script lang="ts">
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	let { form } = $props();
	let sending = $state(false);
</script>

<svelte:head>
	<title>Resi e problemi con l’ordine | Stickerprint</title>
	<meta name="description" content="Qualcosa non è andato come previsto? Succede raramente. Quando succede, ce ne occupiamo noi." />
</svelte:head>

<section class="section container">
	<div class="split2" style="align-items:start">
		<div>
			<h1 style="font-size:clamp(32px,4.4vw,54px);line-height:1.04">Qualcosa non è andato come previsto?</h1>
			<p class="lead" style="margin-top:14px"><b>Succede raramente. Quando succede, ce ne occupiamo noi.</b></p>
			<p class="lead">Controlliamo ogni ordine con attenzione per mantenere un alto standard qualitativo. Gli imprevisti sono l’eccezione, non la regola. Se qualcosa non torna, siamo qui per risolvere.</p>
			<p class="ph__label" style="margin-top:18px">Come funziona:</p>
			<ul class="checks">
				<li><span class="ck">✓</span>Verifichiamo ogni ordine prima della stampa</li>
				<li><span class="ck">✓</span>Se c’è un problema, lo analizziamo caso per caso</li>
				<li><span class="ck">✓</span>Bastano numero d’ordine e qualche foto</li>
				<li><span class="ck">✓</span>Ti rispondiamo in tempi rapidi</li>
				<li><span class="ck">✓</span>Troviamo la soluzione migliore, senza rimbalzi</li>
			</ul>
		</div>
		<div class="card" style="padding:28px">
			{#if form?.ok}
				<p class="success">Segnalazione ricevuta. La analizziamo e ti rispondiamo a breve.</p>
			{:else}
				<form class="form2" method="POST" enctype="multipart/form-data" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }}>
					<label>Indirizzo email*<input name="email" type="email" required /></label>
					<label>Numero d’ordine*<input name="order_number" required placeholder="es. SP-1234" /></label>
					<label>Descrivi il problema*<textarea name="message" rows="5" required></textarea></label>
					<label>Foto del problema*<input name="file" type="file" accept="image/*" required /></label>
					{#if form?.error}<p class="error">{form.error}</p>{/if}
					<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? 'Invio…' : 'Contattaci per risolvere'}</button>
				</form>
			{/if}
		</div>
	</div>
</section>
