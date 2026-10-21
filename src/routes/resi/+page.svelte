<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import '$lib/styles/pages.css';
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t } = usaLingua();
	let { form } = $props();
	let sending = $state(false);
</script>

<Seo title={t('pagine.resi.seoTitolo')} description={t('pagine.resi.seoDescrizione')} />

<section class="section container">
	<div class="split2" style="align-items:start">
		<div>
			<h1 style="font-size:clamp(32px,4.4vw,54px);line-height:1.04">{t('pagine.resi.titolo')}</h1>
			<p class="lead" style="margin-top:14px"><b>{t('pagine.resi.forte')}</b></p>
			<p class="lead">{t('pagine.resi.testo')}</p>
			<p class="ph__label" style="margin-top:18px">{t('pagine.resi.comeFunziona')}</p>
			<ul class="checks">
				<li><span class="ck">✓</span>{t('pagine.resi.p1')}</li>
				<li><span class="ck">✓</span>{t('pagine.resi.p2')}</li>
				<li><span class="ck">✓</span>{t('pagine.resi.p3')}</li>
				<li><span class="ck">✓</span>{t('pagine.resi.p4')}</li>
				<li><span class="ck">✓</span>{t('pagine.resi.p5')}</li>
			</ul>
		</div>
		<div class="card" style="padding:28px">
			{#if form?.ok}
				<p class="success">{t('pagine.resi.ok')}</p>
			{:else}
				<form class="form2" method="POST" enctype="multipart/form-data" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }}>
					<label>{t('pagine.resi.email')}<input name="email" type="email" required /></label>
					<label>{t('pagine.resi.ordine')}<input name="order_number" required placeholder={t('pagine.resi.ordinePlaceholder')} /></label>
					<label>{t('pagine.resi.problema')}<textarea name="message" rows="5" required></textarea></label>
					<label>{t('pagine.resi.foto')}<input name="file" type="file" accept="image/*" required /></label>
					{#if form?.error}<p class="error">{form.error}</p>{/if}
					<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? t('pagine.comuni.invio') : t('pagine.resi.cta')}</button>
				</form>
			{/if}
		</div>
	</div>
</section>
