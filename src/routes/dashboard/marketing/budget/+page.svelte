<script lang="ts">
	import { enhance } from '$app/forms';
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Stat from '$lib/components/marketing/Stat.svelte';
	import { euro, num, pct, quandoRelativo, statoContenuto, OBIETTIVI, PIATTAFORME, PIATTAFORMA_LABEL, splitPredefinito } from '$lib/marketing/formato';
	import type { Contenuto } from '$lib/marketing/tipi';
	let { data, form } = $props();

	const b = $derived(data.configurato && data.budget.ok ? data.budget : null);
	const contenuti = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti : []);
	const campagne = $derived(data.configurato && data.campagne.ok && data.campagne.collegato ? data.campagne : null);
	const quota = (p: string) => b?.quote.find((q) => q.platform === p)?.monthly_budget ?? 0;
	const mensile = $derived(b ? b.quote.reduce((s, q) => s + (Number(q.monthly_budget) || 0), 0) : 0);
	const conBudget = $derived(contenuti.filter((c) => c.budget_ads != null));
	const pianificato = $derived(conBudget.reduce((s, c) => s + (Number(c.budget_ads) || 0), 0));
	const daPianificare = $derived(Math.max(0, mensile - pianificato));
	const senzaBudget = $derived(contenuti.filter((c) => c.budget_ads == null && ['approvato', 'programmato', 'in_attesa'].includes(c.status)));
	const spesaMeta = $derived(campagne?.budget?.spesa?.meta?.valore ?? null);
	const tiktok = $derived(data.configurato ? data.tiktok : null);
	const PASSO = 10;
	const quotaPost = (c: Contenuto, p: string) => (Number(c.budget_ads) || 0) * ((c.budget_split?.[p as 'instagram'] ?? splitPredefinito(c.platforms)[p] ?? 0) / 100);
	// divisione per piattaforma: somma delle percentuali salvate sui contenuti con budget
	const perPiattaforma = $derived(PIATTAFORME.map((p) => ({
		...p,
		valore: conBudget.reduce((s, c) => s + ((Number(c.budget_ads) || 0) * ((c.budget_split?.[p.value] ?? splitPredefinito(c.platforms)[p.value] ?? 0) / 100)), 0)
	})));

	let mensileAperto = $state(false);
	let assegna = $state<Contenuto | null>(null);
	let split = $state<Record<string, number>>({});
	let importo = $state('');
	function apriAssegna(c: Contenuto) {
		assegna = c;
		importo = c.budget_ads != null ? String(c.budget_ads) : c.suggested_budget != null ? String(c.suggested_budget) : '';
		split = c.budget_split && Object.keys(c.budget_split).length ? { ...(c.budget_split as Record<string, number>) } : splitPredefinito(c.platforms);
	}
	const sommaSplit = $derived(Object.values(split).reduce((s, v) => s + (Number(v) || 0), 0));
	$effect(() => { if (form?.ok) { mensileAperto = false; assegna = null; } });
</script>

