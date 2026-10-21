<script lang="ts">
	import { formatAmount } from '$lib/i18n';
	import '$lib/styles/quote.css';
	import { enhance } from '$app/forms';
	import Stars from '$lib/components/Stars.svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, numero, data: dataL, locale } = usaLingua();
	/* documenti reali in euro (ordini manuali, preventivi, fatture): formato della lingua, valuta sempre EUR, niente cambio in dollari */
	const money = (v: number) => formatAmount(v, { ...locale, currency: 'EUR' });
	let { data, form } = $props();
	const q = $derived(data.q);
	const first = $derived(data.customer.first_name?.trim() || data.customer.name);
	const it = (d: string | null) => (d ? dataL(d + 'T12:00:00') : '');
	const daysLeft = $derived(q.valid_until ? Math.ceil((new Date(q.valid_until + 'T23:59:59').getTime() - Date.now()) / 864e5) : null);
	const done = $derived(q.status === 'accettato' || q.status === 'ordinato' || form?.accepted);
	const dead = $derived(!done && (q.status === 'rifiutato' || q.status === 'scaduto' || form?.rejected));
	const open = $derived(!done && !dead && q.status === 'inviato');
	let asking = $state(false);
	let rejecting = $state(false);
	let sending = $state(false);
	const initials = $derived((q.sender_name ?? 'SP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
	const when = (d: string) => new Date(d).toLocaleString(locale.intl, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	const ordine = $derived(form?.orderNumber ? ` <b>${String(form.orderNumber).replace(/[<>&]/g, '')}</b>` : '');
	const submit = () => { sending = true; return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); sending = false; asking = false; rejecting = false; }; };
</script>

<svelte:head><title>{t('account.preventivo.titolo', { n: q.number })}</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	{#if data.staffPreview}<p style="max-width:820px;margin:0 auto 12px;padding:10px 14px;border-radius:10px;background:#fef6db;color:#8a5a00;font-size:13px">{t('account.preventivo.anteprima')}</p>{/if}
	<div class="qp__wrap">
		<header class="qp__head">
			<p class="qp__kicker">{t('account.preventivo.kicker', { n: q.number })}{#if q.version > 1}{t('account.preventivo.rev', { v: q.version })}{/if} · {it(q.created_at.slice(0, 10))}</p>
			{#if done}
				<h1>{t('account.preventivo.grazie', { nome: first })} <span class="hl">{t('account.preventivo.grazieEvidenza')}</span> ✅</h1>
				{#if form?.due}
					<p class="qp__lead">{@html t('account.preventivo.leadDue', { ordine, importo: money(form.due) })}</p>
				{:else}
					<p class="qp__lead">{@html t('account.preventivo.leadFatto', { ordine })}</p>
				{/if}
			{:else if dead}
				<h1>{q.status === 'rifiutato' || form?.rejected ? t('account.preventivo.chiuso') : t('account.preventivo.scaduto')}</h1>
				<p class="qp__lead">{t('account.preventivo.leadChiuso')}</p>
			{:else}
				<h1>{t('account.preventivo.h1', { nome: first })} <span class="hl">{data.customer.name}</span></h1>
				<p class="qp__lead">{t('account.preventivo.lead')} {#if daysLeft !== null}<b class="qp__valid" class:is-soon={daysLeft <= 5}>{daysLeft > 0 ? (daysLeft === 1 ? t('account.preventivo.validoUno') : t('account.preventivo.validoTanti', { n: daysLeft })) : t('account.preventivo.scadeOggi')}</b> {t('account.preventivo.finoAl', { data: it(q.valid_until) })}{/if}</p>
			{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			{#if form?.message && !form?.accepted}<p class="ok">{form.message}</p>{/if}
		</header>

		<div class="qp__items">
			{#each data.items as i, k (k)}
				<article class="qp__item">
					<div class="qp__img" class:is-mockup={i.isMockup}>{#if i.image}<img src={i.image} alt="" loading="lazy" />{/if}</div>
					<div class="qp__item-body">
						<span class="qp__cat">{i.category}</span>
						<h3>{i.description}</h3>
						<div class="qp__meta">{t('account.doc.pezzi', { n: numero(i.qty) })}{#if i.lamination && i.lamination !== 'nessuna'} · {t('account.preventivo.lamina', { tipo: i.laminationLabel })}{/if}{#if i.code} · {t('account.preventivo.cod', { codice: i.code })}{/if}</div>
						<div class="qp__price"><span>{money(i.price)} <small>{t('account.doc.cad')}{data.lordi ? ` ${t('account.doc.ivaIncl')}` : ''}</small></span><b>{money(i.total)}</b></div>
					</div>
				</article>
			{/each}
		</div>

		<div class="qp__two">
			<div class="qp__sum">
				<h2 class="qp__h2">{t('account.doc.riepilogo')}</h2>
				<div class="qp__row"><span>{t('account.doc.imponibile')}</span><b>{money(q.total_net)}</b></div>
				<div class="qp__row"><span>{t('account.doc.iva')}</span><b>{money(q.total_gross - q.total_net)}</b></div>
				<div class="qp__row qp__row--tot"><span>{t('account.doc.totale')}</span><b>{money(q.total_gross)}</b></div>
				<ul class="qp__terms">
					{#if data.leadTime}<li>⏱ {data.leadTime}.</li>{/if}
					<li>🚚 {data.shipMethod === 'Consegna diretta Stickerprint' ? t('account.doc.consegnaDiretta') : data.shipMethod?.includes('destinatario') ? t('account.doc.ritiroCorriere') : t('account.doc.corriereEspresso')}.</li>
					{#if data.terms.length}<li>{t('account.preventivo.pagamentoTermini', { termini: data.terms.join(' + ') })}</li>{/if}
				</ul>
			</div>
			<aside class="qp__why">
				<div class="qp__person"><span class="qp__avatar">{initials}</span><div><b>{q.sender_name ?? t('account.preventivo.team')}</b><br /><span>{t('account.preventivo.tiSeguo')}</span></div></div>
				<ul class="qp__perks">
					<li>{t('account.doc.stampatoInItalia')}</li>
					<li>{t('account.doc.materialiPremium')}</li>
				</ul>
				{#if data.shipDate}<p class="qp__ship"><span class="qp__rocket" aria-hidden="true">🚀</span><span>{t('account.doc.spedizioneStimata')}<b>{it(data.shipDate)}</b></span></p>{/if}
				{#if data.stats}<div class="qp__stars"><Stars value={data.stats.average ?? 4.9} count={data.stats.total ?? null} size={18} /></div>{/if}
			</aside>
		</div>

		<div class="qp__cta" id="conferma">
			{#if open}
				<form method="POST" action="?/accetta" use:enhance={submit} class="qp__accept">
					<input name="nome" placeholder={t('account.preventivo.nomePlaceholder')} required />
					<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{t('account.preventivo.confermo')}</button>
				</form>
				<div class="qp__more">
					<a class="btn btn--blue" href={path(`/preventivo/${location_token()}/pdf`)}>{t('account.doc.scaricaPdf')}</a>
					<button class="btn btn--yellow" type="button" onclick={() => { asking = !asking; rejecting = false; }}>{t('account.doc.hoUnaDomanda')}</button>
					<button class="link-btn" type="button" onclick={() => { rejecting = !rejecting; asking = false; }}>{t('account.preventivo.nonFaPerMe')}</button>
				</div>
				<p class="note">{t('account.preventivo.nota')}</p>
			{:else if done}
				<div class="qp__more"><a class="btn btn--blue" href={path(`/preventivo/${location_token()}/pdf`)}>{t('account.doc.scaricaPdf')}</a><button class="btn btn--yellow" type="button" onclick={() => (asking = !asking)}>{t('account.preventivo.scrivici')}</button></div>
			{:else}
				<form method="POST" action="?/aggiorna" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="2" placeholder={t('account.preventivo.aggiornaPlaceholder')}></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>{t('account.preventivo.aggiorna')}</button>
				</form>
			{/if}
			{#if asking}
				<form method="POST" action="?/domanda" use:enhance={submit} class="qp__ask">
					<textarea name="testo" rows="3" required placeholder={t('account.preventivo.domandaPlaceholder')}></textarea>
					<button class="btn btn--blue" type="submit" disabled={sending}>{t('account.doc.inviaDomanda')}</button>
				</form>
			{/if}
			{#if rejecting && open}
				<form method="POST" action="?/rifiuta" use:enhance={submit} class="qp__ask">
					<textarea name="motivo" rows="2" placeholder={t('account.preventivo.rifiutaPlaceholder')}></textarea>
					<button class="btn btn--ghost" type="submit" disabled={sending}>{t('account.preventivo.rifiuta')}</button>
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

<script lang="ts" module>
	// token dalla URL (la pagina non lo espone nei dati per non mostrarlo altrove)
	function location_token() { return typeof location !== 'undefined' ? location.pathname.split('/')[2] : ''; }
</script>
