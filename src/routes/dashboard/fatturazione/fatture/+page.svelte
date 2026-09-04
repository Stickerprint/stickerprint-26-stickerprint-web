<script lang="ts">
	import { money, dmy } from '$lib/dashboard/orders';
	let { data } = $props();
	const tot = $derived(data.invoices.reduce((s, i) => s + Number(i.amount_gross), 0));
	const net = $derived(data.invoices.reduce((s, i) => s + Number(i.subtotal_net) - Number(i.discount_net) + Number(i.express_net), 0));
</script>

<svelte:head><title>Fatture {data.year} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Fatture {data.year}</h1><p class="lead">Generate in automatico dagli ordini e-commerce; per gli ordini manuali nascono dal DDT. Numerazione SPF che riparte ogni 1° gennaio.</p></div>
	<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
</div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Numero</th><th>Data</th><th>Intestatario</th><th>Ordine</th><th>Imponibile</th><th>IVA</th><th>Sconto SP</th><th style="text-align:right">Totale</th><th>Pagamento</th><th></th></tr></thead>
		<tbody>
			{#each data.invoices as inv (inv.id)}
				{@const b = inv.billing ?? {}}
				<tr>
					<td><b>{inv.number}</b></td>
					<td>{dmy(inv.issued_at)}</td>
					<td><b>{b.company || `${b.first_name ?? ''} ${b.last_name ?? ''}`}</b><div class="osub">{inv.email}{#if b.vat} · P.IVA {b.vat}{/if}</div></td>
					<td>{#if inv.checkout_group}<a class="link" href="/dashboard/fatturazione/ordini/{inv.checkout_group}">apri</a>{:else}—{/if}</td>
					<td>{money(Number(inv.subtotal_net) - Number(inv.discount_net) + Number(inv.express_net))}</td>
					<td>{money(Number(inv.vat_amount))}</td>
					<td>{Number(inv.credit_used) > 0 ? '−' + money(Number(inv.credit_used)) : '—'}</td>
					<td style="text-align:right"><b>{money(Number(inv.amount_gross))}</b></td>
					<td>{inv.payment_method === 'test' ? 'test' : inv.payment_method ?? '—'}{#if inv.sent_at}<div class="osub">✉️ inviata</div>{/if}</td>
					<td>{#if inv.pdf}<a class="btn btn--ghost btn--xs" href={inv.pdf} target="_blank" rel="noopener">⬇ PDF</a>{/if}</td>
				</tr>
			{:else}
				<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Nessuna fattura nel {data.year}.</td></tr>
			{/each}
		</tbody>
		{#if data.invoices.length}<tfoot><tr><td colspan="4"><b>Totale {data.year}</b></td><td><b>{money(net)}</b></td><td></td><td></td><td style="text-align:right"><b>{money(tot)}</b></td><td colspan="2"></td></tr></tfoot>{/if}
	</table>
</div>
