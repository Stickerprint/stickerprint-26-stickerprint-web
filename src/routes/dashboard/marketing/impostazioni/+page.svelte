<script lang="ts">
	import { enhance } from '$app/forms';
	import { euro } from '$lib/marketing/formato';
	import { CANALI, NOME_CANALE } from '$lib/marketing/ads-tipi';
	let { data, form } = $props();
	const o = $derived(data.obiettivi);
</script>

<svelte:head><title>Impostazioni marketing | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar"><div><h1>Marketing · Impostazioni</h1><p class="lead">Gli obiettivi con cui la dashboard giudica le campagne e propone il budget. Valgono per tutti i canali.</p></div></div>
{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

<form method="POST" action="?/salva" use:enhance class="mk-grid2" style="align-items:start">
	<div class="dcard">
		<h3>Obiettivi</h3>
		<div class="dform">
			<label>Valore medio di un ordine (€)<input type="number" step="0.5" min="1" name="valore_ordine" value={o.valoreOrdine} required /><small class="mk-nota">Serve dove il canale non misura il valore degli ordini (TikTok, o Meta senza il valore nel pixel): ordini × questo valore = ritorno stimato.</small></label>
			<label>Ritorno minimo (ROAS)<input type="number" step="0.1" min="0.5" name="roas_target" value={o.roasTarget} required /><small class="mk-nota">Quanti euro di ordini per ogni euro di pubblicità perché una campagna valga la pena. Con i margini della stampa digitale 3× è un buon punto di partenza.</small></label>
			<label>Costo massimo per ordine (€)<input type="number" step="0.5" min="0" name="cpa_target" value={o.cpaTarget ?? ''} placeholder="calcolato: {euro(data.cpaCalcolato, 2)}" /><small class="mk-nota">Lascia vuoto per usare valore medio ÷ ritorno minimo.</small></label>
		</div>
	</div>
	<div class="dcard">
		<h3>Budget</h3>
		<div class="dform">
			<label>Tetto mensile, tutti i canali (€)<input type="number" step="10" min="0" name="budget_mese" value={o.budgetMese ?? ''} placeholder="nessun tetto" /><small class="mk-nota">Se c'è, i consigli lo dividono tra i canali in base a quanto rende ognuno. Se manca, propongono la somma di quello che conviene a ogni canale.</small></label>
			{#each CANALI as c (c)}
				<label>Quota {NOME_CANALE[c]} (€/mese)<input type="number" step="10" min="0" name="quota_{c}" value={o.quote[c] ?? ''} placeholder="—" />{#if !data.collegati.includes(c)}<small class="mk-nota">Canale non ancora collegato.</small>{/if}</label>
			{/each}
			<label>Note per l'assistente<textarea name="note" rows="3" placeholder="Es. a novembre spingiamo le etichette per i regali; TikTok è un esperimento, non superare 150 €">{o.note}</textarea><small class="mk-nota">Le legge quando scrive i consigli.{#if !data.assistente} (Assistente spento: manca ANTHROPIC_API_KEY.){/if}</small></label>
		</div>
		<div style="margin-top:12px"><button class="btn btn--yellow" type="submit">Salva</button></div>
	</div>
</form>
