<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Nuova password | Stickerprint</title></svelte:head>

<section class="container account" style="max-width:560px">
	<h1 style="font-size:clamp(30px,4vw,44px)">Scegli una nuova <span class="hl hl--blue">password.</span></h1>
	{#if form?.success}
		<p class="success">Password aggiornata. <a class="link" href="/account">Torna al tuo account →</a></p>
	{:else}
		<form method="POST" use:enhance style="display:grid;gap:16px">
			<div class="field">
				<label for="password">Nuova password (min. 8 caratteri)</label>
				<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
			</div>
			<div class="field">
				<label for="confirm">Ripeti la password</label>
				<input class="input" id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--blue btn--lg" type="submit">Salva la password</button>
		</form>
	{/if}
</section>
