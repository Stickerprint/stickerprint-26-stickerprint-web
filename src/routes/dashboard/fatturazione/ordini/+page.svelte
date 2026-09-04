<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, CATS, COUNTRIES, MONTHS, money, dmy, itemMeta, thumbOf, PRODUCTION_STATUSES, SHIPPING_STATUSES, DEVICE_ICON, CHANNEL_ICON, type OrderGroup } from '$lib/dashboard/orders';
	import { paymentIcon, paymentLabel } from '$lib/dashboard/payments';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data } = $props();
	let search = $state('');
	let cat = $state('all');
	let channel = $state('all');
	let status = $state('all');
	let star = $state('entrambi');
	let month = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	const year = $derived(data.year);
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
		if (status !== 'all' && g.status !== status) return false;
		if (star === 'starred' && !g.starred) return false;
		if (star === 'unstarred' && g.starred) return false;
		if (month !== null) {
			const d = new Date(g.created_at); const y = d.getFullYear();
			const k = y < year ? 'prev' : y > year ? 'next' : String(d.getMonth());
			if (k !== month) return false;
		}
		return true;
	}));
	const stats = $derived({
		total: data.groups.length,
		produzione: data.groups.filter((g: OrderGroup) => PRODUCTION_STATUSES.includes(g.status)).length,
		spedizione: data.groups.filter((g: OrderGroup) => SHIPPING_STATUSES.includes(g.status)).length,
		consegnati: data.groups.filter((g: OrderGroup) => g.status === 'consegnato' && Date.now() - new Date(g.created_at).getTime() < 30 * 864e5).length,
		net: data.groups.filter((g: OrderGroup) => g.status !== 'annullato').reduce((s: number, g: OrderGroup) => s + g.net, 0)
	});
	function toggle(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
</script>

<svelte:head><title>Ordini | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Ordini {data.year}</h1><p class="lead">E-commerce e manuali, in un'unica vista · {list.length} risultati</p></div>
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

<div class="stats5">
	<div class="dcard stat5"><span class="ico" style="background:#fde7f1;color:#e0117f">📦</span><div><small>Totale ordini</small><b>{stats.total}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#e5f0ff;color:#3b82f6">🖨️</span><div><small>In produzione</small><b>{stats.produzione}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcf9f4;color:#0d9488">🚚</span><div><small>In spedizione</small><b>{stats.spedizione}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcfce7;color:#15803d">✅</span><div><small>Consegnati (30 gg)</small><b>{stats.consegnati}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#fef6db;color:#c48a00">💶</span><div><small>Fatturato netto</small><b>{money(stats.net)}</b></div></div>
</div>

<div class="dcard filters">
	<input type="text" placeholder="Cerca ordine, cliente o email…" bind:value={search} />
	<select bind:value={cat}><option value="all">Tutte le categorie</option>{#each Object.entries(CATS) as [slug, c] (slug)}<option value={slug}>{c.name}</option>{/each}</select>
	<select bind:value={channel}><option value="all">Tutti i canali</option><option value="ecommerce">🛒 E-commerce</option><option value="manuale">✍️ Manuale</option></select>
	<select bind:value={status}><option value="all">Tutti gli stati</option>{#each Object.entries(ORDER_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select>
	<select bind:value={star}><option value="entrambi">⭐ Tutti</option><option value="starred">Segnati</option><option value="unstarred">Non segnati</option></select>
</div>

<div class="dcard" style="overflow-x:auto;padding:0">
	<table class="dtable otable">
		<thead><tr><th></th><th>Ordine</th><th>Cliente</th><th>Articolo</th><th>Categoria</th><th>Q.tà</th><th>Spedizione</th><th>Stato</th><th style="text-align:right">Importo</th><th></th></tr></thead>
		<tbody>
			{#each list as g (g.key)}
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
					<td>{dmy(g.delivery_date)}</td>
					<td><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span></td>
					<td style="text-align:right"><b>{money(g.net)}</b><div class="osub">{money(g.gross)} IVA incl.{#if paymentIcon(g.payment_method)} <img src={paymentIcon(g.payment_method)} alt={paymentLabel(g.payment_method)} title={paymentLabel(g.payment_method)} style="height:14px;vertical-align:middle" />{:else if g.payment_method} · {g.payment_method}{/if}</div></td>
					<td>
						<div class="row-actions">
							<form method="POST" action="?/star" use:enhance><input type="hidden" name="group" value={g.key} /><input type="hidden" name="on" value={g.starred ? '0' : '1'} /><button type="submit" class="ibtn" title="Segna ordine">{g.starred ? '⭐' : '☆'}</button></form>
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
							<td>{it.qty.toLocaleString('it-IT')} pz</td><td></td>
							<td><span class="st" style="background:{st(it.status).soft};color:{st(it.status).color}">{st(it.status).label}</span></td>
							<td style="text-align:right">{money(Number(it.total_net))}</td><td></td>
						</tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine corrisponde ai filtri selezionati.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
