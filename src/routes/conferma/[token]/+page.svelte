<script lang="ts">
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import Stars from '$lib/components/Stars.svelte';
	import { paymentLabelFor } from '$lib/dashboard/payments';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';
	const { t, path, numero, data: dataL, locale, lang } = usaLingua();
	/* documenti reali in euro (ordini manuali, preventivi, fatture): formato della lingua, valuta sempre EUR, niente cambio in dollari */
	const money = (v: number) => formatAmount(v, { ...locale, currency: 'EUR' });
	let { data, form } = $props();
	const o = $derived(data.order);
	const first = $derived(o.first_name?.trim() || o.customer);
	const it = (d: string | null) => (d ? dataL(d.slice(0, 10) + 'T12:00:00') : '');
	const due = $derived(data.payments.filter((p) => p.upfront && p.status === 'da_pagare').reduce((a, p) => a + p.amount, 0));
	const waiting = $derived(o.status === 'attesa_pagamento' || due > 0);
	const when = (d: string) => new Date(d).toLocaleString(locale.intl, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	let asking = $state(false);
	let bankOpen = $state<number | null>(null);
	let reporting = $state(false);
	let sending = $state(false);
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; reporting = false; }; };
	const token = () => (typeof location !== 'undefined' ? location.pathname.split('/')[2] : '');
	const STATI = ['attesa_pagamento', 'attesa_integrazione', 'modifiche_richieste', 'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato', 'in_attesa', 'attesa_file', 'attesa_prova', 'approvazione'];
	const stato = $derived(STATI.includes(o.status) ? t(`account.conferma.stati.${o.status}`) : o.status);
	const soglia = formatAmount(locale.freeShipping, locale, 0);
</script>

