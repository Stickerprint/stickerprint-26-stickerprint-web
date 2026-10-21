<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { data, form } = $props();
	let loading = $state(false);
</script>

<svelte:head><title>{t('account.login.titolo')}</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<span class="tag tag--green">{t('account.login.tag')}</span>
		<h1>{t('account.login.h1')}<br /><span class="hl hl--green">{t('account.login.h1Evidenza')}</span></h1>
		<p class="lead" style="color:#d9dcf2">{t('account.login.lead')}</p>
	</aside>
	<section class="auth__form">
		<h2>{t('account.login.h2')}</h2>
		<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
			<input type="hidden" name="next" value={data.next} />
			<div class="field">
				<label for="email">{t('account.login.email')}</label>
				<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
			</div>
			<div class="field">
				<label for="password">{t('account.login.password')}</label>
				<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--blue btn--lg" type="submit" disabled={loading}>{loading ? t('account.login.accesso') : t('account.login.accedi')}</button>
		</form>
		<p class="auth__alt"><a class="link" href={path('/reset-password')}>{t('account.login.dimenticata')}</a></p>
		<p class="auth__alt">{t('account.login.nonHaiAccount')} <a class="link" href={path('/signup')}>{t('account.login.registrati')}</a> {t('account.login.eGuadagna')}</p>
	</section>
</div>
