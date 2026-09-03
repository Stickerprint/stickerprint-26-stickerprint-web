<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Registrati | Stickerprint</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<span class="tag tag--green">Il tuo prossimo ordine inizia da questo</span>
		<h1>Ogni ordine ti lascia <span class="hl hl--green">qualcosa.</span></h1>
		<p class="lead" style="color:#d9dcf2">Con l’account guadagni fino al 6% in Credito Stickerprint su ogni acquisto, riordini in un click e trovi tutte le tue prove di stampa.</p>
	</aside>
	<section class="auth__form">
		{#if form?.success}
			<h2>Manca un passaggio.</h2>
			{#if form.needsConfirmation}
				<p class="success">Ti abbiamo inviato un’email a <strong>{form.email}</strong>: clicca il link per confermare l’account.</p>
			{:else}
				<p class="success">Account creato. <a class="link" href="/account">Vai al tuo account →</a></p>
			{/if}
		{:else}
			<h2>Crea il tuo account</h2>
			<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
				<div class="field">
					<label for="full_name">Nome e cognome</label>
					<input class="input" id="full_name" name="full_name" autocomplete="name" required value={form?.fullName ?? ''} />
				</div>
				<div class="field">
					<label for="email">Email</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<div class="field">
					<label for="password">Password (min. 8 caratteri)</label>
					<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
				</div>
				<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px">
					<input type="checkbox" name="privacy" required style="margin-top:4px" />
					<span>Ho letto la <a class="link" href="/privacy">privacy policy</a> e accetto il trattamento dei dati.</span>
				</label>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--green btn--lg" type="submit" disabled={loading}>{loading ? 'Creazione…' : 'Registrati'}</button>
			</form>
			<p class="auth__alt">Hai già un account? <a class="link" href="/login">Accedi</a></p>
		{/if}
	</section>
</div>
