<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>Accedi | Stickerprint</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<span class="tag tag--green">Area clienti</span>
		<h1>Bentornato.<br /><span class="hl hl--green">Stampiamo?</span></h1>
		<p class="lead" style="color:#d9dcf2">Ordini, prove di stampa, fatture e il tuo Credito Stickerprint: tutto in un posto solo.</p>
	</aside>
	<section class="auth__form">
		<h2>Accedi</h2>
		<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
			<input type="hidden" name="next" value={data.next} />
			<div class="field">
				<label for="email">Email</label>
				<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--blue btn--lg" type="submit" disabled={loading}>{loading ? 'Accesso…' : 'Accedi'}</button>
		</form>
		<p class="auth__alt"><a class="link" href="/reset-password">Password dimenticata?</a></p>
		<p class="auth__alt">Non hai un account? <a class="link" href="/signup">Registrati</a> e inizia a guadagnare il 5% di credito.</p>
	</section>
</div>
