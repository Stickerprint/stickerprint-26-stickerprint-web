<script lang="ts">
	import { COURIERS, dmy } from '$lib/dashboard/orders';
	let { data } = $props();
	const DOCS: Record<string, { vars: string[]; where: string; note: string }> = {
		GLS: { vars: ['GLS_SEDE', 'GLS_CODICE_CLIENTE', 'GLS_PASSWORD', 'GLS_CODICE_CONTRATTO'], where: 'Chiedi alla tua sede GLS l’attivazione del Web Service "Weblabels" (ilswebservice): ti danno sigla sede, codice cliente, password e codice contratto.', note: 'Genera spedizioni = AddParcel (numero GLS + etichetta PDF ufficiale) · Trasmetti = CloseWorkDay (conferma delle spedizioni del giorno).' },
		FedEx: { vars: ['FEDEX_CLIENT_ID', 'FEDEX_CLIENT_SECRET', 'FEDEX_ACCOUNT_NUMBER'], where: 'Su developer.fedex.com crea un progetto con le API Ship e Track: ottieni Client ID e Secret; il numero di account è quello del contratto FedEx. Facoltativi: FEDEX_SANDBOX=1 per i test, FEDEX_SERVICE (default FEDEX_REGIONAL_ECONOMY), FEDEX_PHONE.', note: 'Genera spedizioni = Ship API (tracking + etichetta 4×6 PDF ufficiale) · Trasmetti = manifest interno (per i servizi Express non serve chiusura giornaliera).' },
		TNT: { vars: ['TNT_COMPANY', 'TNT_PASSWORD', 'TNT_ACCOUNT'], where: 'Chiedi a TNT/FedEx Italia le credenziali ExpressConnect (utente, password, codice cliente). Facoltativi: TNT_SERVICE (default 48N), TNT_APPID.', note: 'Genera spedizioni = CREATE + BOOK + SHIP (numero consignment) con etichette interne 10×15 · Trasmetti = manifest interno.' }
	};
</script>

<svelte:head><title>Corrieri | Setup</title></svelte:head>

<div><h1>Corrieri</h1><p class="lead">Stato dei collegamenti API. Senza credenziali il flusso funziona lo stesso con etichette e manifest generati da noi; con le credenziali le spedizioni vengono create e trasmesse al corriere in automatico.</p></div>

<div class="grid3">
	{#each data.couriers as c (c.id)}
		{@const d = DOCS[c.id]}
		<div class="dcard">
			<h3 style="display:flex;align-items:center;gap:10px"><img src={COURIERS[c.id].logo} alt={c.id} style="height:32px" /> {c.id} <span class="pill {c.configured ? 'pill--on' : 'pill--off'}" style="margin-left:auto">{c.configured ? 'Collegato' : 'Non collegato'}</span></h3>
			<p class="small">{d.where}</p>
			<div class="h4">Variabili su Vercel</div>
			<ul class="small" style="margin:0;padding-left:18px">{#each d.vars as v (v)}<li><code>{v}</code>{#if c.missing.includes(v)} <span class="osub" style="color:#b3261e;display:inline">mancante</span>{:else} <span class="osub" style="color:#15803d;display:inline">ok</span>{/if}</li>{/each}</ul>
			<p class="note" style="margin-top:10px">{d.note}</p>
		</div>
	{/each}
</div>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Manifest</th><th>Corriere</th><th>Giorno</th><th>Spedizioni</th><th>Trasmesso</th><th></th></tr></thead>
		<tbody>
			{#each data.manifests as m (m.id)}
				<tr><td><b>{m.number}</b></td><td><img src={COURIERS[m.courier]?.logo} alt={m.courier} style="height:22px" /></td><td>{dmy(m.day)}</td><td>{m.count}</td><td>{new Date(m.transmitted_at).toLocaleString('it-IT')}</td><td><a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/manifest/{m.id}" target="_blank">⬇ Manifest</a></td></tr>
			{:else}
				<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nessun manifest ancora trasmesso.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
