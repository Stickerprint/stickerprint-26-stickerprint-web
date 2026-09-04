<script lang="ts">
	import { enhance } from '$app/forms';
	import { money, dmy } from '$lib/dashboard/orders';
	let { data, form } = $props();
	let selected = $state<Set<string>>(new Set());
	let search = $state('');
	const keyOf = (d: (typeof data.ddts)[number]) => { const c = (d.data?.customer ?? {}) as Record<string, string>; return c.vat ? 'vat:' + c.vat.replace(/^IT/i, '').trim() : 'name:' + (c.company || d.customer_name || '').toLowerCase().trim(); };
	const list = $derived(data.ddts.filter((d) => { const q = search.trim().toLowerCase(); if (!q) return true; const c = (d.data?.customer ?? {}) as Record<string, string>; return `${d.number} ${d.customer_name ?? ''} ${d.email ?? ''} ${c.vat ?? ''} ${d.order_number ?? ''}`.toLowerCase().includes(q); }));
	// si possono unire solo DDT della stessa partita IVA: scelto il primo, gli altri clienti si disattivano
	const activeKey = $derived(selected.size ? keyOf(data.ddts.find((d) => selected.has(d.id))!) : null);
	const selectable = $derived(list.filter((d) => !d.invoice_id && (!activeKey || keyOf(d) === activeKey)).map((d) => d.id));
	function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); selected = s; }
	function toggleAll() { selected = selected.size === selectable.length ? new Set() : new Set(selectable); }
</script>

<svelte:head><title>DDT {data.year} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>DDT {data.year}</h1><p class="lead">Documenti di trasporto degli ordini manuali. Filtra per cliente, seleziona i DDT della stessa partita IVA e genera un'unica fattura.</p></div>
	<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<form method="POST" action="?/invoice" use:enhance={() => async ({ update }) => { selected = new Set(); await update(); }}><input type="hidden" name="ids" value={[...selected].join(',')} /><button class="btn btn--green" type="submit" disabled={selected.size === 0}>🧾 {selected.size > 1 ? `Genera unica fattura (${selected.size} DDT)` : 'Genera fattura'}</button></form>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.made?.length}<p class="success">Fattura {form.made.join(', ')} creata{#if form.ddtCount > 1} da {form.ddtCount} DDT{/if}: <a class="link" href="/dashboard/fatturazione/fatture/{form.invoiceId}">aprila</a>.</p>{/if}

<div class="dcard filters" style="grid-template-columns:1fr auto">
	<input type="text" placeholder="Cerca per cliente, P.IVA, email, numero DDT o ordine…" bind:value={search} />
	{#if activeKey}<span class="note" style="align-self:center">Selezione limitata allo stesso cliente · <button type="button" class="link-btn" onclick={() => (selected = new Set())}>azzera</button></span>{/if}
</div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th><input type="checkbox" checked={selected.size > 0 && selected.size === selectable.length} onchange={toggleAll} /></th><th>DDT</th><th>Data</th><th>Cliente</th><th>Ordine</th><th>Colli / peso</th><th>Trasporto</th><th style="text-align:right">Totale</th><th>Fattura</th><th></th></tr></thead>
		<tbody>
			{#each list as d (d.id)}
				{@const dd = d.data ?? {}}
				{@const c = (dd.customer ?? {}) as Record<string, string>}
				<tr style:opacity={activeKey && keyOf(d) !== activeKey && !d.invoice_id ? 0.45 : 1}>
					<td>{#if !d.invoice_id}<input type="checkbox" checked={selected.has(d.id)} disabled={!!activeKey && keyOf(d) !== activeKey} onchange={() => toggle(d.id)} />{/if}</td>
					<td><b>{d.number}</b></td>
					<td>{dmy(d.issued_at)}</td>
					<td><b>{d.customer_name}</b><div class="osub">{d.email ?? ''}{#if c.vat} · P.IVA {c.vat}{/if}</div></td>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{d.checkout_group}">{d.order_number}</a></td>
					<td>{d.parcels} {d.parcels === 1 ? 'collo' : 'colli'}{#if d.weight_kg} · {d.weight_kg} kg{/if}</td>
					<td>{d.trasporto}</td>
					<td style="text-align:right"><b>{money(Number(dd.total_gross ?? 0))}</b><div class="osub">{money(Number(dd.subtotal_net ?? 0))} + IVA</div></td>
					<td>{#if d.invoice_id}<a class="oid" href="/dashboard/fatturazione/fatture/{d.invoice_id}">{d.invoice_number ?? 'fattura'}</a>{:else}<span class="osub">da fatturare</span>{/if}</td>
					<td style="white-space:nowrap">
						<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ddt/{d.id}/pdf" target="_blank">⬇ PDF</a>
						<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?ddt={d.id}" target="_blank">🏷️</a>
						{#if !d.invoice_id}<form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare il DDT ${d.number}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={d.id} /><button class="ibtn" type="submit" title="Elimina">🗑️</button></form>{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Nessun DDT{search ? ' con questo filtro' : ` nel ${data.year}`}. Si generano da In spedizione con "Spedito → DDT".</td></tr>
			{/each}
		</tbody>
	</table>
</div>
