<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { form } = $props();
	let sending = $state(false);
</script>

<Seo title={t('pagine.supportEmail.seoTitolo')} description={t('pagine.supportEmail.seoDescrizione')} />

<section class="section container" style="max-width:720px">
	<h1 style="font-size:clamp(30px,4vw,46px)">{t('pagine.supportEmail.titolo')}</h1>
	<p class="lead" style="margin-top:10px">{t('pagine.supportEmail.testo')}</p>
	<div class="card" style="padding:28px;margin-top:22px">
		{#if form?.ok}
			<p class="success">{t('pagine.supportEmail.ok')}</p>
		{:else}
			<form class="form2" method="POST" enctype="multipart/form-data" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }}>
				<div class="row">
					<label>{t('pagine.supportEmail.nome')}<input name="name" /></label>
					<label>{t('pagine.supportEmail.email')}<input name="email" type="email" required /></label>
				</div>
				<label>{t('pagine.supportEmail.ordine')}<input name="order_number" placeholder={t('pagine.supportEmail.ordinePlaceholder')} /></label>
				<label>{t('pagine.supportEmail.messaggio')}<textarea name="message" rows="6" required></textarea></label>
				<label>{t('pagine.supportEmail.allegato')}<input name="file" type="file" accept="image/*,.pdf,.zip" /></label>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? t('pagine.comuni.invio') : t('pagine.supportEmail.cta')}</button>
			</form>
		{/if}
	</div>
	<p class="note" style="margin-top:16px"><a class="link" href={path('/support')}>{t('pagine.supportEmail.torna')}</a></p>
</section>
