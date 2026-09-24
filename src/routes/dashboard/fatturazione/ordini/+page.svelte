<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, ACTIVE_STATUSES, LEGACY_STATUSES, PROD_STAGES, CATS, COUNTRIES, MONTHS, money, dmy, itemMeta, thumbOf, PRODUCTION_STATUSES, SHIPPING_STATUSES, DEVICE_ICON, CHANNEL_ICON, type OrderGroup } from '$lib/dashboard/orders';
	import { paymentIcon, paymentLabel } from '$lib/dashboard/payments';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	let search = $state('');
	let cat = $state('all');
	let channel = $state('all');
	let status = $state('all');
	let star = $state('entrambi');
	/* si parte dal mese in corso: elenco, totali e riquadri parlano sempre dello stesso mese.
	   Con "Tutti i mesi" si vede tutto l'anno, elenco compreso. */
	let month = $state<string | null>(new Date().getFullYear() === (data.year ?? new Date().getFullYear()) ? String(new Date().getMonth()) : null);
	/* "Inizia produzione": ordini appena creati (manuali, o in attesa di prova del vecchio flusso) che non hanno ancora una coda di lavorazioni.
	   Gli e-commerce pagati entrano da soli; quelli in attesa dell'anticipo si possono forzare (es. pagato a voce). */
	let starting = $state<string | null>(null);
	const canStart = (g: (typeof data.groups)[number]) => ['attesa_pagamento', 'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione'].includes(g.status) || (g.status === 'in_produzione' && !g.items[0].prod_stage);
	let expanded = $state<Set<string>>(new Set());
	const year = $derived(data.year);
	/* cambiando anno si riparte dal mese giusto: l'anno in corso sul mese in corso, gli anni passati
	   su tutto l'anno */
	let annoVisto = data.year;
	$effect(() => {
		const y = data.year;
		if (y === annoVisto) return;
		annoVisto = y;
		month = y === new Date().getFullYear() ? String(new Date().getMonth()) : null;
	});
	const buckets = $derived.by(() => {
		const b: Record<string, { n: number; amt: number }> = { prev: { n: 0, amt: 0 }, next: { n: 0, amt: 0 } };
		for (let m = 0; m < 12; m++) b[m] = { n: 0, amt: 0 };
		for (const g of data.groups) {
			const d = new Date(g.created_at); const y = d.getFullYear();
			const k = y < year ? 'prev' : y > year ? 'next' : String(d.getMonth());
			b[k].n++; b[k].amt += g.net;
		}
		return b;
	});
	const list = $derived(data.groups.filter((g: OrderGroup) => {
		const q = search.trim().toLowerCase();
		if (q && !(g.number.toLowerCase().includes(q) || g.numbers.some((n) => n.toLowerCase().includes(q)) || g.customer.toLowerCase().includes(q) || g.email.toLowerCase().includes(q))) return false;
		if (cat !== 'all' && !g.items.some((i) => i.product_slug === cat)) return false;
		if (channel !== 'all' && g.channel !== channel) return false;
		if (status === 'vecchi') { if (!LEGACY_STATUSES.includes(g.status)) return false; }
		else if (status !== 'all' && g.status !== status) return false;
		if (star === 'starred' && !g.starred) return false;
		if (star === 'unstarred' && g.starred) return false;
		if (month !== null) {
			const d = new Date(g.created_at); const y = d.getFullYear();
			const k = y < year ? 'prev' : y > year ? 'next' : String(d.getMonth());
			if (k !== month) return false;
		}
		return true;
	}));
	/* paginazione (70 per pagina) e totali dell'elenco filtrato: imponibile, IVA e totale, senza gli annullati */
	const PER_PAGE = 70;
	let page = $state(1);
	$effect(() => { void [search, cat, channel, status, star, month]; page = 1; });
	const pages = $derived(Math.max(1, Math.ceil(list.length / PER_PAGE)));
	const pageList = $derived(list.slice((page - 1) * PER_PAGE, page * PER_PAGE));
	const totals = $derived.by(() => {
		const valid = list.filter((g: OrderGroup) => g.status !== 'annullato');
		const net = valid.reduce((s: number, g: OrderGroup) => s + g.net, 0), gross = valid.reduce((s: number, g: OrderGroup) => s + g.gross, 0);
		const pv = pageList.filter((g: OrderGroup) => g.status !== 'annullato');
		return { n: valid.length, net, vat: gross - net, gross, pageNet: pv.reduce((s: number, g: OrderGroup) => s + g.net, 0), pageGross: pv.reduce((s: number, g: OrderGroup) => s + g.gross, 0), cancelled: list.length - valid.length };
	});
	/* mese di riferimento del fatturato: quello scelto nella barra dei mesi; con "Tutti i mesi" vale
	   il mese in corso (se si guarda l'anno corrente), altrimenti tutto l'anno scelto */
	const meseRif = $derived(month);
	const meseLabel = $derived(
		meseRif === null ? `tutto il ${year}` : meseRif === 'prev' ? `prima del ${year}` : meseRif === 'next' ? `dopo il ${year}` : `${MONTHS[+meseRif]} ${year}`
	);
	const nelMese = (g: OrderGroup) => {
		if (meseRif === null) return true;
		const d = new Date(g.created_at), y = d.getFullYear();
		return (y < year ? 'prev' : y > year ? 'next' : String(d.getMonth())) === meseRif;
	};
	/* TUTTI i riquadri parlano del mese di riferimento: scegliendo agosto si vedono i numeri di agosto */
	const stats = $derived.by(() => {
		const mese = data.groups.filter(nelMese);
		const validi = mese.filter((g: OrderGroup) => g.status !== 'annullato');
		return {
			total: mese.length,
			ecom: mese.filter((g: OrderGroup) => g.channel === 'ecommerce').length,
			manuali: mese.filter((g: OrderGroup) => g.channel !== 'ecommerce').length,
			produzione: mese.filter((g: OrderGroup) => PRODUCTION_STATUSES.includes(g.status)).length,
			spedizione: mese.filter((g: OrderGroup) => SHIPPING_STATUSES.includes(g.status)).length,
			consegnati: mese.filter((g: OrderGroup) => g.status === 'consegnato').length,
			net: validi.reduce((s: number, g: OrderGroup) => s + g.net, 0),
			netOrdini: validi.length
		};
	});
	function toggle(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
</script>

<svelte:head><title>Ordini | Dashboard Stickerprint</title></svelte:head>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.started}<p class="success">Ordine {form.started} in produzione: lo trovi in <a class="link" href="/dashboard/produzione/coda">Produzione › Coda ordini</a>.</p>{/if}

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Ordini {data.year}</h1><p class="lead">E-commerce e manuali, in un'unica vista · {list.length} risultati{#if pages > 1} · pagina {page} di {pages}{/if}</p></div>
	<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<a class="btn btn--green" href="/dashboard/fatturazione/ordini/nuovo">+ Nuovo ordine</a>
	</div>
