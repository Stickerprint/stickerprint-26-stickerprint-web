<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t } = usaLingua();
	let { data, form } = $props();
	const BRAND: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', diners: 'Diners', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay' };
	const two = (n: number) => String(n).padStart(2, '0');
	const expired = (c: { expMonth: number; expYear: number }) => { const d = new Date(); return c.expYear < d.getFullYear() || (c.expYear === d.getFullYear() && c.expMonth < d.getMonth() + 1); };
</script>

<svelte:head><title>{t('account.pagamenti.titolo')}</title></svelte:head>
<div class="acc__head"><div><p class="eyebrow">{t('account.layout.areaPersonale')}</p><h1>{t('account.pagamenti.h1')}</h1><p class="lead">{t('account.pagamenti.lead')}</p></div></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">{t('account.pagamenti.rimossa')}</p>{/if}
<div class="acard">
	<h3>{t('account.pagamenti.carteSalvate')}</h3>
	{#if data.cards.length === 0}
		<p class="empty">{@html t('account.pagamenti.nessuna')}</p>
	{:else}
		{#each data.cards as c (c.id)}
			<div class="orow orow--act">
				<div>
					<div class="orow__title">{BRAND[c.brand] ?? t('account.pagamenti.carta')} •••• {c.last4}</div>
					<div class="orow__spec">{t('account.pagamenti.scade', { mese: two(c.expMonth), anno: c.expYear })}{#if expired(c)} · <b style="color:#b3261e">{t('account.pagamenti.scaduta')}</b>{/if}</div>
				</div>
				<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={c.id} /><button class="link-btn" type="submit">{t('account.pagamenti.rimuovi')}</button></form>
			</div>
		{/each}
	{/if}
	<p class="sub" style="margin-top:12px">{t('account.pagamenti.nota')}</p>
</div>
