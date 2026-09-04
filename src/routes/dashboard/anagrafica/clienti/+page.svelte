<script lang="ts">
	import { enhance } from '$app/forms';
	import { money, dmy, COUNTRIES } from '$lib/dashboard/orders';
	let { data, form } = $props();
	let type = $state<'azienda' | 'privato' | 'ospite'>('azienda');
	let level = $state('all');
	let search = $state('');
	let adding = $state(false);
	const LEVELS = [['all', 'Tutti i livelli'], ['creator', 'Creator'], ['partner', 'Partner'], ['ambassador', 'Ambassador'], ['nessuno', 'Solo anagrafica']];
	const list = $derived(data.customers.filter((c) => c.type === type && (level === 'all' || c.level === level) && (!search || `${c.name} ${c.email} ${c.company ?? ''} ${c.vat ?? ''}`.toLowerCase().includes(search.toLowerCase()))));
	const count = (t: string) => data.customers.filter((c) => c.type === t).length;
	const exportUrl = $derived(`/dashboard/anagrafica/clienti/export?type=${type}&level=${level}`);
	const LV_IMG: Record<string, string> = { creator: '/images/loyalty/creator.png', partner: '/images/loyalty/partner.png', ambassador: '/images/loyalty/ambassador.png' };
	$effect(() => { if (form?.ok) adding = false; });
</script>

<svelte:head><title>Clienti | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Anagrafica clienti</h1><p class="lead">Aziende, privati e ospiti (hanno ordinato senza registrarsi). Filtra per livello e scarica le email in Excel per Klaviyo.</p></div>
	<div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn btn--green" onclick={() => (adding = true)} title="Nuova anagrafica">＋ Nuova anagrafica</button><a class="btn btn--ghost btn--xs" href={exportUrl}>⬇ Excel ({list.length})</a></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Anagrafica salvata. <a class="link" href="/dashboard/anagrafica/clienti/{form.created}">Aprila</a>.</p>{/if}

<div class="dcard filters" style="grid-template-columns:auto auto 1fr">
	<div class="tabs">
		<button type="button" class:is-active={type === 'azienda'} onclick={() => (type = 'azienda')}>🏢 Aziende <span class="osub">{count('azienda')}</span></button>
		<button type="button" class:is-active={type === 'privato'} onclick={() => (type = 'privato')}>👤 Privati <span class="osub">{count('privato')}</span></button>
		<button type="button" class:is-active={type === 'ospite'} onclick={() => (type = 'ospite')}>✉️ Ospiti <span class="osub">{count('ospite')}</span></button>
	</div>
	<select bind:value={level} disabled={type === 'ospite'}>{#each LEVELS as [k, l] (k)}<option value={k}>{l}</option>{/each}</select>
	<input type="text" placeholder="Cerca nome, azienda, P.IVA o email…" bind:value={search} />
</div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Cliente</th><th>Livello</th><th>Ordini</th><th>Speso (netto)</th><th>Spesa media</th><th>Ultimo ordine</th><th>Cliente dal</th></tr></thead>
		<tbody>
			{#each list as c (c.kind + (c.id ?? c.email))}
				<tr>
					<td>{#if c.id}<a class="oid" href="/dashboard/anagrafica/clienti/{c.id}">{c.name}</a>{:else}<b>{c.name}</b>{/if}<div class="osub">{c.email}{#if c.company && c.company !== c.name} · {c.company}{/if}{#if c.vat} · P.IVA {c.vat}{/if}</div></td>
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

{#if adding}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>＋ Nuova anagrafica</h3>
		<form method="POST" action="?/create" use:enhance class="dform dform--1">
			<label>Cliente / ragione sociale<input name="name" required placeholder="Nome e cognome o azienda" /></label>
			<div class="row2"><label>Nome<input name="first_name" /></label><label>Cognome<input name="last_name" /></label></div>
			<label>Indirizzo<input name="address" placeholder="Via, civico" /></label>
			<div class="row3"><label>Comune<input name="city" /></label><label>CAP<input name="cap" /></label><label>Prov.<input name="province" maxlength="2" /></label></div>
			<label>Paese<select name="country">{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k} selected={k === 'IT'}>{v.flag} {v.name}</option>{/each}</select></label>
			<div class="row2"><label>Partita IVA<input name="piva" /></label><label>Codice fiscale<input name="cf" /></label></div>
			<div class="row2"><label>Codice SDI<input name="sdi" maxlength="7" /></label><label>PEC<input name="pec" type="email" /></label></div>
			<div class="row2"><label>Email<input name="email" type="email" /></label><label>Telefono<input name="phone" /></label></div>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (adding = false)}>Annulla</button><button class="btn btn--green" type="submit">Salva anagrafica</button></div>
		</form>
	</div></div>
{/if}
