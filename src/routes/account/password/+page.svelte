<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { form } = $props();
</script>

<svelte:head><title>{t('account.password.titolo')}</title></svelte:head>

<section class="container account" style="max-width:560px">
	<h1 style="font-size:clamp(30px,4vw,44px)">{t('account.password.h1')} <span class="hl hl--blue">{t('account.password.h1Evidenza')}</span></h1>
	{#if form?.success}
		<p class="success">{t('account.password.aggiornata')} <a class="link" href={path('/account')}>{t('account.password.tornaAccount')}</a></p>
	{:else}
		<form method="POST" use:enhance style="display:grid;gap:16px">
			<div class="field">
				<label for="password">{t('account.password.nuova')}</label>
				<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
			</div>
			<div class="field">
				<label for="confirm">{t('account.password.ripeti')}</label>
				<input class="input" id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--blue btn--lg" type="submit">{t('account.password.salva')}</button>
		</form>
	{/if}
</section>