</div>

<div class="month-bar">
	<div class="month-cells">
		{#each [['prev', 'Preced.'], ...MONTHS.map((m, i) => [String(i), m]), ['next', 'Succ.']] as [k, label] (k)}
			<button type="button" class="month-cell" class:has-data={buckets[k].n > 0} class:is-active={month === k} class:is-current={year === new Date().getFullYear() && k === String(new Date().getMonth())} onclick={() => (month = month === k ? null : k)}>
				<span class="mc-label">{label}</span><span class="mc-doc">{buckets[k].n} ord.</span><span class="mc-amt">{money(buckets[k].amt)}</span>
			</button>
		{/each}
	</div>
	<button type="button" class="btn btn--xs {month === null ? 'btn--blue' : 'btn--ghost'}" onclick={() => (month = null)}>Tutti i mesi</button>
</div>

<p class="stats5-rif">Stai guardando <b>{meseLabel}</b>: riquadri, elenco e totali qui sotto sono solo di {meseLabel}.</p>
<div class="stats5">
	<div class="dcard stat5"><span class="ico" style="background:#fde7f1;color:#e0117f">📦</span><div><small>Ordini · {meseLabel}</small><b>{stats.total}</b><i>{stats.ecom} e-commerce · {stats.manuali} manuali</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#e5f0ff;color:#3b82f6">🖨️</span><div><small>In produzione</small><b>{stats.produzione}</b><i>di {meseLabel}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcf9f4;color:#0d9488">🚚</span><div><small>In spedizione</small><b>{stats.spedizione}</b><i>di {meseLabel}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcfce7;color:#15803d">✅</span><div><small>Consegnati</small><b>{stats.consegnati}</b><i>di {meseLabel}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#fef6db;color:#c48a00">💶</span><div><small>Fatturato netto</small><b>{money(stats.net)}</b><i>{stats.netOrdini} ordini di {meseLabel}</i></div></div>
</div>

<div class="dcard filters">
	<input type="text" placeholder="Cerca ordine, cliente o email…" bind:value={search} />
	<select bind:value={cat}><option value="all">Tutte le categorie</option>{#each Object.entries(CATS) as [slug, c] (slug)}<option value={slug}>{c.name}</option>{/each}</select>
	<select bind:value={channel}><option value="all">Tutti i canali</option><option value="ecommerce">🛒 E-commerce</option><option value="manuale">✍️ Manuale</option></select>
	<select bind:value={status}><option value="all">Tutti gli stati</option>{#each ACTIVE_STATUSES as k (k)}<option value={k}>{ORDER_STATUS[k].label}</option>{/each}<option value="vecchi">Vecchio flusso (prove)</option></select>
	<select bind:value={star}><option value="entrambi">⭐ Tutti</option><option value="starred">Segnati</option><option value="unstarred">Non segnati</option></select>
</div>

<div class="dcard" style="overflow-x:auto;padding:0">
	<table class="dtable otable">
		<thead><tr><th></th><th>Ordine</th><th>Cliente</th><th>Articolo</th><th>Categoria</th><th>Q.tà</th><th>Stato</th><th style="text-align:right">Importo</th><th></th></tr></thead>
		<tbody>
			{#each pageList as g (g.key)}
				{@const first = g.items[0]}
				<tr class="orow-main">
					<td>{COUNTRIES[g.country]?.flag ?? '🌍'}</td>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}{#if g.items.length > 1} <small>+{g.items.length - 1}</small>{/if}</a><div class="osub">{dmy(g.created_at)} <span title={CHANNEL_ICON[g.channel]?.label}>{CHANNEL_ICON[g.channel]?.icon ?? ''}</span>{#if g.device}<span title="Ordinato da {g.device}">{DEVICE_ICON[g.device] ?? ''}</span>{/if}{#if g.express} <span title="Produzione express">⚡</span>{/if}</div></td>
					<td><b>{g.customer}</b><div class="osub">{g.email}</div></td>
					<td>
						<div class="item-cell">
							{#if first.proof_url || first.preview_url || first.mockup_url}<img src={first.proof_url ?? first.preview_url ?? first.mockup_url} alt="" />{:else}<span class="thumb-ph" style="background:{CATS[first.product_slug]?.soft ?? '#eee'}"></span>{/if}
							<div><b>{first.product_name}</b><div class="osub">{itemMeta(first)}</div></div>
						</div>
						{#if g.items.length > 1}<button type="button" class="link-btn" style="font-size:12px" onclick={() => toggle(g.key)}>{expanded.has(g.key) ? 'Nascondi' : `Mostra altri ${g.items.length - 1}`}</button>{/if}
					</td>
					<td><span class="cat" style="background:{CATS[first.product_slug]?.soft};color:{CATS[first.product_slug]?.color}">{CATS[first.product_slug]?.name ?? first.product_slug}</span></td>
					<td>{g.qty.toLocaleString('it-IT')} pz</td>
					<td>
						{#if canStart(g)}
							<form method="POST" action="?/produzione" use:enhance={() => { starting = g.key; return async ({ update }) => { starting = null; await update(); }; }}><input type="hidden" name="group" value={g.key} /><button class="btn btn--green btn--xs" type="submit" disabled={starting === g.key} title="L'ordine entra nella coda di produzione (prima lavorazione: stampa)">{starting === g.key ? '…' : '▶ Inizia produzione'}</button></form>
							{#if g.status === 'attesa_pagamento'}<div class="osub" style="margin-top:4px">in attesa dell'anticipo</div>{/if}
						{:else}
							<span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span>
							{#if g.status === 'in_produzione' && first.prod_stage}<div class="osub">{PROD_STAGES[first.prod_stage] ?? first.prod_stage}</div>{/if}
						{/if}
					</td>
					<td style="text-align:right"><b>{money(g.net)}</b><div class="osub">{money(g.gross)} IVA incl.{#if paymentIcon(g.payment_method)} <img src={paymentIcon(g.payment_method)} alt={paymentLabel(g.payment_method)} title={paymentLabel(g.payment_method)} style="height:14px;vertical-align:middle" />{:else if g.payment_method} · {g.payment_method}{/if}</div></td>
					<td>
						<div class="row-actions">
							<form method="POST" action="?/star" use:enhance><input type="hidden" name="group" value={g.key} /><input type="hidden" name="on" value={g.starred ? '0' : '1'} /><button type="submit" class="ibtn" title="Segna ordine">{g.starred ? '⭐' : '☆'}</button></form>
							<a class="ibtn" href="/dashboard/fatturazione/ordini/nuovo?da={g.key}" title="Duplica: ordine nuovo con gli stessi dati">⧉</a>
							<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm(`Eliminare l'ordine ${g.number}?`)) e.preventDefault(); }}><input type="hidden" name="group" value={g.key} /><button type="submit" class="ibtn" title="Elimina">🗑️</button></form>
						</div>
					</td>
				</tr>
				{#if expanded.has(g.key)}
					{#each g.items.slice(1) as it (it.id)}
						<tr class="orow-sub">
							<td></td><td><span class="osub">{it.number}</span></td><td></td>
							<td><div class="item-cell">{#if it.preview_url || it.mockup_url}<img src={it.mockup_url ?? it.preview_url} alt="" />{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td>
							<td><span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color}">{CATS[it.product_slug]?.name ?? it.product_slug}</span></td>
							<td>{it.qty.toLocaleString('it-IT')} pz</td>
							<td><span class="st" style="background:{st(it.status).soft};color:{st(it.status).color}">{st(it.status).label}</span></td>
							<td style="text-align:right">{money(Number(it.total_net))}</td><td></td>
						</tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine corrisponde ai filtri selezionati.</td></tr>
			{/each}
		</tbody>
		{#if list.length}
			<tfoot class="otot">
				<tr>
					<td colspan="7"><b>Totale {totals.n} {totals.n === 1 ? 'ordine' : 'ordini'}</b> con i filtri attivi{#if totals.cancelled} <span class="osub">({totals.cancelled} {totals.cancelled === 1 ? 'annullato escluso' : 'annullati esclusi'})</span>{/if}{#if pages > 1}<div class="osub">In questa pagina: {money(totals.pageNet)} imponibile · {money(totals.pageGross)} IVA inclusa</div>{/if}</td>
					<td style="text-align:right"><div class="otot__row"><span>Imponibile</span><b>{money(totals.net)}</b></div><div class="otot__row"><span>IVA</span><b>{money(totals.vat)}</b></div><div class="otot__row otot__row--tot"><span>Totale IVA inclusa</span><b>{money(totals.gross)}</b></div></td>
					<td></td>
				</tr>
			</tfoot>
		{/if}
	</table>
</div>
{#if pages > 1}
	<div class="pager">
		<button type="button" class="btn btn--ghost btn--xs" disabled={page === 1} onclick={() => (page = Math.max(1, page - 1))}>‹ Precedente</button>
		{#each Array.from({ length: pages }, (_, i) => i + 1) as n (n)}<button type="button" class="pager__n" class:is-active={n === page} onclick={() => (page = n)}>{n}</button>{/each}
		<button type="button" class="btn btn--ghost btn--xs" disabled={page === pages} onclick={() => (page = Math.min(pages, page + 1))}>Successiva ›</button>
		<span class="osub">{PER_PAGE} per pagina</span>
	</div>
{/if}
