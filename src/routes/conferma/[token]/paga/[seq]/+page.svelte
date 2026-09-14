<script lang="ts">
	/* Cassa simulata: stessa struttura di Stripe Checkout, nessun addebito. Quando arrivano le chiavi Stripe questa pagina non si vede più. */
	import { enhance } from '$app/forms';
	import { money } from '$lib/dashboard/orders';
	let { data, form } = $props();
	let paying = $state(false);
	let card = $state('4242 4242 4242 4242');
	let exp = $state('12 / 28');
	let cvc = $state('123');
	let name = $state(data.order.customer);
</script>

<svelte:head><title>Pagamento ordine {data.order.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="sim">
	<div class="sim__box">
		<div class="sim__summary">
			<a class="sim__back" href="/conferma/{typeof location !== 'undefined' ? location.pathname.split('/')[2] : ''}">← Torna alla conferma</a>
			<div class="sim__brand">Stickerprint</div>
			<p class="sim__label">Ordine {data.order.number}{#if data.payment.of > 1} · scadenza {data.payment.seq} di {data.payment.of}{/if}</p>
			<p class="sim__amount">{money(data.payment.amount)}</p>
			<p class="sim__meta">{data.payment.method} · IVA inclusa</p>
			<div class="sim__test">SIMULAZIONE · nessun addebito. Con le chiavi Stripe qui c'è la cassa vera (carta, Apple Pay, Google Pay, PayPal).</div>
		</div>
		<form method="POST" class="sim__form" use:enhance={() => { paying = true; return async ({ update }) => { await update(); paying = false; }; }}>
			<div class="sim__wallets"><span>🍎 Apple Pay</span><span>G Pay</span><span>PayPal</span></div>
			<div class="sim__or"><span>oppure paga con la carta</span></div>
			<label>Email<input type="email" value={data.order.email ?? ''} readonly /></label>
			<label>Dati della carta<input bind:value={card} inputmode="numeric" /><div class="sim__row"><input bind:value={exp} placeholder="MM / AA" /><input bind:value={cvc} placeholder="CVC" /></div></label>
			<label>Nome sulla carta<input bind:value={name} /></label>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="sim__pay" type="submit" disabled={paying}>{paying ? 'Elaborazione…' : `Paga ${money(data.payment.amount)}`}</button>
			<p class="sim__foot">🔒 Pagamento protetto · Stickerprint Srl</p>
		</form>
	</div>
</section>

<style>
	.sim { min-height: 80vh; background: #f6f7fb; display: grid; place-items: center; padding: 30px 16px; }
	.sim__box { display: grid; grid-template-columns: 1fr 1fr; width: 100%; max-width: 920px; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(11,11,59,.12); }
	.sim__summary { background: var(--navy); color: #fff; padding: 34px 32px; display: grid; gap: 8px; align-content: start; }
	.sim__back { color: #d9dcf2; font-size: 13px; text-decoration: none; }
	.sim__brand { font-family: var(--font-display); font-weight: 800; letter-spacing: .06em; text-transform: uppercase; font-size: 13px; color: var(--yellow); margin-top: 10px; }
	.sim__label { color: #d9dcf2; font-size: 14px; margin: 6px 0 0; }
	.sim__amount { font-family: var(--font-display); font-size: 40px; margin: 0; letter-spacing: -0.02em; }
	.sim__meta { color: #d9dcf2; font-size: 13px; margin: 0; }
	.sim__test { margin-top: 20px; background: rgba(255,255,255,.1); border: 1px dashed rgba(255,255,255,.4); border-radius: 12px; padding: 10px 12px; font-size: 12.5px; line-height: 1.45; }
	.sim__form { padding: 34px 32px; display: grid; gap: 14px; align-content: start; }
	.sim__wallets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.sim__wallets span { display: grid; place-items: center; height: 44px; border-radius: 10px; background: #0b0b3b; color: #fff; font-weight: 800; font-size: 14px; }
	.sim__or { text-align: center; font-size: 12px; color: var(--muted); position: relative; }
	.sim__or::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid var(--line); }
	.sim__or span { background: #fff; padding: 0 10px; position: relative; }
	.sim__form label { display: grid; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
	.sim__form input { padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 15px; color: var(--ink); }
	.sim__row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
	.sim__pay { background: #0e8bff; color: #fff; border: 0; border-radius: 10px; padding: 14px; font: inherit; font-weight: 800; font-size: 16px; cursor: pointer; }
	.sim__pay:disabled { opacity: .6; }
	.sim__foot { text-align: center; color: var(--muted); font-size: 12px; margin: 0; }
	@media (max-width: 760px) { .sim__box { grid-template-columns: 1fr; } }
</style>
