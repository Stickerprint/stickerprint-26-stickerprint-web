<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Area amministratore | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<span class="tag tag--yellow">Area amministratore</span>
		<h1>Bentornato <span class="hl hl--yellow">amministratore</span></h1>
		<p class="lead" style="color:#d9dcf2">Produzione, fatturazione, marketing: tutto in un unico posto.</p>
	</aside>
	<section class="auth__form">
		<h2>Accedi</h2>
		<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
			<div class="field">
				<label for="email">Nome utente (email)</label>
				<input class="input" id="email" name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--blue btn--lg" type="submit" disabled={loading}>{loading ? 'Accesso…' : 'Entra'}</button>
		</form>
		<p class="auth__alt"><a class="link" href="/reset-password">Password dimenticata?</a></p>
	</section>
</div>
