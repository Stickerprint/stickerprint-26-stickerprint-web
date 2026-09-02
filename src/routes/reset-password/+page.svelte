<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Reimposta password | Stickerprint</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<h1>Nessun <span class="hl hl--yellow">problema.</span></h1>
		<p class="lead" style="color:#d9dcf2">Ti mandiamo un link per scegliere una nuova password.</p>
	</aside>
	<section class="auth__form">
		<h2>Reimposta la password</h2>
		{#if form?.sent}
			<p class="success">Se <strong>{form.email}</strong> è registrata, riceverai a breve un link per reimpostare la password.</p>
		{:else}
			<form method="POST" use:enhance>
				<div class="field">
					<label for="email">Email</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required />
				</div>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--blue btn--lg" type="submit">Inviami il link</button>
			</form>
		{/if}
		<p class="auth__alt"><a class="link" href="/login">← Torna al login</a></p>
	</section>
</div>
