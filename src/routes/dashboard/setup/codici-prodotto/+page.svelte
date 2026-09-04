<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATS, money } from '$lib/dashboard/orders';
	import type { ProductCode } from '$lib/dashboard/orderDraft';
	let { data, form } = $props();
	let editing = $state<Partial<ProductCode> | null>(null);
</script>

<svelte:head><title>Codici prodotto | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Codici prodotto</h1><p class="lead">Il prefisso (ADR, STK, STKR, STKF, EAT, VET, CMP) decide la categoria di produzione. I codici completi (es. ADR01) portano descrizione e prezzo negli ordini manuali.</p></div>
	<button type="button" class="btn btn--green" onclick={() => (editing = { code: '', name: '', category: 'adesivi_personalizzati', description: '', unit_net: null, active: true, sort: 10 })}>+ Nuovo codice</button>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

{#if editing}
	<div class="dcard">
		<h3>{editing.id ? 'Modifica codice' : 'Nuovo codice'}</h3>
		<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { editing = null; await update(); }} class="dform">
			<input type="hidden" name="id" value={editing.id ?? ''} />
			<label>Codice<input name="code" value={editing.code} required maxlength="12" style="text-transform:uppercase" placeholder="es. ADR01" /></label>
			<label>Nome<input name="name" value={editing.name} required placeholder="es. Adesivo resinato 55×85" /></label>
			<label>Categoria di produzione<select name="category" value={editing.category}>{#each Object.entries(CATS) as [slug, c] (slug)}<option value={slug}>{c.name} ({c.code})</option>{/each}</select></label>
			<label>Descrizione di default<input name="description" value={editing.description ?? ''} placeholder="es. 55×85 mm, PVC bianco" /></label>
			<label>Prezzo unitario netto €<input name="unit_net" type="number" step="0.0001" min="0" value={editing.unit_net ?? ''} /></label>
			<label>Ordine<input type="number" name="sort" value={editing.sort} /></label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" checked={editing.active !== false} value="on" /> Attivo</label>
			<div style="display:flex;gap:8px"><button class="btn btn--green btn--xs" type="submit">Salva</button><button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = null)}>Annulla</button></div>
		</form>
	</div>
{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Codice</th><th>Nome</th><th>Categoria</th><th>Descrizione di default</th><th>Prezzo unit.</th><th>Attivo</th><th></th></tr></thead>
		<tbody>
			{#each data.codes as c (c.id)}
				<tr>
					<td><b>{c.code}</b></td>
					<td>{c.name}</td>
					<td><span class="cat" style="background:{CATS[c.category]?.soft};color:{CATS[c.category]?.color}">{CATS[c.category]?.name ?? c.category}</span></td>
					<td class="osub">{c.description ?? '—'}</td>
					<td>{c.unit_net != null ? money(Number(c.unit_net)) : '—'}</td>
					<td><span class="pill {c.active ? 'pill--on' : 'pill--off'}">{c.active ? 'Sì' : 'No'}</span></td>
					<td style="white-space:nowrap"><button type="button" class="ibtn" title="Modifica" onclick={() => (editing = { ...c })}>✏️</button><form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare il codice ${c.code}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={c.id} /><button class="ibtn" type="submit" title="Elimina">🗑️</button></form></td>
				</tr>
			{:else}
				<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nessun codice: esegui la migrazione 0020 (i prefissi base vengono creati in automatico).</td></tr>
			{/each}
		</tbody>
	</table>
</div>
