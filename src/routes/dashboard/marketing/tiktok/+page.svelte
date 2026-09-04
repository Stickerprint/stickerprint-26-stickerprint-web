<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Stat from '$lib/components/marketing/Stat.svelte';
	import { num, euro } from '$lib/marketing/formato';
	let { data, form } = $props();
	const tt = $derived(data.configurato ? data.tt : null);
	const maxG = $derived(tt ? Math.max(1, ...tt.giorni.map((g) => g.spesa)) : 1);
	let edit = $state<Record<string, number>>({});
	const STEP = 5;
</script>

<svelte:head><title>TikTok Ads | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>TikTok Ads</h1><p class="lead">Campagne e spesa dell'account TikTok Ads, lette adesso. Da qui alzi, abbassi o azzeri il budget di ogni campagna e la metti in pausa.</p></div>
	{#if tt}<span class="mk-nota">Ultimi 30 giorni · aggiornato {new Date(tt.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>{/if}
</div>
{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="TikTok Ads non collegato" testo="Su Vercel mancano: {data.mancanti.join(', ')}. Da TikTok for Business → Developer crea un'app Marketing API, autorizzala sull'account pubblicitario e incolla l'Access Token e l'Advertiser ID." />
{:else if !tt}
	<div class="mk-err">TikTok Ads non risponde: {data.errore}</div>
{:else}
	<div class="mk-stats" style="grid-template-columns:repeat(5,1fr)">
		<Stat etichetta="Spesa 30 giorni" valore={euro(tt.kpi.spesa, 2)} nota="questo mese {euro(tt.spesaMese, 2)}" />
		<Stat etichetta="Impressioni" valore={num(tt.kpi.impressioni)} />
		<Stat etichetta="Clic" valore={num(tt.kpi.clic)} nota={tt.kpi.ctr != null ? `CTR ${tt.kpi.ctr.toFixed(2)}%` : ''} />
		<Stat etichetta="Costo per clic" valore={tt.kpi.cpc != null ? euro(tt.kpi.cpc, 2) : '—'} />
		<Stat etichetta="Conversioni" valore={num(tt.kpi.conversioni)} nota={tt.kpi.costoPerConversione != null ? `${euro(tt.kpi.costoPerConversione, 2)} l'una` : ''} />
	</div>
	<div class="dcard">
		<h3>Spesa giorno per giorno</h3>
		<div class="mk-bars">{#each tt.giorni as g (g.giorno)}<div class="mk-bar" title="{g.giorno}: {euro(g.spesa, 2)} · {g.clic} clic · {g.conversioni} conversioni"><i style="height:{Math.round((g.spesa / maxG) * 100)}%"></i><b>{g.giorno.slice(8)}</b></div>{/each}</div>
	</div>
	<div class="dcard" style="padding:0;overflow-x:auto">
		<table class="dtable">
			<thead><tr><th>Campagna</th><th>Stato</th><th>Spesa 30 gg</th><th>Clic</th><th>Conversioni</th><th>Budget</th><th></th></tr></thead>
			<tbody>
				{#each tt.campagne as c (c.id)}
					{@const cur = edit[c.id] ?? c.budget ?? 0}
					<tr>
						<td><b>{c.nome}</b><div class="osub">{c.obiettivo}</div></td>
						<td><span class="mk-chip {c.attiva ? 'mk-chip--green' : 'mk-chip--gray'}">{c.attiva ? 'Attiva' : 'In pausa'}</span></td>
						<td><b>{euro(c.spesa, 2)}</b>{#if c.cpc != null}<div class="osub">{euro(c.cpc, 2)} a clic</div>{/if}</td>
						<td>{num(c.clic)}</td>
						<td>{num(c.conversioni)}{#if c.costoPerConversione != null}<div class="osub">{euro(c.costoPerConversione, 2)} l'una</div>{/if}</td>
						<td>
							{#if c.budgetTipo === 'illimitato'}<span class="osub">senza tetto (budget sui gruppi)</span>
							{:else}
								<form method="POST" action="?/budget" use:enhance style="display:flex;gap:4px;align-items:center">
									<input type="hidden" name="id" value={c.id} /><input type="hidden" name="mode" value={c.budgetTipo} />
									<button type="button" class="ibtn" title="−{STEP} €" onclick={() => (edit[c.id] = Math.max(0, cur - STEP))}>➖</button>
									<input type="number" name="budget" min="0" step="1" class="sel-sm" style="width:90px" value={cur} oninput={(e) => (edit[c.id] = Number((e.currentTarget as HTMLInputElement).value))} />
									<button type="button" class="ibtn" title="+{STEP} €" onclick={() => (edit[c.id] = cur + STEP)}>➕</button>
									<span class="osub">€/{c.budgetTipo === 'giornaliero' ? 'giorno' : 'totale'}</span>
									<button class="btn btn--ghost btn--xs" type="submit" disabled={(edit[c.id] ?? c.budget) === c.budget}>Salva</button>
								</form>
							{/if}
						</td>
						<td style="white-space:nowrap">
							<form method="POST" action="?/stato" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="on" value={c.attiva ? '0' : '1'} /><button class="btn btn--xs {c.attiva ? 'btn--white' : 'btn--green'}" type="submit">{c.attiva ? '⏸ Pausa' : '▶ Riattiva'}</button></form>
						</td>
					</tr>
				{:else}
					<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nessuna campagna sull'account.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
