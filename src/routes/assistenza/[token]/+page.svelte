<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, locale } = usaLingua();
	let { data, form } = $props();
	const tk = $derived(data.ticket);
	const stato = $derived(t(`account.assistenza.stati.${tk.status}`));
	const when = (d: string) => new Date(d).toLocaleString(locale.intl, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let body = $state('');
</script>

<svelte:head><title>{t('account.assistenza.titolo', { n: tk.number })}</title><meta name="robots" content="noindex" /></svelte:head>

<section class="section" style="padding-top:40px">
	<div class="container" style="max-width:760px">
		<p class="kicker">{t('account.assistenza.kicker', { n: tk.number, stato })}</p>
		<h1 style="margin-bottom:8px">{t('account.assistenza.h1', { nome: tk.name?.split(' ')[0] || '' })}</h1>
		<p class="lead">{t('account.assistenza.lead')}{#if tk.order_number}&nbsp;{t('account.assistenza.ordineCollegato')} <b>{tk.order_number}</b>.{/if}</p>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		{#if form?.ok}<p class="ok">{t('account.assistenza.inviato')}</p>{/if}

		<div class="hd-thread" style="margin-top:22px">
			{#each data.messages as m (m.id)}
				<div class="hd-msg hd-msg--{m.direction}">
					<div class="hd-msg__head"><b>{m.direction === 'in' ? t('account.doc.tu') : t('account.doc.stickerprint')}</b><span class="note">{when(m.created_at)}</span></div>
					<div class="hd-msg__body">{m.body}</div>
					{#if data.files[m.id]?.length}<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">{#each data.files[m.id] as f (f.href)}<a class="link" style="font-size:13px" href={f.href} target="_blank" rel="noopener">📎 {f.name}</a>{/each}</div>{/if}
				</div>
			{/each}
		</div>

		<form method="POST" use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') body = ''; }} enctype="multipart/form-data" class="panel" style="display:grid;gap:10px;margin-top:22px">
			<label style="display:grid;gap:6px;font-weight:700;font-size:14px">{t('account.assistenza.rispondi')}<textarea name="body" bind:value={body} rows="4" required style="padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit"></textarea></label>
			<label style="display:grid;gap:6px;font-size:13px">{t('account.assistenza.allegato')}<input name="file" type="file" accept="image/*,.pdf,.zip" /></label>
			<button class="btn btn--blue" type="submit" style="justify-self:start" disabled={!body.trim()}>{t('account.assistenza.invia')}</button>
		</form>
	</div>
</section>
