<script lang="ts">
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import Stars from '$lib/components/Stars.svelte';
	import { money } from '$lib/dashboard/orders';
	import { paymentLabel } from '$lib/dashboard/payments';
	let { data, form } = $props();
	const o = $derived(data.order);
	const first = $derived(o.first_name?.trim() || o.customer);
	const it = (d: string | null) => (d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
	const due = $derived(data.payments.filter((p) => p.upfront && p.status === 'da_pagare').reduce((a, p) => a + p.amount, 0));
	const waiting = $derived(o.status === 'attesa_pagamento' || due > 0);
	const initials = $derived((data.sender ?? 'SP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
	const when = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let asking = $state(false);
	let reporting = $state(false);
	let sending = $state(false);
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; reporting = false; }; };
	const token = () => (typeof location !== 'undefined' ? location.pathname.split('/')[2] : '');
	const STEP: Record<string, string> = { attesa_pagamento: 'In attesa del pagamento anticipato', modifiche_richieste: 'Fermo: stiamo controllando la tua segnalazione', in_produzione: 'In lavorazione', pronto: 'Pronto, in partenza', in_spedizione: 'In partenza', spedito: 'Spedito', in_consegna: 'In consegna', consegnato: 'Consegnato', annullato: 'Annullato' };
</script>

<svelte:head><title>Conferma d'ordine {o.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">Conferma d'ordine {o.number} · {it(o.created_at)}</p>
			<h1>Ciao {first}, il tuo ordine è <span class="hl">registrato</span> 📦</h1>
			<p class="qp__lead">
				{#if waiting}Controlla i dettagli qui sotto: appena arriva il pagamento anticipato di <b>{money(due)}</b> la commessa entra in lavorazione, e ricevi l'anteprima di stampa da approvare prima di andare in macchina.
				{:else}Controlla i dettagli qui sotto: se è tutto giusto non devi fare niente. Prima di stampare ricevi l'anteprima da approvare; poi partiamo.{/if}
				<b class="qp__valid">Stato: {STEP[o.status] ?? o.status}</b>
			</p>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message}<p class="ok">{form.message}</p>{/if}
		</header>

		{#if data.payments.length}
			<div class="qp__cta" style={waiting ? '' : 'border-color:var(--line)'}>
				<h2 class="qp__h2">{data.payments.length === 1 ? 'Pagamento' : 'Scadenze di pagamento'}</h2>
				<div class="qp__pay">
					{#each data.payments as p (p.seq)}
						<div class="qp__pay-row" class:is-paid={p.status === 'pagato'} class:is-due={p.upfront && p.status === 'da_pagare'}>
							<div><b>{money(p.amount)}</b><span>{paymentLabel(p.method)} · {p.upfront ? 'anticipato' : `scadenza ${it(p.due)}`}</span></div>
							{#if p.status === 'pagato'}
								<span class="qp__paid">✓ Pagato {p.paid_at ? it(p.paid_at) : ''}</span>
							{:else if p.upfront}
								{#if data.online}
									<a class="btn btn--green" href="/conferma/{token()}/paga/{p.seq}">Paga ora {money(p.amount)}</a>
								{:else}
									<div class="qp__bank">
										<b>Bonifico anticipato</b>
										<span>{#if data.bank.iban}IBAN <b>{data.bank.iban}</b> · {/if}intestato a {data.bank.name} · causale <b>{o.number}</b></span>
										<small>Appena vediamo l'accredito segniamo la scadenza come pagata e partiamo. Se vuoi fare prima, mandaci la contabile dal bottone "Ho una domanda".</small>
									</div>
								{/if}
							{:else}
								<span class="qp__later">Alla scadenza, con {paymentLabel(p.method)}. La fattura arriva a parte.</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<h2 class="qp__h2">Cosa hai ordinato</h2>
		<div class="qp__items">
			{#each data.items as i (i.id)}
				<article class="qp__item">
					<div class="qp__img" class:is-mockup={i.isMockup}>{#if i.image}<img src={i.image} alt="" loading="lazy" />{/if}</div>
					<div class="qp__item-body">
						<span class="qp__cat">{i.category}</span>
						<h3>{i.description || i.name}</h3>
						<div class="qp__meta">{i.qty.toLocaleString('it-IT')} pezzi</div>
						<div class="qp__price"><span>{money(i.unit)} <small>cad.</small></span><b>{money(i.total)}</b></div>
					</div>
				</article>
			{/each}
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">Riepilogo</h2>
				<div class="qp__row"><span>Imponibile</span><b>{money(o.net)}</b></div>
				<div class="qp__row"><span>IVA 22%</span><b>{money(o.gross - o.net)}</b></div>
				<div class="qp__row qp__row--tot"><span>Totale</span><b>{money(o.gross)}</b></div>
				<ul class="qp__terms">
					<li>⏱ Produzione in 3–5 giorni lavorativi dall'approvazione dell'anteprima{#if o.delivery_date}, spedizione prevista {it(o.delivery_date)}{/if}.</li>
					<li>🚚 {o.shipping_method === 'Consegna diretta Stickerprint' ? 'Consegna diretta' : o.shipping_method?.includes('destinatario') ? 'Ritiro con il tuo corriere' : 'Spedizione con corriere espresso, tracking via email'}.</li>
					<li>🔍 Prima di stampare ricevi l'anteprima: si va in macchina solo con il tuo ok.</li>
				</ul>
			</div>
			<aside class="qp__why">
				<div class="qp__addr"><b>Fatturazione</b>{#each data.billing as l, k (k)}<span>{l}</span>{/each}{#if data.vat}<span>P.IVA {data.vat}</span>{/if}</div>
				<div class="qp__addr"><b>Spedizione</b>{#each data.shipping as l, k (k)}<span>{l}</span>{/each}</div>
				<div class="qp__person"><span class="qp__avatar">{initials}</span><div><b>{data.sender ?? 'Il team Stickerprint'}</b><br /><span>ti seguo io: qualcosa non torna? Dimmelo qui sotto prima che vada in stampa.</span></div></div>
				{#if data.stats}<div class="qp__stars"><Stars value={data.stats.average ?? 4.9} count={data.stats.total ?? null} size={18} countLabel="recensioni verificate" /></div>{/if}
			</aside>
		</div>

		<div class="qp__cta" style="border-color:var(--line)">
			<div class="qp__more">
				<a class="btn btn--ghost" href="/conferma/{token()}/pdf">📄 Scarica il PDF</a>
				<button class="btn btn--ghost" type="button" onclick={() => { asking = !asking; reporting = false; }}>💬 Ho una domanda</button>
				<button class="btn btn--ghost" type="button" onclick={() => { reporting = !reporting; asking = false; }}>⚠ Segnala un errore</button>
			</div>
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder="Scrivi qui: tempi, fattura, spedizione…"></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>Invia la domanda</button>
				</form>
			{/if}
			{#if reporting}
				<form method="POST" action="?/errore" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder="Cosa non torna? Indirizzo, quantità, misura, materiale… Fermiamo la produzione finché non è sistemato."></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>Segnala</button>
				</form>
			{/if}
		</div>

		{#if data.messages.length}
			<div class="qp__thread">
				<h2 class="qp__h2">Conversazione</h2>
				{#each data.messages as m (m.id)}
					<div class="qp__msg qp__msg--{m.direction}"><div class="qp__msg-head"><b>{m.direction === 'in' ? (m.kind === 'errore' ? 'Tu · segnalazione' : 'Tu') : (m.author ?? 'Stickerprint')}</b><span>{when(m.created_at)}</span></div><p>{m.body}</p></div>
				{/each}
			</div>
		{/if}
	</div>
</section>
