<script lang="ts">
	/**
	 * Il riquadro dei consigli: i verdetti delle regole (campagne da spingere, da spegnere, da continuare),
	 * l'idea di budget e, se c'è, il testo scritto dall'assistente. Vale sia per un canale che per tutti.
	 */
	import { enhance } from '$app/forms';
	import { euro } from '$lib/marketing/formato';
	import { NOME_BREVE } from '$lib/marketing/ads-tipi';
	import { VERDETTO, type AnalisiCanale, type AnalisiTotale, type Giudizio } from '$lib/marketing/analisi';
	import type { Report } from '$lib/server/ads/consigli';

	let { report, assistente, compatto = false, mostraCanale = false }: { report: Report | null; assistente: boolean; compatto?: boolean; mostraCanale?: boolean } = $props();
	let inCorso = $state(false);
	const a = $derived(report?.analisi ?? null);
	const totale = $derived(a && 'canali' in a ? (a as AnalisiTotale) : null);
	const canale = $derived(a && !('canali' in a) ? (a as AnalisiCanale) : null);
	const migliori = $derived<Giudizio[]>(totale?.migliori ?? canale?.migliori ?? []);
	const daSpegnere = $derived<Giudizio[]>(totale?.daSpegnere ?? canale?.daSpegnere ?? []);
	const daContinuare = $derived<Giudizio[]>(totale?.daContinuare ?? canale?.daContinuare ?? []);
	const daOsservare = $derived<Giudizio[]>(canale?.daOsservare ?? totale?.canali.flatMap((c) => c.daOsservare) ?? []);

	/* il testo dell'assistente: "## " apre una sezione, "- " una voce dell'elenco */
	type Blocco = { tipo: 'h' | 'p' | 'ul'; testo?: string; voci?: string[] };
	const blocchi = $derived.by<Blocco[]>(() => {
		const out: Blocco[] = [];
		for (const riga of (report?.testo ?? '').split('\n')) {
			const t = riga.trim();
			if (!t) continue;
			if (t.startsWith('## ')) out.push({ tipo: 'h', testo: t.slice(3) });
			else if (/^[-•*] /.test(t)) { const u = out[out.length - 1]; if (u?.tipo === 'ul') u.voci!.push(t.slice(2)); else out.push({ tipo: 'ul', voci: [t.slice(2)] }); }
			else out.push({ tipo: 'p', testo: t.replace(/\*\*/g, '') });
		}
		return out;
	});
	const quando = $derived(report ? new Date(report.generatoIl).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
	const nome = (g: Giudizio) => (mostraCanale ? `${NOME_BREVE[g.canale]} · ${g.nome}` : g.nome);
</script>

<div class="dcard mk-consigli">
	<div class="mk-consigli__testa">
		<div>
			<h3>I consigli</h3>
			{#if report}<div class="mk-nota">Dal {report.periodo.da.split('-').reverse().join('/')} al {report.periodo.a.split('-').reverse().join('/')} · aggiornati il {quando}{#if !report.testo} · solo regole, senza il testo dell'assistente{/if}</div>
			{:else}<div class="mk-nota">Ancora nessun report: premi "Aggiorna i consigli" per il primo.</div>{/if}
		</div>
		<form method="POST" action="?/consigli" use:enhance={() => { inCorso = true; return async ({ update }) => { inCorso = false; await update(); }; }}>
			<button class="btn btn--sm btn--yellow" type="submit" disabled={inCorso}>{inCorso ? 'Sto leggendo le campagne…' : 'Aggiorna i consigli'}</button>
		</form>
	</div>
	{#if !assistente}<div class="mk-avvisi"><b>Assistente spento</b>Manca ANTHROPIC_API_KEY su Vercel: i verdetti qui sotto escono lo stesso dalle regole, ma senza il testo discorsivo.</div>{/if}

	{#if a}
		<div class="mk-verdetti">
			<div class="mk-verdetto">
				<h4><span class="mk-chip mk-chip--green">Rendono meglio</span></h4>
				{#each migliori as g (g.canale + g.id)}<div class="mk-vriga"><b>{nome(g)}</b><small>{g.roas != null ? `${g.roas.toFixed(1)}× · ` : ''}{g.conversioni} ordini · {euro(g.spesa)}{g.valoreStimato ? ' · valore stimato' : ''}</small></div>{:else}<div class="mk-nota">Nessuna campagna con ordini nel periodo.</div>{/each}
			</div>
			<div class="mk-verdetto">
				<h4><span class="mk-chip mk-chip--pink">Da spegnere</span></h4>
				{#each daSpegnere as g (g.canale + g.id)}<div class="mk-vriga"><b>{nome(g)}</b><small>{g.motivo}</small></div>{:else}<div class="mk-nota">Niente da spegnere.</div>{/each}
			</div>
			<div class="mk-verdetto">
				<h4><span class="mk-chip mk-chip--blue">Da continuare</span></h4>
				{#each daContinuare as g (g.canale + g.id)}<div class="mk-vriga"><b>{nome(g)} <span class="mk-chip {VERDETTO[g.verdetto].chip}" style="font-size:10px">{VERDETTO[g.verdetto].etichetta}</span></b><small>{g.motivo}</small></div>{:else}<div class="mk-nota">Nessuna campagna in linea con l'obiettivo.</div>{/each}
			</div>
			{#if !compatto && daOsservare.length}
				<div class="mk-verdetto">
					<h4><span class="mk-chip mk-chip--orange">Da osservare</span></h4>
					{#each daOsservare as g (g.canale + g.id)}<div class="mk-vriga"><b>{nome(g)}</b><small>{g.motivo}</small></div>{/each}
				</div>
			{/if}
		</div>

		<div class="mk-budget">
			<h4>Idea di budget</h4>
			{#if totale}
				<table class="dtable mk-tbudget">
					<thead><tr><th>Canale</th><th>Spesa nel periodo</th><th>Budget oggi</th><th>Consigliato</th><th>Quota decisa</th></tr></thead>
					<tbody>
						{#each totale.budget.righe as r (r.canale)}
							<tr><td><b>{NOME_BREVE[r.canale]}</b></td><td>{euro(r.spesaPeriodo)} <small class="osub">({euro(r.spesaGiorno, 1)}/giorno)</small></td><td>{euro(r.budgetGiorno, 1)}/giorno</td><td><b>{euro(r.propostoMese)}/mese</b> <small class="osub">({euro(r.propostoGiorno, 1)}/giorno)</small></td><td>{r.quota != null ? euro(r.quota) : '—'}</td></tr>
						{/each}
						<tr><td><b>Totale</b></td><td></td><td></td><td><b>{euro(totale.budget.totaleMese)}/mese</b></td><td>{totale.budget.tetto != null ? euro(totale.budget.tetto) : 'nessun tetto'}</td></tr>
					</tbody>
				</table>
				<p class="mk-nota">{totale.budget.motivo}</p>
			{:else if canale}
				<div class="mk-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
					<div class="mk-stat" style="padding:10px 0"><small>Spesa nel periodo</small><b style="font-size:20px">{euro(canale.budget.spesaPeriodo)}</b><span class="mk-delta">{euro(canale.budget.spesaGiorno, 1)} al giorno</span></div>
					<div class="mk-stat" style="padding:10px 0"><small>Budget impostato oggi</small><b style="font-size:20px">{euro(canale.budget.budgetGiorno, 1)}/g</b><span class="mk-delta">circa {euro(canale.budget.budgetGiorno * 30.4)} al mese</span></div>
					<div class="mk-stat" style="padding:10px 0"><small>Consigliato</small><b style="font-size:20px">{euro(canale.budget.propostoMese)}/mese</b><span class="mk-delta">{euro(canale.budget.propostoGiorno, 1)} al giorno</span></div>
					{#if canale.budget.quota != null}<div class="mk-stat" style="padding:10px 0"><small>Quota decisa</small><b style="font-size:20px">{euro(canale.budget.quota)}</b><span class="mk-delta">in Impostazioni</span></div>{/if}
				</div>
				<p class="mk-nota">{canale.budget.motivo}</p>
			{/if}
		</div>

		{#if blocchi.length}
			<div class="mk-testo">
				{#each blocchi as b, i (i)}
					{#if b.tipo === 'h'}<h4>{b.testo}</h4>{:else if b.tipo === 'ul'}<ul>{#each b.voci ?? [] as v, j (j)}<li>{v}</li>{/each}</ul>{:else}<p>{b.testo}</p>{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>
