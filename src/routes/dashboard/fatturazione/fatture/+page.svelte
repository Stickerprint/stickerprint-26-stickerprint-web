<script lang="ts">
	import { money, dmy, monthKey, MONTHS } from '$lib/dashboard/orders';
	import MonthBar from '$lib/components/dashboard/MonthBar.svelte';
	import { paymentIcon, paymentLabel } from '$lib/dashboard/payments';
	import { invalidateAll } from '$app/navigation';
	let { data } = $props();
	let selected = $state<Set<string>>(new Set());
	let search = $state('');
	/* come negli ordini: si parte dal mese in corso, elenco e totali parlano di quel mese */
	let month = $state<string | null>(data.year === new Date().getFullYear() ? String(new Date().getMonth()) : null);
	const meseLabel = $derived(month === null ? `tutto il ${data.year}` : month === 'prev' ? `prima del ${data.year}` : month === 'next' ? `dopo il ${data.year}` : `${MONTHS[+month]} ${data.year}`);
	const list = $derived(data.invoices.filter((i) => { if (month !== null && monthKey(i.issued_at, data.year) !== month) return false; const q = search.trim().toLowerCase(); if (!q) return true; const b = i.billing ?? {}; return `${i.number} ${b.company ?? ''} ${b.first_name ?? ''} ${b.last_name ?? ''} ${i.email ?? ''} ${b.vat ?? ''}`.toLowerCase().includes(q); }));
	function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); selected = s; }
	function genXml() { window.open(`/dashboard/fatturazione/fatture/xml?ids=${[...selected].join(',')}`, '_blank'); setTimeout(() => { selected = new Set(); invalidateAll(); }, 1500); }
	const tot = $derived(list.reduce((s, i) => s + Number(i.amount_gross), 0));
	const net = $derived(list.reduce((s, i) => s + Number(i.subtotal_net) - Number(i.discount_net) + Number(i.express_net), 0));
	const ddtsOf = (inv: { ddt_numbers: string[] | null; ddt_number: string | null }) => inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : [];
</script>

<svelte:head><title>Fatture {data.year} | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Fatture {data.year}</h1><p class="lead">Generate in automatico dagli ordini e-commerce; per gli ordini manuali nascono dai DDT. Apri una fattura per vederla o modificarla (finché non è stato generato l'XML).</p></div>
	<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<button type="button" class="btn btn--green" disabled={selected.size === 0} onclick={genXml}>📤 Genera XML fatture elettroniche ({selected.size})</button>
	</div>
</div>
<MonthBar bind:month year={data.year} items={data.invoices} dateOf={(i: { issued_at: string }) => i.issued_at} amountOf={(i: { amount_gross: number }) => Number(i.amount_gross)} unit="fatt." />
<p class="stats5-rif">Stai guardando <b>{meseLabel}</b>: elenco e totali qui sotto sono solo di {meseLabel}.</p>
<div class="dcard filters" style="grid-template-columns:1fr"><input type="text" placeholder="Cerca numero, intestatario, email o P.IVA…" bind:value={search} /></div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th><input type="checkbox" checked={selected.size > 0 && selected.size === list.length} onchange={() => (selected = selected.size === list.length ? new Set() : new Set(list.map((i) => i.id)))} /></th><th>Numero</th><th>Data</th><th>Intestatario</th><th>Imponibile</th><th>IVA</th><th style="text-align:right">Totale</th><th>Pagamento</th><th></th></tr></thead>
		<tbody>
			{#each list as inv (inv.id)}
				{@const b = inv.billing ?? {}}
				<tr>
					<td><input type="checkbox" checked={selected.has(inv.id)} onchange={() => toggle(inv.id)} /></td>
					<td><a class="oid" href="/dashboard/fatturazione/fatture/{inv.id}">{inv.number}</a>{#if ddtsOf(inv).length}<div class="osub">DDT {ddtsOf(inv).join(', ')}</div>{/if}{#if inv.xml_generated_at}<div class="osub" style="color:#15803d">🔒 XML generato il {dmy(inv.xml_generated_at)}</div>{/if}</td>
					<td>{dmy(inv.issued_at)}</td>
					<td><b>{b.company || `${b.first_name ?? ''} ${b.last_name ?? ''}`}</b><div class="osub">{inv.email}{#if b.vat} · P.IVA {b.vat}{/if}</div></td>
					<td>{money(Number(inv.subtotal_net) - Number(inv.discount_net) + Number(inv.express_net))}</td>
					<td>{money(Number(inv.vat_amount))}</td>
					<td style="text-align:right"><b>{money(Number(inv.amount_gross))}</b></td>
					<td>{#if paymentIcon(inv.payment_method)}<img src={paymentIcon(inv.payment_method)} alt={paymentLabel(inv.payment_method)} title={paymentLabel(inv.payment_method)} style="height:16px;vertical-align:middle" />{:else}{paymentLabel(inv.payment_method)}{/if}{#if inv.payment_terms?.length > 1}<div class="osub">{inv.payment_terms.length} rate</div>{/if}{#if inv.sent_at}<div class="osub">✉️ inviata</div>{/if}</td>
					<td style="white-space:nowrap"><a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/fatture/{inv.id}">{inv.xml_generated_at ? '👁 Apri' : '✏️ Apri'}</a> {#if inv.pdf}<a class="btn btn--ghost btn--xs" href={inv.pdf} target="_blank" rel="noopener">⬇ PDF</a>{/if}</td>
				</tr>
			{:else}
				<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Nessuna fattura in {meseLabel}.</td></tr>
			{/each}
		</tbody>
		{#if list.length}<tfoot><tr><td colspan="4"><b>Totale {meseLabel}</b></td><td><b>{money(net)}</b></td><td></td><td style="text-align:right"><b>{money(tot)}</b></td><td colspan="2"></td></tr></tfoot>{/if}
	</table>
</div>
