<script lang="ts">
	import { enhance } from '$app/forms';
	import { money, dmy } from '$lib/dashboard/orders';
	let { data, form } = $props();
	let selected = $state<Set<string>>(new Set());
	const selectable = $derived(data.ddts.filter((d) => !d.invoice_id).map((d) => d.id));
	function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); selected = s; }
</script>

<svelte:head><title>DDT {data.year} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>DDT {data.year}</h1><p class="lead">Documenti di trasporto degli ordini manuali. Numerazione SPD che riparte ogni 1° gennaio. Seleziona e genera le fatture.</p></div>
	<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<form method="POST" action="?/invoice" use:enhance={() => async ({ update }) => { selected = new Set(); await update(); }}><input type="hidden" name="ids" value={[...selected].join(',')} /><button class="btn btn--green" type="submit" disabled={selected.size === 0}>🧾 Genera fattura da DDT selezionati ({selected.size})</button></form>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.made?.length}<p class="success">Create: {form.made.join(', ')} (le trovi in Fatture).</p>{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th><input type="checkbox" checked={selected.size > 0 && selected.size === selectable.length} onchange={() => (selected = selected.size === selectable.length ? new Set() : new Set(selectable))} /></th><th>DDT</th><th>Data</th><th>Cliente</th><th>Ordine</th><th>Colli / peso</th><th>Trasporto</th><th style="text-align:right">Totale</th><th>Fattura</th><th></th></tr></thead>
		<tbody>
			{#each data.ddts as d (d.id)}
				{@const dd = d.data ?? {}}
				<tr>
					<td>{#if !d.invoice_id}<input type="checkbox" checked={selected.has(d.id)} onchange={() => toggle(d.id)} />{/if}</td>
					<td><b>{d.number}</b></td>
					<td>{dmy(d.issued_at)}</td>
					<td><b>{d.customer_name}</b><div class="osub">{d.email ?? ''}</div></td>
					<td>collegato a ordine <a class="oid" href="/dashboard/fatturazione/ordini/{d.checkout_group}">{d.order_number}</a></td>
					<td>{d.parcels} {d.parcels === 1 ? 'collo' : 'colli'}{#if d.weight_kg} · {d.weight_kg} kg{/if}</td>
					<td>{d.trasporto}</td>
					<td style="text-align:right"><b>{money(Number(dd.total_gross ?? 0))}</b><div class="osub">{money(Number(dd.subtotal_net ?? 0))} + IVA</div></td>
					<td>{#if d.invoice_number}<b>{d.invoice_number}</b><div class="osub">generata da {d.number}</div>{:else}<span class="osub">da fatturare</span>{/if}</td>
					<td style="white-space:nowrap">
						<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ddt/{d.id}/pdf" target="_blank">⬇ PDF</a>
						<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?ddt={d.id}" target="_blank">🏷️</a>
						{#if !d.invoice_id}<form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare il DDT ${d.number}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={d.id} /><button class="ibtn" type="submit" title="Elimina">🗑️</button></form>{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Nessun DDT nel {data.year}. Si generano da In spedizione con "Spedito → DDT" sulle consegne dirette.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
