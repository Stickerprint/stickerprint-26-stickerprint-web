<script lang="ts">
	import '$lib/styles/thanks.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { readCart, clearCart } from '$lib/cart';
	import { deleteCartFile } from '$lib/utils/draftStore';
	import { track, cartItems } from '$lib/tracking';
	let { data } = $props();
	const numbers = $derived(data.paid?.numbers ?? (page.url.searchParams.get('n') ?? '').split(',').filter(Boolean));
	/* ritorno da Stripe: il carrello si svuota qui e l'acquisto viene tracciato una volta sola */
	onMount(() => {
		const paid = data.paid;
		if (!paid) return;
		try {
			const key = `sp-purchase-${paid.group}`;
			if (!sessionStorage.getItem(key)) {
				sessionStorage.setItem(key, '1');
				const p = paid.payload;
				track.purchase({ orderNumber: p.numbers[0], items: cartItems(p.items), value: p.toPay, tax: p.vatAmount, paymentType: p.payment === 'paypal' ? 'PayPal' : p.payment === 'wallet' ? 'Apple Pay / Google Pay' : 'Carta di credito', express: p.express, coupon: p.discountCode, discount: Math.round(p.discount * 1.22 * 100) / 100, returning: false, userId: p.userId, user: { email: p.email, phone: p.ship.phone ?? '', first_name: p.ship.first_name ?? '', last_name: p.ship.last_name ?? '', street: p.ship.street ?? '', city: p.ship.city ?? '', province: p.ship.province ?? '', zip: p.ship.zip ?? '' } });
			}
			for (const it of readCart()) deleteCartFile(it.id);
			clearCart();
		} catch { /* niente da fare */ }
	});
	// stelle e scie sparse a caso (una volta sola)
	const stars = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, d: (i % 7) * 0.3 }));
	const streaks = Array.from({ length: 9 }, (_, i) => ({ x: 10 + ((i * 29) % 80), y: 8 + ((i * 41) % 84), d: 0.3 + i * 0.08 }));
	const areaHref = $derived(data.loggedIn ? '/account/ordini' : '/signup');
</script>

<svelte:head><title>Ordine ricevuto | Stickerprint</title></svelte:head>

<section class="thanks">
	<!-- il razzo Stickerprint parte a velocita' supersonica e si posa al centro -->
	<div class="launch" aria-hidden="true">
		{#each stars as s, i (i)}<span class="launch__star" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		{#each streaks as s, i (i)}<span class="launch__streak" style="left:{s.x}%;top:{s.y}%;animation-delay:{s.d}s"></span>{/each}
		<span class="launch__boom"></span><span class="launch__boom b2"></span>
		<div class="launch__rocket"><span class="fire"></span><span class="e">🚀</span></div>
		<div class="launch__idle"><span class="e">🚀</span></div>
	</div>

	<div class="container thanks__inner">
		<h1 class="launch-title thanks__ottimo">Ottimo!</h1>
		<div class="launch-rest">
			{#if data.ppError && !data.pending}<p class="thanks__sub">Il pagamento PayPal non è andato a buon fine ({data.ppError}). Torna al <a href="/checkout">checkout</a> e riprova.</p>
			{:else if data.pending}<p class="thanks__sub">Stiamo aspettando la conferma del pagamento: appena arriva ricevi l'email con la fattura.</p>
			{:else}<p class="thanks__sub">Il tuo ordine è andato correttamente in produzione</p>{/if}
			<p class="thanks__line">spedizione stimata <mark>{data.shipDate}</mark></p>
			{#if numbers.length}<p class="thanks__line">Numero d'ordine <mark>{numbers.join(', ')}</mark></p>{/if}
			<p class="thanks__meanwhile">Nel frattempo puoi controllare lo stato della produzione dalla tua<a href={areaHref}>area personale</a></p>

			{#if !data.loggedIn}
				<div class="thanks__reg">
					<img src="/images/coin-sp.png" alt="Credito Stickerprint" />
					<div>
						<b>Non sei ancora registrato?</b>
						<p>Registrati ora e inizia a guadagnare credito da spendere in negozio: il 2% di ogni ordine torna nel tuo portafoglio, fino al 6% salendo di livello.</p>
						<a class="btn btn--yellow" href="/signup">Registrati ora</a>
					</div>
				</div>
			{/if}

			<div class="thanks__btns">
				<a class="btn btn--pink btn--lg" href={areaHref}>Vai ai tuoi ordini</a>
				<a class="btn btn--purple btn--lg" href="/prodotti">Continua i tuoi acquisti</a>
			</div>
		</div>
	</div>
</section>
