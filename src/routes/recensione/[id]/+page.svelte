<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo } = usaLingua();
	let { data, form } = $props();
	let stars = $state(5);
	let sending = $state(false);
	/* il codice sconto della recensione vale dai 50 € di ordine (regola del coupon, non la soglia di spedizione) */
	const MINIMO_CODICE_EUR = 50;
</script>

<svelte:head><title>{t('pagine.recensione.seoTitolo')}</title></svelte:head>

<section class="section container" style="max-width:640px">
	<p class="eyebrow">{t('pagine.recensione.ordine', { numero: data.number })}</p>
	<h1 style="font-size:clamp(28px,4vw,42px)">{data.name ? t('pagine.recensione.comeAndataNome', { nome: data.name }) : t('pagine.recensione.comeAndata')}</h1>
	<p class="lead">{@html t('pagine.recensione.testo')}</p>
	{#if data.items.length}<ul style="margin:14px 0 22px;padding-left:18px;color:#3d3f63">{#each data.items as i (i)}<li>{i}</li>{/each}</ul>{/if}
	{#if data.done || form?.ok}
		<div class="card" style="padding:26px;text-align:center">
			<p style="font-size:22px;margin:0 0 6px">{t('pagine.recensione.grazie')}</p>
			<p style="margin:0;color:#3d3f63">{t('pagine.recensione.arrivata')}</p>
			{#if form?.code ?? data.code}
				<div style="margin:18px auto 0;max-width:420px;background:#fef6db;border-radius:14px;padding:16px">
					<div style="font-size:12px;letter-spacing:.08em;color:#8a5a00;font-weight:800">{t('pagine.recensione.codiceLabel')}</div>
					<div style="font-family:var(--font-display);font-size:30px;letter-spacing:.06em;margin:4px 0">{form?.code ?? data.code}</div>
					<div style="font-size:13px;color:#8a5a00">{t('pagine.recensione.codiceNota', { minimo: prezzo(MINIMO_CODICE_EUR, 0) })}</div>
				</div>
			{/if}
			<a class="btn btn--green" style="margin-top:18px" href={path('/')}>{t('pagine.recensione.torna')}</a>
		</div>
	{:else}
		<form method="POST" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }} class="card" style="padding:26px;display:grid;gap:14px">
			<input type="hidden" name="r" value={data.requestId} />
			<div class="stars-in" style="display:flex;gap:6px;font-size:36px;cursor:pointer">{#each [1, 2, 3, 4, 5] as n (n)}<label style="color:{n <= stars ? '#f5b301' : '#d6d9e2'}"><input type="radio" name="rating" value={n} checked={n === stars} onchange={() => (stars = n)} hidden />★</label>{/each}</div>
			<label>{t('pagine.recensione.titoloCampo')}<input class="input" name="title" maxlength="120" placeholder={t('pagine.recensione.titoloPlaceholder')} /></label>
			<label>{t('pagine.recensione.esperienza')}<textarea class="input" name="comment" rows="5" maxlength="2000" placeholder={t('pagine.recensione.esperienzaPlaceholder')}></textarea></label>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? t('pagine.comuni.invio') : t('pagine.recensione.cta')}</button>
			<p class="note" style="margin:0">{t('pagine.recensione.nota')}</p>
		</form>
	{/if}
</section>
