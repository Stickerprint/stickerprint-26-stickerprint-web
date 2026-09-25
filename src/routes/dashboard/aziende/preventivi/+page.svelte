<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { QUOTE_REMIND_DAYS, QUOTE_STATUS, type QuoteStatus } from '$lib/dashboard/richieste';
	import { money, dmy, monthKey, MONTHS } from '$lib/dashboard/orders';
	import MonthBar from '$lib/components/dashboard/MonthBar.svelte';
	import { fmtAgo } from '$lib/dashboard/produzione';
	let { data, form } = $props();
	/* cancellazione in due passaggi: si clicca il cestino e poi si conferma sulla riga */
	let daCancellare = $state<string | null>(null);
	const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
	const filter = $derived(page.url.searchParams.get('stato') ?? 'tutti');
	/* come negli ordini: si parte dal mese in corso; riquadri, elenco e totali parlano di quel mese */
	let month = $state<string | null>(data.year === new Date().getFullYear() ? String(new Date().getMonth()) : null);
	const meseLabel = $derived(month === null ? `tutto il ${data.year}` : month === 'prev' ? `prima del ${data.year}` : month === 'next' ? `dopo il ${data.year}` : `${MONTHS[+month]} ${data.year}`);
	const nelMese = $derived(data.quotes.filter((q) => month === null || monthKey(q.created_at, data.year) === month));
	const list = $derived(nelMese.filter((q) => (filter === 'tutti' ? true : q.status === filter)));
	/* paginazione (70 per pagina) e totali dell'elenco filtrato */
	const PER_PAGE = 70;
	let pg = $state(1);
	$effect(() => { void [filter, month]; pg = 1; });
	const pages = $derived(Math.max(1, Math.ceil(list.length / PER_PAGE)));
	const pageList = $derived(list.slice((pg - 1) * PER_PAGE, pg * PER_PAGE));
	const sums = $derived.by(() => { const net = list.reduce((a, q) => a + Number(q.total_net), 0), gross = list.reduce((a, q) => a + Number(q.total_gross), 0); return { net, vat: gross - net, gross, pageNet: pageList.reduce((a, q) => a + Number(q.total_net), 0), pageGross: pageList.reduce((a, q) => a + Number(q.total_gross), 0) }; });
	const toRemind = (q: { status: string; sent_at: string | null; reminded_at: string | null; auto_remind?: boolean }) => q.status === 'inviato' && !q.reminded_at && !!q.sent_at && Date.now() - new Date(q.sent_at).getTime() > QUOTE_REMIND_DAYS * 864e5;
	const totals = $derived({ inviati: nelMese.filter((q) => q.status === 'inviato').reduce((a, q) => a + Number(q.total_gross), 0), vinti: nelMese.filter((q) => q.status === 'accettato' || q.status === 'ordinato').reduce((a, q) => a + Number(q.total_gross), 0) });
</script>

