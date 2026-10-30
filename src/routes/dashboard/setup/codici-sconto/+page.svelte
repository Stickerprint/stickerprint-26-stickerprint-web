<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT') : '—');
	const isExpired = (c: { valid_to: string | null }) => !!c.valid_to && new Date(c.valid_to) < new Date();
</script>

<svelte:head><title>Codici sconto | Dashboard Stickerprint</title></svelte:head>

<div>
	<h1>Codici sconto</h1>
	<p class="lead">Crea un codice, attivalo o spegnilo quando vuoi. I clienti lo inseriranno nel checkout. Ogni codice vale <b>una volta sola per cliente</b> (account o email dell’ordine), a meno che non lo rendi ripetibile.</p>
</div>

<div class="dcard">
	<h3>Nuovo codice</h3>
	<form method="POST" action="?/create" use:enhance class="dform">
		<label>Codice<input name="code" required minlength="3" placeholder="ES. ESTATE10" style="text-transform:uppercase" /></label>
		<label>Tipo<select name="kind"><option value="percent">Percentuale (%)</option><option value="fixed">Importo fisso (€)</option></select></label>
		<label>Valore<input name="value" type="number" step="0.01" min="0.01" required placeholder="10" /></label>
		<label>Ordine minimo (€)<input name="min_order" type="number" step="0.01" min="0" placeholder="0" /></label>
		<label>Utilizzi massimi<input name="max_uses" type="number" min="1" placeholder="illimitati" /></label>
		<label>Valido dal<input name="valid_from" type="date" /></label>
		<label>Valido fino al<input name="valid_to" type="date" /></label>
		<label style="grid-column:1/-1">Descrizione (interna)<input name="description" placeholder="Es. promo newsletter settembre" /></label>
		<label style="grid-column:1/-1;flex-direction:row;align-items:center;gap:8px"><input name="ripetibile" type="checkbox" style="width:auto" /> Ripetibile: lo stesso cliente può usarlo su più ordini <span class="note">(di regola ogni codice vale una volta sola per cliente, riconosciuto dall’account o dall’email)</span></label>
		<div><button class="btn btn--blue btn--sm" type="submit">Crea codice</button></div>
	</form>
	{#if form?.error}<p class="error" style="margin-top:12px">{form.error}</p>{/if}
	{#if form?.ok}<p class="success" style="margin-top:12px">Salvato.</p>{/if}
	{#if data.dbError}<p class="error" style="margin-top:12px">Tabella non disponibile: esegui la migrazione 0003_dashboard.sql su Supabase. ({data.dbError})</p>{/if}
</div>

<div class="dcard" style="overflow-x:auto">
	<h3>Codici ({data.codes.length})</h3>
	{#if data.codes.length === 0}
		<p style="color:var(--muted)">Nessun codice ancora creato.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Codice</th><th>Sconto</th><th>Min. ordine</th><th>Utilizzi</th><th>Per cliente</th><th>Validità</th><th>Stato</th><th></th></tr></thead>
			<tbody>
				{#each data.codes as c (c.id)}
					<tr>
						<td><b>{c.code}</b>{#if c.description}<br /><small style="color:var(--muted)">{c.description}</small>{/if}</td>
						<td>{c.kind === 'percent' ? `${c.value}%` : `${c.value} €`}</td>
						<td>{c.min_order > 0 ? `${c.min_order} €` : '—'}</td>
						<td>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
						<td style="white-space:nowrap">{c.once_per_customer === false ? 'ripetibile' : 'una volta'} <form method="POST" action="?/ripetibile" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="once" value={String(c.once_per_customer === false)} /><button class="btn btn--ghost btn--xs" type="submit">{c.once_per_customer === false ? 'Rendi una volta' : 'Rendi ripetibile'}</button></form></td>
						<td>{fmtDate(c.valid_from)} → {fmtDate(c.valid_to)}</td>
						<td>{#if !c.active}<span class="pill pill--off">Spento</span>{:else if isExpired(c)}<span class="pill pill--off">Scaduto</span>{:else}<span class="pill pill--on">Attivo</span>{/if}</td>
						<td style="white-space:nowrap">
							<form method="POST" action="?/toggle" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.active)} /><button class="btn btn--ghost btn--xs" type="submit">{c.active ? 'Spegni' : 'Attiva'}</button></form>
							<form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare il codice ${c.code}?`)) e.preventDefault(); }}><input type="hidden" name="id" value={c.id} /><button class="btn btn--ghost btn--xs" type="submit">Elimina</button></form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