<svelte:head><title>Budget & ADV | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Budget & ADV</h1><p class="lead">Quanto si spende in sponsorizzate ogni mese, e su quali contenuti. Le sponsorizzazioni le crea PERIZ, sempre in pausa: niente parte senza un ok.</p></div>
	{#if b}<button type="button" class="btn btn--sm btn--yellow" onclick={() => (mensileAperto = true)}>Budget mensile</button>{/if}
</div>

{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito." />
{:else if !b}
	<div class="mk-err">{data.budget.ok ? '' : data.budget.errore}</div>
{:else}
	<div class="mk-stats">
		<Stat etichetta="Budget mensile" valore={mensile ? euro(mensile) : '—'} nota={mensile ? `Meta ${euro(quota('meta'))} · TikTok ${euro(quota('tiktok'))}${quota('google') ? ` · Google ${euro(quota('google'))}` : ''}` : 'non ancora impostato'} />
		<Stat etichetta="Assegnato ai contenuti" valore={euro(pianificato)} nota={mensile ? `${pct(pianificato, mensile)}% del mensile` : ''} />
		<Stat etichetta="Ancora da assegnare" valore={mensile ? euro(daPianificare) : '—'} />
		<Stat etichetta="Speso su Meta a {b.budget.mese}" valore={euro(spesaMeta, 2)} nota={campagne ? 'letto adesso dall\'account pubblicitario' : (data.campagne.ok ? (data.campagne.collegato ? '' : data.campagne.motivo) : data.campagne.errore)} />
		<Stat etichetta="Speso su TikTok a {b.budget.mese}" valore={tiktok?.ok ? euro(tiktok.spesaMese, 2) : '—'} nota={tiktok?.ok ? 'letto adesso da TikTok Ads' : (tiktok && !tiktok.ok ? tiktok.errore : '')} />
	</div>
	{#if mensile}<div class="mk-prog"><i style="width:{Math.min(100, pct(pianificato, mensile))}%"></i></div>{/if}
	{#if b.budget.totale != null}
		<p class="mk-nota">Tetto deciso con l'agenzia per tutto ({b.budget.mese}): <b>{euro(b.budget.totale)}</b>{#if b.budget.canali.google != null} · Google {euro(b.budget.canali.google)}{/if}. Le quote qui sotto non possono superarlo.</p>
	{/if}
	{#if b.budget.avviso}<p class="mk-nota">{b.budget.avviso}</p>{/if}

	<div class="mk-grid2">
		<div class="dcard">
			<h3>Divisione per piattaforma</h3>
			{#if pianificato}
				<div class="mk-lista">
					{#each perPiattaforma as p (p.value)}
						<div class="mk-riga"><span>{p.label}<small>{pct(p.valore, pianificato)}% del budget assegnato</small></span><b>{euro(Math.round(p.valore))}</b></div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Nessun budget assegnato ai contenuti: la divisione compare quando ne assegni uno.</p>
			{/if}
			{#if tiktok?.ok}<p class="mk-nota" style="margin-top:10px">TikTok Ads collegato: spesa del mese {euro(tiktok.spesaMese, 2)} · <a class="link" href="/dashboard/marketing/tiktok">campagne e budget →</a></p>{:else}<p class="mk-nota" style="margin-top:10px">TikTok Ads non è collegato: la quota si decide, la spesa non si legge. <a class="link" href="/dashboard/marketing/tiktok">Collegalo →</a></p>{/if}
			<p class="mk-nota"><a class="link" href="/dashboard/marketing/analytics">Google Analytics 4 →</a> per vedere cosa porta davvero traffico e ordini.</p>
		</div>
		<div class="dcard">
			<h3>Ultimi movimenti</h3>
			{#if b.movimenti.length}
				<div class="mk-lista">
					{#each b.movimenti as m (m.id)}
						<div class="mk-riga"><span>{m.title}<small>{m.detail ?? ''}</small></span><small>{quandoRelativo(m.created_at)}</small></div>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Ancora nessun movimento.</p>
			{/if}
		</div>
	</div>

	<div class="dcard">
		<h3>Contenuti senza budget ({senzaBudget.length})</h3>
		{#if senzaBudget.length}
			<div class="mk-lista">
				{#each senzaBudget as c (c.id)}
					<div class="mk-riga">
						<span>{c.title}<small><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span>{#if c.suggested_budget != null} · consigliato {euro(c.suggested_budget)}{/if}</small></span>
						<button class="btn btn--xs btn--yellow" type="button" onclick={() => apriAssegna(c)}>Assegna budget</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="mk-nota">Tutti i contenuti in coda hanno un budget, o non ce ne sono.</p>
		{/if}
	</div>

	{#if conBudget.length}
		<div class="dcard" style="padding:0;overflow-x:auto">
			<table class="dtable">
				<thead><tr><th>Contenuto</th><th>Stato</th><th>Budget</th><th>Obiettivo</th><th>Per piattaforma</th><th></th></tr></thead>
				<tbody>
					{#each conBudget as c (c.id)}
						{@const splitJson = JSON.stringify(c.budget_split && Object.keys(c.budget_split).length ? c.budget_split : splitPredefinito(c.platforms))}
						<tr>
							<td><b>{c.title}</b></td>
							<td><span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span></td>
							<td>
								<div style="display:flex;gap:4px;align-items:center">
									<form method="POST" action="?/passo" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="attuale" value={c.budget_ads ?? 0} /><input type="hidden" name="delta" value={-PASSO} /><input type="hidden" name="split" value={splitJson} /><input type="hidden" name="obiettivo" value={c.campaign_objective ?? 'traffico'} /><button class="ibtn" type="submit" title="−{PASSO} €">➖</button></form>
									<b style="min-width:60px;text-align:center">{euro(c.budget_ads)}</b>
									<form method="POST" action="?/passo" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="attuale" value={c.budget_ads ?? 0} /><input type="hidden" name="delta" value={PASSO} /><input type="hidden" name="split" value={splitJson} /><input type="hidden" name="obiettivo" value={c.campaign_objective ?? 'traffico'} /><button class="ibtn" type="submit" title="+{PASSO} €">➕</button></form>
								</div>
							</td>
							<td>{OBIETTIVI.find((o) => o.value === c.campaign_objective)?.label ?? '—'}</td>
							<td class="mk-nota">{#each Object.entries(c.budget_split && Object.keys(c.budget_split).length ? c.budget_split : splitPredefinito(c.platforms)) as [p, v] (p)}<div>{PIATTAFORMA_LABEL[p] ?? p} <b>{euro(Math.round(quotaPost(c, p)))}</b> <small>({v}%)</small></div>{/each}</td>
							<td class="row-actions">
								<button class="btn btn--xs btn--ghost" type="button" onclick={() => apriAssegna(c)}>Cambia divisione</button>
								<form method="POST" action="?/rimuovi" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Togliere il budget da “${c.title}”?`)) e.preventDefault(); }}><input type="hidden" name="id" value={c.id} /><button class="btn btn--xs btn--white" type="submit">Togli</button></form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if campagne && campagne.campagne.length}
		<div class="dcard">
			<h3>Campagne attive su Meta (ultimi 30 giorni)</h3>
			<div class="mk-lista">
				{#each campagne.campagne.slice(0, 6) as k (k.id)}
					<div class="mk-riga"><span>{k.nome}<small>{k.statoEtichetta} · {num(k.lead)} lead{#if k.costoPerLead != null} · {euro(k.costoPerLead, 2)} a lead{/if}</small></span><b>{euro(k.spesa, 2)}</b></div>
				{/each}
			</div>
			<a class="link" href="/dashboard/marketing/risultati?scheda=campagne" style="font-size:13px">Tutte le campagne →</a>
		</div>
	{/if}
{/if}

{#if mensileAperto && b}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Budget mensile</h3>
		<p class="mk-nota">Il tetto di spesa del mese per le sponsorizzate: superato questo totale non si spende più nulla fino al mese dopo.</p>
		<form method="POST" action="?/mensile" use:enhance class="dform dform--1">
			<div class="row2">
				<label>Meta (Instagram + Facebook) €<input type="number" name="meta" min="0" step="10" value={quota('meta')} /></label>
				<label>TikTok €<input type="number" name="tiktok" min="0" step="10" value={quota('tiktok')} /></label>
			</div>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (mensileAperto = false)}>Annulla</button><button class="btn btn--green" type="submit">Salva</button></div>
		</form>
	</div></div>
{/if}

{#if assegna}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Budget per “{assegna.title}”</h3>
		<form method="POST" action="?/assegna" use:enhance class="dform dform--1">
			<input type="hidden" name="id" value={assegna.id} />
			<label>Importo € <small style="font-weight:400">{#if mensile}(disponibile questo mese: {euro(daPianificare + (Number(assegna.budget_ads) || 0))}){/if}</small><input type="number" name="budget" min="0" step="5" bind:value={importo} placeholder="Vuoto = nessun budget" /></label>
			<label>Obiettivo della campagna<select name="obiettivo" value={assegna.campaign_objective ?? 'traffico'}>{#each OBIETTIVI as o (o.value)}<option value={o.value}>{o.label}</option>{/each}</select></label>
			<div>
				<div class="mk-nota" style="margin-bottom:6px">Divisione fra le piattaforme (deve fare 100%: adesso {sommaSplit}%)</div>
				{#each Object.keys(split) as p (p)}
					<div class="mk-split"><span>{PIATTAFORMA_LABEL[p] ?? p}</span><input type="number" name="split_{p}" min="0" max="100" bind:value={split[p]} />%</div>
				{/each}
			</div>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (assegna = null)}>Annulla</button><button class="btn btn--green" type="submit" disabled={importo !== '' && sommaSplit !== 100}>Salva</button></div>
		</form>
	</div></div>
{/if}