<svelte:head><title>Preventivi | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Preventivi {data.year}</h1><p class="lead">{list.length} {list.length === 1 ? 'preventivo' : 'preventivi'}{#if pages > 1} · pagina {pg} di {pages}{/if}. Numerazione SPP00001, riparte ogni 1° gennaio. L'email la scrivi tu prima di inviarla; il cliente apre la pagina, scarica il PDF da lì e conferma con un clic. Dopo {QUOTE_REMIND_DAYS} giorni senza risposta parte il sollecito da solo (se attivo).</p></div>
	<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<a class="btn btn--xs" href="/dashboard/aziende/preventivi/nuovo">＋ Nuovo preventivo</a>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<MonthBar bind:month year={data.year} items={data.quotes} dateOf={(q: { created_at: string }) => q.created_at} amountOf={(q: { total_gross: number }) => Number(q.total_gross)} unit="prev." />
<p class="stats5-rif">Stai guardando <b>{meseLabel}</b>: riquadri, elenco e totali qui sotto sono solo di {meseLabel}.</p>
<div class="pr-kpis" style="grid-template-columns:repeat(4,1fr)">
	<div class="pr-kpi"><b>{nelMese.length}</b><span>preventivi in {meseLabel}</span></div>
	<div class="pr-kpi"><b>{nelMese.filter((q) => q.status === 'inviato').length}</b><span>in attesa · {money(totals.inviati)}</span></div>
	<div class="pr-kpi"><b>{nelMese.filter((q) => q.status === 'accettato' || q.status === 'ordinato').length}</b><span>accettati · {money(totals.vinti)}</span></div>
	<div class="pr-kpi" class:is-warn={nelMese.some(toRemind)}><b>{nelMese.filter(toRemind).length}</b><span>da sollecitare</span></div>
</div>

<div class="tabs">
	<a class="tab-link" class:is-active={filter === 'tutti'} href="?anno={data.year}&stato=tutti">Tutti</a>
	{#each Object.entries(QUOTE_STATUS) as [k, v] (k)}<a class="tab-link" class:is-active={filter === k} href="?anno={data.year}&stato={k}">{v.label} ({nelMese.filter((q) => q.status === k).length})</a>{/each}
</div>

{#if list.length === 0}
	<div class="dcard" style="text-align:center;color:var(--muted)">Nessun preventivo.</div>
{:else}
	<div class="dcard" style="padding:0;overflow:auto">
		<table class="dtable">
			<thead><tr><th>Numero</th><th>Cliente</th><th>Totale</th><th>Stato</th><th>Validità</th><th>Inviato</th><th></th></tr></thead>
			<tbody>
				{#each pageList as q (q.id)}
					{@const st = QUOTE_STATUS[q.status as QuoteStatus]}
					<tr>
						<td>{#if q.unread}<span class="rq-dot" style="display:inline-block;background:var(--blue);box-shadow:0 0 0 3px #dbeafe;margin:0 8px 0 0;vertical-align:middle" title="Il cliente ha scritto"></span>{/if}<a class="pr-num" href="/dashboard/aziende/preventivi/{q.id}">{q.number}</a>{#if q.version > 1} <small class="osub">rev. {q.version}</small>{/if}</td>
						<td>{q.draft.customer.name}<div class="osub">{q.draft.customer.email}</div></td>
						<td><b>{money(Number(q.total_gross))}</b><div class="osub">{q.draft.items.length} {q.draft.items.length === 1 ? 'riga' : 'righe'}</div></td>
						<td><span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>{#if q.order_group}<div><a class="link" style="font-size:12px" href="/dashboard/fatturazione/ordini/{q.order_group}">ordine ›</a></div>{/if}</td>
						<td>{dmy(q.valid_until)}</td>
						<td>{#if q.sent_at}{fmtAgo(q.sent_at)}<div class="osub">{q.opened_count ? `👁 aperto ${q.opened_count}×, ${fmtAgo(q.opened_at ?? null)}` : 'mai aperto'}{#if q.pdf_downloaded_at} · 📄 PDF{/if}</div>{#if q.reminded_at}<div class="osub">sollecitato {fmtAgo(q.reminded_at)}</div>{/if}{:else}—{/if}</td>
						<td style="white-space:nowrap">
							<a class="ibtn" href="/dashboard/aziende/preventivi/nuovo?da={q.id}" title="Duplica">⧉</a>
							{#if toRemind(q)}<form method="POST" action="?/sollecita" use:enhance style="display:inline"><input type="hidden" name="id" value={q.id} /><button class="btn btn--ghost btn--xs" type="submit">✉ Sollecita</button></form>{/if}
							{#if q.status !== 'ordinato' && !q.order_group}
								{#if daCancellare === q.id}
									<!-- due passaggi invece della finestrella del browser: si vede cosa si sta per cancellare -->
									<form method="POST" action="?/elimina" use:enhance={() => async ({ update }) => { daCancellare = null; await update(); }} style="display:inline">
										<input type="hidden" name="id" value={q.id} />
										<button class="btn btn--xs" style="background:#dc2626;color:#fff" type="submit">Sì, cancella {q.number}</button>
									</form>
									<button class="btn btn--ghost btn--xs" type="button" onclick={() => (daCancellare = null)}>annulla</button>
								{:else}
									<button class="ibtn" type="button" title="Cancella il preventivo" onclick={() => (daCancellare = q.id)}>🗑</button>
								{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot class="otot">
				<tr>
					<td colspan="2"><b>Totale {list.length} {list.length === 1 ? 'preventivo' : 'preventivi'}</b> con il filtro attivo{#if pages > 1}<div class="osub">In questa pagina: {money(sums.pageNet)} imponibile · {money(sums.pageGross)} IVA inclusa</div>{/if}</td>
					<td colspan="5"><div class="otot__row"><span>Imponibile</span><b>{money(sums.net)}</b></div><div class="otot__row"><span>IVA</span><b>{money(sums.vat)}</b></div><div class="otot__row otot__row--tot"><span>Totale IVA inclusa</span><b>{money(sums.gross)}</b></div></td>
				</tr>
			</tfoot>
		</table>
	</div>
	{#if pages > 1}
		<div class="pager">
			<button type="button" class="btn btn--ghost btn--xs" disabled={pg === 1} onclick={() => (pg = Math.max(1, pg - 1))}>‹ Precedente</button>
			{#each Array.from({ length: pages }, (_, i) => i + 1) as n (n)}<button type="button" class="pager__n" class:is-active={n === pg} onclick={() => (pg = n)}>{n}</button>{/each}
			<button type="button" class="btn btn--ghost btn--xs" disabled={pg === pages} onclick={() => (pg = Math.min(pages, pg + 1))}>Successiva ›</button>
			<span class="osub">{PER_PAGE} per pagina</span>
		</div>
	{/if}
{/if}
