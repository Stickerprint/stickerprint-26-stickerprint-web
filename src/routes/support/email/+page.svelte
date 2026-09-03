<script lang="ts">
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	let { form } = $props();
	let sending = $state(false);
</script>

<svelte:head><title>Scrivi al servizio clienti | Stickerprint</title></svelte:head>

<section class="section container" style="max-width:720px">
	<h1 style="font-size:clamp(30px,4vw,46px)">Scrivi al servizio clienti</h1>
	<p class="lead" style="margin-top:10px">Ti rispondiamo in giornata, dal lunedì al venerdì. Se riguarda un ordine, indica il numero: facciamo prima.</p>
	<div class="card" style="padding:28px;margin-top:22px">
		{#if form?.ok}
			<p class="success">Messaggio ricevuto. Ti rispondiamo al più presto all’indirizzo indicato.</p>
		{:else}
			<form class="form2" method="POST" enctype="multipart/form-data" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }}>
				<div class="row">
					<label>Nome<input name="name" /></label>
					<label>E-mail*<input name="email" type="email" required /></label>
				</div>
				<label>Numero d’ordine (se c’è)<input name="order_number" placeholder="es. SP-1234" /></label>
				<label>Come possiamo aiutarti?*<textarea name="message" rows="6" required></textarea></label>
				<label>Allegato<input name="file" type="file" accept="image/*,.pdf,.zip" /></label>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? 'Invio…' : 'Invia il messaggio'}</button>
			</form>
		{/if}
	</div>
	<p class="note" style="margin-top:16px"><a class="link" href="/support">← Torna agli argomenti di aiuto</a></p>
</section>
