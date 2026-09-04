<script lang="ts">
	import { enhance } from '$app/forms';
	import { computeTerms, type PaymentMethod } from '$lib/dashboard/payments';
	let { data, form } = $props();
	let editing = $state<Partial<PaymentMethod> | null>(null);
	const XML = [['MP05', 'MP05 · Bonifico'], ['MP12', 'MP12 · RIBA'], ['MP01', 'MP01 · Contanti'], ['MP02', 'MP02 · Assegno'], ['MP08', 'MP08 · Carta'], ['MP19', 'MP19 · SEPA DD']];
	const example = (m: PaymentMethod) => m.custom ? 'rate a mano sull’ordine' : computeTerms(m, 1000, new Date()).map((t) => `${new Date(t.due).toLocaleDateString('it-IT')} · ${t.amount.toFixed(2)} €`).join(' · ');
</script>

<svelte:head><title>Metodi di pagamento | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Metodi di pagamento</h1><p class="lead">Valgono per gli ordini manuali. Gli ordini e-commerce si pagano solo con PayPal o carta di credito (Stripe). Le regole qui sotto calcolano le scadenze che finiscono in fattura e nell'XML.</p></div>
	<button type="button" class="btn btn--green" onclick={() => (editing = { name: '', xml_code: 'MP05', days: 0, end_of_month: false, installments: 1, paid_upfront: false, custom: false, active: true, sort: 10 })}>+ Nuovo metodo</button>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

{#if editing}
	<div class="dcard">
		<h3>{editing.id ? 'Modifica metodo' : 'Nuovo metodo'}</h3>
		<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { editing = null; await update(); }} class="dform">
			<input type="hidden" name="id" value={editing.id ?? ''} />
			<label>Nome<input name="name" value={editing.name} required placeholder="es. Ricevuta bancaria 30 gg f.m." /></label>
			<label>Codice XML (FatturaPA)<select name="xml_code" value={editing.xml_code}>{#each XML as [k, l] (k)}<option value={k}>{l}</option>{/each}</select></label>
			<label>Giorni per rata<input type="number" name="days" min="0" value={editing.days} /></label>
			<label>Numero rate<input type="number" name="installments" min="1" value={editing.installments} /></label>
			<label>Ordine nel menù<input type="number" name="sort" value={editing.sort} /></label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="end_of_month" checked={editing.end_of_month} /> Fine mese (f.m.)</label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="paid_upfront" checked={editing.paid_upfront} /> Incassato prima della spedizione</label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="custom" checked={editing.custom} /> Rate personalizzate sull’ordine</label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" checked={editing.active !== false} value="on" /> Attivo</label>
			<div style="display:flex;gap:8px"><button class="btn btn--green btn--xs" type="submit">Salva</button><button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = null)}>Annulla</button></div>
		</form>
	</div>
{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Metodo</th><th>Codice XML</th><th>Regola</th><th>Esempio su 1.000 € emessa oggi</th><th>Attivo</th><th></th></tr></thead>
		<tbody>
			{#each data.methods as m (m.id)}
				<tr>
					<td><b>{m.name}</b>{#if m.paid_upfront}<div class="osub">incassato prima della spedizione</div>{/if}</td>
					<td>{m.xml_code}</td>
					<td>{#if m.custom}Rate a mano{:else}{m.installments} {m.installments === 1 ? 'rata' : 'rate'} · {m.days} gg{m.end_of_month ? ' f.m.' : ''}{/if}</td>
					<td class="osub">{example(m)}</td>
					<td><span class="pill {m.active ? 'pill--on' : 'pill--off'}">{m.active ? 'Sì' : 'No'}</span></td>
					<td style="white-space:nowrap"><button type="button" class="ibtn" title="Modifica" onclick={() => (editing = { ...m })}>✏️</button><form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare "${m.name}"?`)) e.preventDefault(); }}><input type="hidden" name="id" value={m.id} /><button class="ibtn" type="submit" title="Elimina">🗑️</button></form></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
