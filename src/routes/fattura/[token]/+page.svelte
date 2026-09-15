<script lang="ts">
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import { money } from '$lib/dashboard/orders';
	import { paymentLabel } from '$lib/dashboard/payments';
	let { data, form } = $props();
	const inv = $derived(data.inv);
	const it = (d: string | null) => (d ? new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
	const open = $derived(data.payments.filter((p) => p.status !== 'pagato'));
	const due = $derived(open.filter((p) => p.payable).reduce((a, p) => a + p.amount, 0));
	const allPaid = $derived(data.payments.length > 0 && open.length === 0);
	const onlyRiba = $derived(open.length > 0 && open.every((p) => !p.payable));
	const initials = $derived((inv.sender ?? 'SP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
	const when = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let asking = $state(false);
	let bankOpen = $state<number | null>(null);
	let sending = $state(false);
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; }; };
	const token = () => (typeof location !== 'undefined' ? location.pathname.split('/')[2] : '');
</script>

<svelte:head><title>Fattura {inv.number} | Stickerprint</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">Fattura {inv.number} · {it(inv.issued_at)}{#if inv.orders.length} · ordine {inv.orders.join(', ')}{/if}</p>
			<h1>Ciao {inv.first_name}, ecco la tua <span class="hl">fattura</span> 🧾</h1>
			<p class="qp__lead">
				{#if allPaid}Risulta già saldata: qui trovi il dettaglio e il PDF per i tuoi archivi.
				{:else if onlyRiba}Nessuna azione da fare: {open.length === 1 ? `l'importo verrà addebitato con ricevuta bancaria alla scadenza del ${it(open[0].due)}` : 'gli importi verranno addebitati con ricevuta bancaria alle scadenze indicate'}. Sotto il dettaglio.
				{:else}Puoi saldare subito con carta dal bottone, oppure con bonifico usando i dati indicati. Sotto il dettaglio della fattura e il PDF.{/if}
			</p>
			{#if data.paid}<p class="ok">✅ Pagamento ricevuto, grazie! {due > 0 ? 'Resta una scadenza da saldare.' : 'La fattura è saldata.'}</p>{/if}
			{#if data.cancelled}<p class="error">Pagamento annullato: puoi riprovare quando vuoi.</p>{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message}<p class="ok">{form.message}</p>{/if}
		</header>

		<div class="qp__cta qp__cta--pay">
			<h2 class="qp__h2">{data.payments.length === 1 ? 'Pagamento' : 'Scadenze di pagamento'}</h2>
			<div class="qp__pay">
				{#each data.payments as p (p.seq)}
					<div class="qp__pay-row" class:is-paid={p.status === 'pagato'} class:is-due={p.payable && p.status === 'da_pagare'}>
						<div class="qp__pay-head">
							<div><b>{money(p.amount)}</b><span>{paymentLabel(p.method)} · scadenza {it(p.due)}</span></div>
							{#if p.status === 'pagato'}<span class="qp__paid">✓ Pagato {p.paid_at ? it(p.paid_at) : ''}</span>{/if}
						</div>
						{#if p.status !== 'pagato' && p.payable}
							<div class="qp__paybtns">
								{#if data.online}<a class="btn btn--green" href="/fattura/{token()}/paga/{p.seq}" data-sveltekit-reload>💳 Paga con carta</a>{/if}
								{#if data.paypal}<a class="btn btn--paypal" href="/fattura/{token()}/paypal/{p.seq}" data-sveltekit-reload><img src="/icons/footer/paypal.webp" alt="" /> Paga con PayPal</a>{/if}
								<button class="btn btn--white" class:is-on={bankOpen === p.seq} type="button" onclick={() => (bankOpen = bankOpen === p.seq ? null : p.seq)}>🏦 Paga con bonifico</button>
							</div>
							{#if data.online}<small class="qp__paynote">carta, Apple Pay, Google Pay{#if data.paypal}, PayPal{/if} o bonifico</small>{/if}
							{#if bankOpen === p.seq}
								<div class="qp__bank">
									<b>Bonifico bancario · {money(p.amount)}</b>
									<span>Intestato a <b>{data.bank.name}</b>{#if data.bank.iban} · IBAN <b>{data.bank.iban}</b>{/if} · causale <b>{inv.number}</b></span>
									<small>Un bonifico può richiedere dalle 24 alle 48 ore per essere processato: appena vediamo l'accredito segniamo la scadenza come pagata. Se vuoi fare prima, mandaci la contabile dal bottone "Ho una domanda".</small>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<h2 class="qp__h2">Dettaglio</h2>
		<div class="qp__table">
			<table>
				<thead><tr><th>Descrizione</th><th style="text-align:right">Quantità</th><th style="text-align:right">Prezzo unitario</th><th style="text-align:right">Imponibile</th></tr></thead>
				<tbody>{#each data.lines as l, k (k)}<tr><td>{l.description}</td><td style="text-align:right">{Number(l.qty).toLocaleString('it-IT')}</td><td style="text-align:right">{money(Number(l.unit_net))}</td><td style="text-align:right"><b>{money(Number(l.total_net))}</b></td></tr>{/each}</tbody>
			</table>
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">Totali</h2>
				<div class="qp__row"><span>Imponibile</span><b>{money(inv.net)}</b></div>
				<div class="qp__row"><span>IVA 22%</span><b>{money(inv.vat)}</b></div>
				<div class="qp__row qp__row--tot"><span>Totale</span><b>{money(inv.gross)}</b></div>
				{#if inv.notes}<p class="qp__terms" style="margin-top:12px">{inv.notes}</p>{/if}
			</div>
			<aside class="qp__why">
				<div class="qp__addr"><b>Intestata a</b>{#each data.addr as l, k (k)}<span>{l}</span>{/each}</div>
				<div class="qp__person"><span class="qp__avatar">{initials}</span><div><b>{inv.sender ?? 'Amministrazione Stickerprint'}</b><br /><span>intestazione, importi o scadenze da sistemare? Scrivimi qui sotto.</span></div></div>
			</aside>
		</div>

		<div class="qp__cta" style="border-color:var(--line)">
			<div class="qp__more">
				<a class="btn btn--ghost" href="/fattura/{token()}/pdf">📄 Scarica il PDF</a>
				<button class="btn btn--ghost" type="button" onclick={() => (asking = !asking)}>💬 Ho una domanda</button>
			</div>
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder="Scrivi qui: intestazione, importi, scadenze, copia della contabile…"></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>Invia</button>
				</form>
			{/if}
		</div>

		{#if data.messages.length}
			<div class="qp__thread">
				<h2 class="qp__h2">Conversazione</h2>
				{#each data.messages as m (m.id)}
					<div class="qp__msg qp__msg--{m.direction}"><div class="qp__msg-head"><b>{m.direction === 'in' ? 'Tu' : (m.author ?? 'Stickerprint')}</b><span>{when(m.created_at)}</span></div><p>{m.body}</p></div>
				{/each}
			</div>
		{/if}
	</div>
</section>
