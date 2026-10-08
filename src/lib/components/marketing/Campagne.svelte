<script lang="ts">
	/** Tabella delle campagne di un canale: numeri, verdetto delle regole, budget modificabile, pausa/riattiva. */
	import { enhance } from '$app/forms';
	import { num, euro } from '$lib/marketing/formato';
	import type { Campagna } from '$lib/marketing/ads-tipi';
	import { VERDETTO, type Giudizio } from '$lib/marketing/analisi';

	let { campagne, giudizi, puoAgire, giorni, piattaforme = false }: { campagne: Campagna[]; giudizi: Giudizio[]; puoAgire: boolean; giorni: number; piattaforme?: boolean } = $props();
	const giudizio = (c: Campagna) => giudizi.find((g) => g.id === c.id);
	let edit = $state<Record<string, number>>({});
	let aperta = $state<string | null>(null);
	const STEP = 5;
	const r1 = (v: number) => Math.round(v * 10) / 10;
	const ritorno = (c: Campagna) => (c.spesa > 0 && c.valore != null && c.valore > 0 ? c.valore / c.spesa : null);
	const PIATT: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads', altro: 'Altro' };
</script>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable mk-tcamp">
		<thead><tr><th>Campagna</th><th>Verdetto</th><th>Spesa {giorni} gg</th><th>Clic</th><th>Ordini</th><th>Ritorno</th><th>Budget</th>{#if puoAgire}<th></th>{/if}</tr></thead>
		<tbody>
			{#each campagne as c (c.id)}
				{@const g = giudizio(c)}
				{@const cur = edit[c.id] ?? c.budgetGiorno ?? 0}
				{@const r = ritorno(c)}
				<tr class:mk-riga-pausa={c.stato !== 'attiva'}>
					<td>
						<b>{c.nome}</b>
						<div class="osub">{c.obiettivo}{#if c.stato !== 'attiva'} · <span class="mk-chip mk-chip--gray" style="font-size:10px">{c.stato === 'in_pausa' ? 'in pausa' : c.statoOriginale.toLowerCase()}</span>{/if}</div>
						{#if piattaforme && c.piattaforme && Object.keys(c.piattaforme).length > 1}
							<div class="osub">{#each Object.entries(c.piattaforme) as [p, x] (p)}<span class="mk-piatt">{PIATT[p] ?? p}: {euro(x.spesa)}{x.conversioni ? ` · ${num(x.conversioni)} ord.` : ''}</span>{/each}</div>
						{/if}
					</td>
					<td style="max-width:260px">
						{#if g}
							<button type="button" class="mk-vbtn" onclick={() => (aperta = aperta === c.id ? null : c.id)} title="Perché">
								<span class="mk-chip {VERDETTO[g.verdetto].chip}">{VERDETTO[g.verdetto].etichetta}</span>
							</button>
							{#if aperta === c.id}<div class="mk-nota" style="margin-top:6px">{g.motivo}</div>{/if}
						{/if}
					</td>
					<td><b>{euro(c.spesa, 2)}</b>{#if c.clic}<div class="osub">{euro(c.spesa / c.clic, 2)} a clic</div>{/if}</td>
					<td>{num(c.clic)}{#if c.impressioni}<div class="osub">CTR {r1((c.clic / c.impressioni) * 100).toLocaleString('it-IT')}%</div>{/if}</td>
					<td>{num(c.conversioni)}{#if c.conversioni}<div class="osub">{euro(c.spesa / c.conversioni, 2)} l'uno</div>{/if}</td>
					<td>{#if r != null}<b>{r.toFixed(1)}×</b><div class="osub">{euro(c.valore)} di ordini</div>{:else if g?.roas != null}<span>{g.roas.toFixed(1)}×</span><div class="osub">stimato</div>{:else}—{/if}</td>
					<td>
						{#if c.budgetGiorno == null}
							<span class="osub">{c.budgetTotale != null ? `${euro(c.budgetTotale)} totale` : 'sui gruppi di inserzioni'}</span>
						{:else if puoAgire && c.budgetModificabile}
							<form method="POST" action="?/budget" use:enhance style="display:flex;gap:4px;align-items:center">
								<input type="hidden" name="id" value={c.id} />
								<button type="button" class="ibtn" title="−{STEP} €" onclick={() => (edit[c.id] = Math.max(0, cur - STEP))}>➖</button>
								<input type="number" name="budget" min="0" step="1" class="sel-sm" style="width:80px" value={cur} oninput={(e) => (edit[c.id] = Number((e.currentTarget as HTMLInputElement).value))} />
								<button type="button" class="ibtn" title="+{STEP} €" onclick={() => (edit[c.id] = cur + STEP)}>➕</button>
								<span class="osub">€/g</span>
								<button class="btn btn--ghost btn--xs" type="submit" disabled={(edit[c.id] ?? c.budgetGiorno) === c.budgetGiorno}>Salva</button>
							</form>
							{#if g?.budgetProposto != null && g.budgetProposto !== c.budgetGiorno}<div class="osub">consigliato {euro(g.budgetProposto)}/g <button type="button" class="mk-link" onclick={() => (edit[c.id] = g.budgetProposto ?? 0)}>usa</button></div>{/if}
						{:else}
							{euro(c.budgetGiorno)}/giorno{#if !c.budgetModificabile}<div class="osub">budget condiviso</div>{/if}
						{/if}
					</td>
					{#if puoAgire}
						<td style="white-space:nowrap">
							{#if c.stato === 'attiva' || c.stato === 'in_pausa'}
								<form method="POST" action="?/stato" use:enhance style="display:inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="on" value={c.stato === 'attiva' ? '0' : '1'} /><button class="btn btn--xs {c.stato === 'attiva' ? 'btn--white' : 'btn--green'}" type="submit">{c.stato === 'attiva' ? '⏸ Pausa' : '▶ Riattiva'}</button></form>
							{/if}
						</td>
					{/if}
				</tr>
			{:else}
				<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:30px">Nessuna campagna sull'account.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
