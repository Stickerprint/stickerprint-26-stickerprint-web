<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { form } = $props();
	/* l'email viene dall'utente: va protetta prima di entrare in {@html} */
	const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
</script>

<svelte:head><title>{t('account.reset.titolo')}</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<h1>{t('account.reset.h1')} <span class="hl hl--yellow">{t('account.reset.h1Evidenza')}</span></h1>
		<p class="lead" style="color:#d9dcf2">{t('account.reset.lead')}</p>
	</aside>
	<section class="auth__form">
		<h2>{t('account.reset.h2')}</h2>
		{#if form?.sent}
			<p class="success">{@html t('account.reset.inviato', { email: esc(form.email) })}</p>
		{:else}
			<form method="POST" use:enhance>
				<div class="field">
					<label for="email">{t('account.reset.email')}</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required />
				</div>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--blue btn--lg" type="submit">{t('account.reset.invia')}</button>
			</form>
		{/if}
		<p class="auth__alt"><a class="link" href={path('/login')}>{t('account.reset.tornaLogin')}</a></p>
	</section>
</div>
