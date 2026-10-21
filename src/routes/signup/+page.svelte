<script lang="ts">
	import { enhance } from '$app/forms';
	import { track } from '$lib/tracking';
	import { page } from '$app/state';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { form } = $props();
	/* l'email viene dall'utente: va protetta prima di entrare in {@html} */
	const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
	$effect(() => { if (form?.success) track.signUp(null, false); });
	let kind = $state<'privato' | 'azienda'>('privato');
	const next = $derived(page.url.searchParams.get('next') ?? path('/account'));
	let loading = $state(false);
</script>

<svelte:head><title>{t('account.signup.titolo')}</title></svelte:head>

<div class="auth">
	<aside class="auth__side">
		<span class="tag tag--green">{t('account.signup.tag')}</span>
		<h1>{t('account.signup.h1')} <span class="hl hl--green">{t('account.signup.h1Evidenza')}</span></h1>
		<p class="lead" style="color:#d9dcf2">{t('account.signup.lead')}</p>
	</aside>
	<section class="auth__form">
		{#if form?.success}
			<h2>{t('account.signup.quasiFatto')}</h2>
			{#if form.needsConfirmation}
				<p class="success">{@html t('account.signup.emailInviata', { email: esc(form.email) })}</p>
			{:else}
				<p class="success">{t('account.signup.creato')} <a class="link" href={path('/account')}>{t('account.signup.vaiAccount')}</a></p>
			{/if}
		{:else}
			<h2>{t('account.signup.h2')}</h2>
			<form method="POST" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; await update(); }; }}>
				<input type="hidden" name="next" value={next} />
				<div class="kind-toggle" role="radiogroup" aria-label={t('account.signup.tipoCliente')}>
					<label class:is-on={kind === 'privato'}><input type="radio" name="customer_type" value="privato" bind:group={kind} /> {t('account.signup.privato')}</label>
					<label class:is-on={kind === 'azienda'}><input type="radio" name="customer_type" value="azienda" bind:group={kind} /> {t('account.signup.azienda')}</label>
				</div>
				{#if kind === 'azienda'}
					<div class="field-row">
						<div class="field"><label for="company_name">{t('account.signup.ragioneSociale')}</label><input class="input" id="company_name" name="company_name" required /></div>
						<div class="field"><label for="vat_number">{t('account.signup.piva')}</label><input class="input" id="vat_number" name="vat_number" required /></div>
					</div>
				{/if}
				<div class="field-row">
					<div class="field">
						<label for="first_name">{t('account.signup.nome')}</label>
						<input class="input" id="first_name" name="first_name" autocomplete="given-name" required value={form?.fullName?.split(' ')[0] ?? ''} />
					</div>
					<div class="field">
						<label for="last_name">{t('account.signup.cognome')}</label>
						<input class="input" id="last_name" name="last_name" autocomplete="family-name" required value={form?.fullName?.split(' ').slice(1).join(' ') ?? ''} />
					</div>
				</div>
				<div class="field">
					<label for="email">{t('account.signup.email')}</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<div class="field">
					<label for="phone">{t('account.signup.telefono')} <small style="font-weight:500;color:var(--muted)">{t('account.signup.telefonoNota')}</small></label>
					<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" />
				</div>
				<div class="field">
					<label for="password">{t('account.signup.password')}</label>
					<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
				</div>
				<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px">
					<input type="checkbox" name="newsletter" style="margin-top:4px" />
					<span>{t('account.signup.newsletter')}</span>
				</label>
				<label style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px">
					<input type="checkbox" name="privacy" required style="margin-top:4px" />
					<span>{@html t('account.signup.privacy', { href: path('/privacy') })}</span>
				</label>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--green btn--lg" type="submit" disabled={loading}>{loading ? t('account.signup.creazione') : t('account.signup.registrati')}</button>
			</form>
			<p class="auth__alt">{t('account.signup.haiAccount')} <a class="link" href="{path('/login')}?next={encodeURIComponent(next)}">{t('account.signup.accedi')}</a></p>
			<p class="note" style="margin-top:12px">{t('account.signup.ospite')}</p>
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
