<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	let { form } = $props();
	let kind = $state<'privato' | 'azienda'>('privato');
	const next = $derived(page.url.searchParams.get('next') ?? '/account');
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
			<h2>Quasi fatto.</h2>
			{#if form.needsConfirmation}
				<p class="success">Ti abbiamo inviato un’email a <strong>{form.email}</strong>: clicca il link per confermare l’account.</p>
			{:else}
				<p class="success">Account creato. <a class="link" href="/account">Vai al tuo account →</a></p>
			{/if}
		{:else}
			<h2>Crea il tuo account</h2>
			<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
				<input type="hidden" name="next" value={next} />
				<div class="kind-toggle" role="radiogroup" aria-label="Tipo di cliente">
					<label class:is-on={kind === 'privato'}><input type="radio" name="customer_type" value="privato" bind:group={kind} /> 👤 Privato</label>
					<label class:is-on={kind === 'azienda'}><input type="radio" name="customer_type" value="azienda" bind:group={kind} /> 🏢 Azienda</label>
				</div>
				{#if kind === 'azienda'}
					<div class="field-row">
						<div class="field"><label for="company_name">Ragione sociale</label><input class="input" id="company_name" name="company_name" required /></div>
						<div class="field"><label for="vat_number">Partita IVA</label><input class="input" id="vat_number" name="vat_number" required /></div>
					</div>
				{/if}
				<div class="field-row">
					<div class="field">
						<label for="first_name">Nome</label>
						<input class="input" id="first_name" name="first_name" autocomplete="given-name" required value={form?.fullName?.split(' ')[0] ?? ''} />
					</div>
					<div class="field">
						<label for="last_name">Cognome</label>
						<input class="input" id="last_name" name="last_name" autocomplete="family-name" required value={form?.fullName?.split(' ').slice(1).join(' ') ?? ''} />
					</div>
				</div>
				<div class="field">
					<label for="email">Email</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<div class="field">
					<label for="phone">Telefono <small style="font-weight:500;color:var(--muted)">(facoltativo, per le spedizioni)</small></label>
					<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" />
				</div>
				<div class="field">
					<label for="password">Password (min. 8 caratteri)</label>
					<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
				</div>
				<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px">
					<input type="checkbox" name="newsletter" style="margin-top:4px" />
					<span>Voglio ricevere novità e offerte via email (puoi disiscriverti quando vuoi).</span>
				</label>
				<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px">
					<input type="checkbox" name="privacy" required style="margin-top:4px" />
					<span>Ho letto la <a class="link" href="/privacy">privacy policy</a> e accetto il trattamento dei dati.</span>
				</label>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--green btn--lg" type="submit" disabled={loading}>{loading ? 'Creazione…' : 'Registrati'}</button>
			</form>
			<p class="auth__alt">Hai già un account? <a class="link" href="/login?next={encodeURIComponent(next)}">Accedi</a></p>
			<p class="note" style="margin-top:12px">Hai già ordinato come ospite? Registrati con la stessa email: ordini e fatture compariranno subito nella tua area personale.</p>
		{/if}
	</section>
</div>

<style>
	.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.kind-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
	.kind-toggle label { display: flex; justify-content: center; gap: 8px; padding: 10px; border: 2px solid var(--line); border-radius: 12px; cursor: pointer; font-weight: 800; }
	.kind-toggle label.is-on { border-color: var(--blue); background: #f4f9ff; }
	.kind-toggle input { display: none; }
	@media (max-width: 600px) { .field-row { grid-template-columns: 1fr; } }
</style>
