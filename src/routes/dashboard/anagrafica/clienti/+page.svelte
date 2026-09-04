<script lang="ts">
	import { money, dmy } from '$lib/dashboard/orders';
	let { data } = $props();
	let type = $state<'azienda' | 'privato' | 'ospite'>('azienda');
	let level = $state('all');
	let search = $state('');
	const LEVELS = [['all', 'Tutti i livelli'], ['creator', 'Creator'], ['partner', 'Partner'], ['ambassador', 'Ambassador']];
	const list = $derived(data.customers.filter((c) => c.type === type && (level === 'all' || c.level === level) && (!search || `${c.name} ${c.email} ${c.company ?? ''}`.toLowerCase().includes(search.toLowerCase()))));
	const count = (t: string) => data.customers.filter((c) => c.type === t).length;
	const exportUrl = $derived(`/dashboard/anagrafica/clienti/export?type=${type}&level=${level}`);
	const LV_IMG: Record<string, string> = { creator: '/images/loyalty/creator.png', partner: '/images/loyalty/partner.png', ambassador: '/images/loyalty/ambassador.png' };
</script>

<svelte:head><title>Clienti | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Anagrafica clienti</h1><p class="lead">Aziende, privati e ospiti (hanno ordinato senza registrarsi). Filtra per livello e scarica le email in Excel per Klaviyo.</p></div>
	<a class="btn btn--green" href={exportUrl}>⬇ Scarica Excel ({list.length})</a>
</div>

<div class="dcard filters" style="grid-template-columns:auto auto 1fr">
	<div class="tabs">
		<button type="button" class:is-active={type === 'azienda'} onclick={() => (type = 'azienda')}>🏢 Aziende <span class="osub">{count('azienda')}</span></button>
		<button type="button" class:is-active={type === 'privato'} onclick={() => (type = 'privato')}>👤 Privati <span class="osub">{count('privato')}</span></button>
		<button type="button" class:is-active={type === 'ospite'} onclick={() => (type = 'ospite')}>✉️ Ospiti <span class="osub">{count('ospite')}</span></button>
	</div>
	<select bind:value={level} disabled={type === 'ospite'}>{#each LEVELS as [k, l] (k)}<option value={k}>{l}</option>{/each}</select>
	<input type="text" placeholder="Cerca nome, azienda o email…" bind:value={search} />
</div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Cliente</th><th>Livello</th><th>Ordini</th><th>Speso (netto)</th><th>Spesa media</th><th>Ultimo ordine</th><th>Cliente dal</th></tr></thead>
		<tbody>
			{#each list as c (c.id ?? c.email)}
				<tr>
					<td>{#if c.id}<a class="oid" href="/dashboard/anagrafica/clienti/{c.id}">{c.name}</a>{:else}<b>{c.name}</b>{/if}<div class="osub">{c.email}{#if c.company} · {c.company}{/if}{#if c.vat} · P.IVA {c.vat}{/if}</div></td>
					<td>{#if LV_IMG[c.level]}<img src={LV_IMG[c.level]} alt="" style="width:22px;height:22px;vertical-align:middle;margin-right:6px" />{/if}{c.levelName}</td>
					<td>{c.orders}</td>
					<td><b>{money(c.spent)}</b></td>
					<td>{money(c.avg)}</td>
					<td>{dmy(c.lastOrder)}</td>
					<td>{c.since ? new Date(c.since).getFullYear() : '—'}</td>
				</tr>
			{:else}
				<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nessun cliente con questi filtri.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
