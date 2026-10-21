<script lang="ts">
	import { formatAmount } from '$lib/i18n';
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import { paymentLabel } from '$lib/dashboard/payments';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo, numero, data: dataL, locale } = usaLingua();
	/* documenti reali in euro (ordini manuali, preventivi, fatture): formato della lingua, valuta sempre EUR, niente cambio in dollari */
	const money = (v: number) => formatAmount(v, { ...locale, currency: 'EUR' });
	let { data, form } = $props();
	const inv = $derived(data.inv);
	const it = (d: string | null) => (d ? dataL(d.slice(0, 10) + 'T12:00:00') : '');
	const open = $derived(data.payments.filter((p) => p.status !== 'pagato'));
	const due = $derived(open.filter((p) => p.payable).reduce((a, p) => a + p.amount, 0));
	const allPaid = $derived(data.payments.length > 0 && open.length === 0);
	const onlyRiba = $derived(open.length > 0 && open.every((p) => !p.payable));
	const initials = $derived((inv.sender ?? 'SP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
	const when = (d: string) => new Date(d).toLocaleString(locale.intl, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let asking = $state(false);
	let bankOpen = $state<number | null>(null);
	let sending = $state(false);
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; }; };
	const token = () => (typeof location !== 'undefined' ? location.pathname.split('/')[2] : '');
</script>

<svelte:head><title>{t('account.fattura.titolo', { n: inv.number })}</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">{t('account.fattura.kicker', { n: inv.number, data: it(inv.issued_at) })}{#if inv.orders.length}{t('account.fattura.ordine', { n: inv.orders.join(', ') })}{/if}</p>
			<h1>{t('account.fattura.h1', { nome: inv.first_name })} <span class="hl">{t('account.fattura.h1Evidenza')}</span> 🧾</h1>
			<p class="qp__lead">
				{#if allPaid}{t('account.fattura.leadSaldata')}
				{:else if onlyRiba}{open.length === 1 ? t('account.fattura.leadRibaUno', { data: it(open[0].due) }) : t('account.fattura.leadRibaTanti')}
				{:else}{t('account.fattura.leadPaga')}{/if}
			</p>
			{#if data.paid}<p class="ok">{t('account.doc.pagamentoRicevuto')} {due > 0 ? t('account.fattura.restaScadenza') : t('account.fattura.saldata')}</p>{/if}
			{#if data.cancelled}<p class="error">{t('account.doc.pagamentoAnnullato')}</p>{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message}<p class="ok">{form.message}</p>{/if}
		</header>

		<div class="qp__cta qp__cta--pay">
			<h2 class="qp__h2">{data.payments.length === 1 ? t('account.doc.pagamento') : t('account.doc.scadenze')}</h2>
			<div class="qp__pay">
				{#each data.payments as p (p.seq)}
					<div class="qp__pay-row" class:is-paid={p.status === 'pagato'} class:is-due={p.payable && p.status === 'da_pagare'}>
						<div class="qp__pay-head">
							<div><b>{money(p.amount)}</b><span>{paymentLabel(p.method)} · {t('account.doc.scadenzaIl', { data: it(p.due) })}</span></div>
							{#if p.status === 'pagato'}<span class="qp__paid">{t('account.doc.pagato', { data: p.paid_at ? it(p.paid_at) : '' })}</span>{/if}
						</div>
						{#if p.status !== 'pagato' && p.payable}
							<div class="qp__paybtns">
								{#if data.online}<a class="btn btn--green" href={path(`/fattura/${token()}/paga/${p.seq}`)} data-sveltekit-reload>{t('account.doc.pagaCarta')}</a>{/if}
								{#if data.paypal}<a class="btn btn--paypal" href={path(`/fattura/${token()}/paypal/${p.seq}`)} data-sveltekit-reload><img src="/icons/footer/paypal.webp" alt="" /> {t('account.doc.pagaPaypal')}</a>{/if}
								<button class="btn btn--white" class:is-on={bankOpen === p.seq} type="button" onclick={() => (bankOpen = bankOpen === p.seq ? null : p.seq)}>{t('account.doc.pagaBonifico')}</button>
							</div>
							{#if data.online}<small class="qp__paynote">{t('account.doc.metodiNota')}{#if data.paypal}{t('account.doc.metodiPaypal')}{/if}{t('account.doc.metodiBonifico')}</small>{/if}
							{#if bankOpen === p.seq}
								<div class="qp__bank">
									<b>{t('account.doc.bonifico', { importo: money(p.amount) })}</b>
									<span>{t('account.doc.intestato')} <b>{data.bank.name}</b>{#if data.bank.iban} · {t('account.doc.iban')} <b>{data.bank.iban}</b>{/if} · {t('account.doc.causale')} <b>{inv.number}</b></span>
									<small>{t('account.doc.bonificoNota')}{t('account.doc.bonificoContabile')}</small>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<h2 class="qp__h2">{t('account.fattura.dettaglio')}</h2>
		<div class="qp__table">
			<table>
				<thead><tr><th>{t('account.fattura.descrizione')}</th><th style="text-align:right">{t('account.fattura.quantita')}</th><th style="text-align:right">{t('account.fattura.prezzoUnitario')}</th><th style="text-align:right">{t('account.doc.imponibile')}</th></tr></thead>
				<tbody>{#each data.lines as l, k (k)}<tr><td>{l.description}</td><td style="text-align:right">{numero(Number(l.qty))}</td><td style="text-align:right">{money(Number(l.unit_net))}</td><td style="text-align:right"><b>{money(Number(l.total_net))}</b></td></tr>{/each}</tbody>
			</table>
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">{t('account.fattura.totali')}</h2>
				<div class="qp__row"><span>{t('account.doc.imponibile')}</span><b>{money(inv.net)}</b></div>
				<div class="qp__row"><span>{t('account.doc.iva')}</span><b>{money(inv.vat)}</b></div>
				<div class="qp__row qp__row--tot"><span>{t('account.doc.totale')}</span><b>{money(inv.gross)}</b></div>
				{#if inv.notes}<p class="qp__terms" style="margin-top:12px">{inv.notes}</p>{/if}
			</div>
			<aside class="qp__why">
				<div class="qp__addr"><b>{t('account.fattura.intestataA')}</b>{#each data.addr as l, k (k)}<span>{l}</span>{/each}</div>
				<div class="qp__person"><span class="qp__avatar">{initials}</span><div><b>{inv.sender ?? t('account.fattura.amministrazione')}</b><br /><span>{t('account.fattura.daSistemare')}</span></div></div>
			</aside>
		</div>

		<div class="qp__cta" style="border-color:var(--line)">
			<div class="qp__more">
				<a class="btn btn--ghost" href={path(`/fattura/${token()}/pdf`)}>{t('account.doc.scaricaPdf')}</a>
				<button class="btn btn--ghost" type="button" onclick={() => (asking = !asking)}>{t('account.doc.hoUnaDomanda')}</button>
			</div>
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder={t('account.fattura.domandaPlaceholder')}></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>{t('account.fattura.invia')}</button>
				</form>
			{/if}
		</div>

		{#if data.messages.length}
			<div class="qp__thread">
				<h2 class="qp__h2">{t('account.doc.conversazione')}</h2>
				{#each data.messages as m (m.id)}
					<div class="qp__msg qp__msg--{m.direction}"><div class="qp__msg-head"><b>{m.direction === 'in' ? t('account.doc.tu') : (m.author ?? t('account.doc.stickerprint'))}</b><span>{when(m.created_at)}</span></div><p>{m.body}</p></div>
				{/each}
			</div>
		{/if}
	</div>
</section>
