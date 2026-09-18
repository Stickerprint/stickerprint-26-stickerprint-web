<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const BRAND: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', diners: 'Diners', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay' };
	const two = (n: number) => String(n).padStart(2, '0');
	const expired = (c: { expMonth: number; expYear: number }) => { const d = new Date(); return c.expYear < d.getFullYear() || (c.expYear === d.getFullYear() && c.expMonth < d.getMonth() + 1); };
</script>

<svelte:head><title>Pagamenti | Stickerprint</title></svelte:head>
<div class="acc__head"><div><p class="eyebrow">Area personale</p><h1>Pagamenti</h1><p class="lead">Le carte salvate per fare prima al checkout.</p></div></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Carta rimossa.</p>{/if}
<div class="acard">
	<h3>Carte salvate</h3>
	{#if data.cards.length === 0}
		<p class="empty">Nessuna carta salvata. Al prossimo ordine, pagando con carta, lascia attiva la casella <b>“Salva la carta nel mio account”</b>: la ritrovi qui e al checkout paghi con un click.</p>
	{:else}
		{#each data.cards as c (c.id)}
			<div class="orow orow--act">
				<div>
					<div class="orow__title">{BRAND[c.brand] ?? 'Carta'} •••• {c.last4}</div>
					<div class="orow__spec">Scade {two(c.expMonth)}/{c.expYear}{#if expired(c)} · <b style="color:#b3261e">scaduta</b>{/if}</div>
				</div>
				<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={c.id} /><button class="link-btn" type="submit">Rimuovi</button></form>
			</div>
		{/each}
	{/if}
	<p class="sub" style="margin-top:12px">🔒 I dati delle carte sono custoditi da Stripe: sul nostro sito non passano e non restano. Qui vedi solo marca, ultime 4 cifre e scadenza. Apple Pay, Google Pay e PayPal non si salvano: li scegli direttamente al checkout.</p>
</div>