<svelte:head><title>{t('account.conferma.titolo', { n: o.number })}</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">{t('account.conferma.kicker', { n: o.number, data: it(o.created_at) })}</p>
			<h1>{t('account.conferma.h1', { nome: first })} <span class="hl">{t('account.conferma.h1Evidenza')}</span> 📦</h1>
			<p class="qp__lead">
				{#if waiting}{@html t('account.conferma.leadAttesa', { importo: money(due) })}
				{:else}{t('account.conferma.leadOk')}{/if}
				<b class="qp__valid">{t('account.conferma.stato', { stato })}</b>
			</p>
			{#if data.paid}<p class="ok">{t('account.doc.pagamentoRicevuto')} {due > 0 ? t('account.conferma.restaAnticipo') : t('account.conferma.entraLavorazione')}</p>{/if}
			{#if data.cancelled}<p class="error">{t('account.conferma.annullatoRiprova')}</p>{/if}
			{#if data.ppError}<p class="error">PayPal: {data.ppError}</p>{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message}<p class="ok">{form.message}</p>{/if}
		</header>

		{#if data.payments.length}
			<div class="qp__cta qp__cta--pay">
				<h2 class="qp__h2">{data.payments.length === 1 ? t('account.doc.pagamento') : t('account.doc.scadenze')}</h2>
				<div class="qp__pay">
					{#each data.payments as p (p.seq)}
						{@const riba = /ricevuta|riba|rid\b|sdd/i.test(p.method)}
						{@const payable = p.status !== 'pagato' && !riba}
						<div class="qp__pay-row" class:is-paid={p.status === 'pagato'} class:is-due={p.upfront && p.status === 'da_pagare'}>
							<div class="qp__pay-head">
								{#if p.kind === 'integrazione'}
									<div><b>{money(p.amount)}</b><span>{t('account.conferma.integrazione')}{p.reason ? `: ${p.reason}` : ''}{#if p.status !== 'pagato'}{t('account.conferma.integrazioneRiparte')}{/if}</span></div>
								{:else}
									<div><b>{money(p.amount)}</b><span>{paymentLabelFor(p.method, lang)} · {p.upfront ? t('account.doc.anticipato') : t('account.doc.scadenzaIl', { data: it(p.due) })}{#if payable && !p.upfront} · {t('account.doc.saldaSubito')}{/if}</span></div>
								{/if}
								{#if p.status === 'pagato'}<span class="qp__paid">{t('account.doc.pagato', { data: p.paid_at ? it(p.paid_at) : '' })}</span>{/if}
							</div>
							{#if payable}
								<div class="qp__paybtns">
									{#if data.online}<a class="btn btn--green" href={path(`/conferma/${token()}/paga/${p.seq}`)} data-sveltekit-reload>{t('account.doc.pagaCarta')}</a>{/if}
									{#if data.paypal}<a class="btn btn--paypal" href={path(`/conferma/${token()}/paypal/${p.seq}`)} data-sveltekit-reload><img src="/icons/footer/paypal.webp" alt="" /> {t('account.doc.pagaPaypal')}</a>{/if}
									{#if p.kind !== 'integrazione'}<button class="btn btn--white" class:is-on={bankOpen === p.seq} type="button" onclick={() => (bankOpen = bankOpen === p.seq ? null : p.seq)}>{t('account.doc.pagaBonifico')}</button>{/if}
								</div>
								{#if data.online}<small class="qp__paynote">{t('account.doc.metodiNota')}{#if data.paypal}{t('account.doc.metodiPaypal')}{/if}{#if p.kind !== 'integrazione'}{t('account.doc.metodiBonifico')}{/if}</small>{/if}
								{#if bankOpen === p.seq}
									<div class="qp__bank">
										<b>{t('account.doc.bonifico', { importo: money(p.amount) })}</b>
										<span>{t('account.doc.intestato')} <b>{data.bank.name}</b>{#if data.bank.iban} · {t('account.doc.iban')} <b>{data.bank.iban}</b>{/if} · {t('account.doc.causale')} <b>{o.number}</b></span>
										<small>{t('account.doc.bonificoNota')}{#if p.upfront}{t('account.doc.bonificoProduzione')}{/if}{t('account.doc.bonificoContabile')}</small>
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<h2 class="qp__h2">{t('account.conferma.cosaOrdinato')}</h2>
		<div class="qp__items">
			{#each data.items as i (i.id)}
				<article class="qp__item">
					<div class="qp__img" class:is-mockup={i.isMockup}>{#if i.image}<img src={i.image} alt="" loading="lazy" />{/if}</div>
					<div class="qp__item-body">
						<span class="qp__cat">{i.category}</span>
						<h3>{i.description || i.name}</h3>
						<div class="qp__meta">{t('account.doc.pezzi', { n: numero(i.qty) })}</div>
						<div class="qp__price"><span>{money(i.unit)} <small>{t('account.doc.cad')}</small></span><b>{money(i.total)}</b></div>
					</div>
				</article>
			{/each}
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">{t('account.doc.riepilogo')}</h2>
				<div class="qp__row"><span>{t('account.doc.imponibile')}</span><b>{money(o.net)}</b></div>
				<div class="qp__row"><span>{t('account.doc.iva')}</span><b>{money(o.gross - o.net)}</b></div>
				<div class="qp__row qp__row--tot"><span>{t('account.doc.totale')}</span><b>{money(o.gross)}</b></div>
				<ul class="qp__terms">
					{#if o.lead_time}<li>⏱ {o.lead_time}{#if o.delivery_date} · {t('account.conferma.spedizionePrevista', { data: it(o.delivery_date) })}{/if}.</li>{:else if o.delivery_date}<li>⏱ {t('account.conferma.spedizionePrevistaSola', { data: it(o.delivery_date) })}.</li>{/if}
					<li>🚚 {o.shipping_method === 'Consegna diretta Stickerprint' ? t('account.doc.consegnaDiretta') : o.shipping_method?.includes('destinatario') ? t('account.doc.ritiroCorriere') : t('account.doc.corriereEspresso')}.</li>
				</ul>
			</div>
			<aside class="qp__why">
				<ul class="qp__perks">
					<li>{t('account.doc.stampatoInItalia')}</li>
					<li>{t('account.doc.materialiPremium')}</li>
					<li>{t('account.doc.spedizioneGratis', { soglia })}</li>
				</ul>
				<!-- la data pattuita all'ordine (quella scritta in conferma, o la data di spedizione fissata dalla produzione) -->
				{#if o.delivery_date || o.ship_by}<p class="qp__ship"><span class="qp__rocket" aria-hidden="true">🚀</span><span>{t('account.doc.spedizioneStimata')}<b>{it(o.delivery_date ?? o.ship_by)}</b></span></p>{/if}
				{#if data.stats}<div class="qp__stars"><Stars value={data.stats.average ?? 4.9} count={data.stats.total ?? null} size={18} /></div>{/if}
			</aside>
		</div>

		<div class="qp__addrs">
			<div class="qp__addr qp__addr--card"><b>{t('account.conferma.fatturazione')}</b>{#each data.billing as l, k (k)}<span>{l}</span>{/each}{#if data.vat}<span>{t('account.doc.piva', { n: data.vat })}</span>{/if}</div>
			<div class="qp__addr qp__addr--card"><b>{t('account.conferma.spedizione')}</b>{#each data.shipping as l, k (k)}<span>{l}</span>{/each}</div>
		</div>

		<div class="qp__cta" style="border-color:var(--line)">
			<div class="qp__more">
				<a class="btn btn--blue" href={path(`/conferma/${token()}/pdf`)}>{t('account.doc.scaricaPdf')}</a>
				<button class="btn btn--yellow" type="button" onclick={() => { asking = !asking; reporting = false; }}>{t('account.doc.hoUnaDomanda')}</button>
				<button class="btn btn--pink" type="button" onclick={() => { reporting = !reporting; asking = false; }}>{t('account.conferma.segnala')}</button>
			</div>
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder={t('account.conferma.domandaPlaceholder')}></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>{t('account.doc.inviaDomanda')}</button>
				</form>
			{/if}
			{#if reporting}
				<form method="POST" action="?/errore" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder={t('account.conferma.errorePlaceholder')}></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>{t('account.conferma.segnalaBtn')}</button>
				</form>
			{/if}
		</div>

		{#if data.messages.length}
			<div class="qp__thread">
				<h2 class="qp__h2">{t('account.doc.conversazione')}</h2>
				{#each data.messages as m (m.id)}
					<div class="qp__msg qp__msg--{m.direction}"><div class="qp__msg-head"><b>{m.direction === 'in' ? (m.kind === 'errore' ? t('account.conferma.tuSegnalazione') : t('account.doc.tu')) : (m.author ?? t('account.doc.stickerprint'))}</b><span>{when(m.created_at)}</span></div><p>{m.body}</p></div>
				{/each}
			</div>
		{/if}
	</div>
</section>
