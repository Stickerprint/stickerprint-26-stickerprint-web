<script lang="ts">
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Kpi from '$lib/components/marketing/Kpi.svelte';
	import Giorni from '$lib/components/marketing/Giorni.svelte';
	import Consigli from '$lib/components/marketing/Consigli.svelte';
	import Campagne from '$lib/components/marketing/Campagne.svelte';
	import { num, euro } from '$lib/marketing/formato';
	import { NOME_CANALE, cpa, roas } from '$lib/marketing/ads-tipi';
	let { data, form } = $props();
	const PERIODI = [7, 14, 30, 90];
	const d = $derived(data.stato.dati);
	const COME: Record<string, string> = {
		meta: 'Business Manager di Meta → Impostazioni → Utenti → Utenti di sistema: crea un utente di sistema con ruolo Amministratore, assegnagli l\'account pubblicitario, genera un token con i permessi ads_read e ads_management (senza scadenza). L\'ID dell\'account è il numero in Gestione inserzioni (in alto a sinistra, "act_…"). Le due variabili sono META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID.',
		google: 'Serve l\'accesso all\'API di Google Ads: dall\'account amministratore (MCC) → Strumenti → Centro API si chiede il token sviluppatore (l\'accesso Base arriva in qualche giorno); su Google Cloud si crea un\'app OAuth (ID cliente e segreto) e con quell\'app si dà il consenso una volta per ottenere il refresh token. Il numero cliente è quello in alto a destra in Google Ads, senza trattini.',
		tiktok: 'TikTok for Business → Developer (business-api.tiktok.com) → crea un\'app Marketing API, autorizzala sull\'account pubblicitario e copia l\'Access Token (senza scadenza) e l\'Advertiser ID.'
	};
	const PIATT: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads', altro: 'Altro' };
	const mese = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
	const piattaforme = $derived(d?.piattaforme ? Object.entries(d.piattaforme).sort((x, y) => y[1].spesa - x[1].spesa) : []);
</script>

<svelte:head><title>{NOME_CANALE[data.canale]} | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>{NOME_CANALE[data.canale]}</h1><p class="lead">Campagne e risultati dell'account, letti adesso. {#if data.puoAgire}Da qui alzi o abbassi il budget di ogni campagna e la metti in pausa.{/if}</p></div>
	<div style="display:grid;gap:6px;justify-items:end">
		<div class="mk-periodo">{#each PERIODI as p (p)}<a href="?giorni={p}" class:is-active={data.giorni === p}>{p} giorni</a>{/each}</div>
		{#if d}<span class="mk-nota">Dal {d.periodo.da.split('-').reverse().join('/')} al {d.periodo.a.split('-').reverse().join('/')} · aggiornato {new Date(d.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>{/if}
	</div>
</div>
{#if form?.errore}<div class="mk-err">{form.errore}</div>{/if}
{#if form?.ok}<div class="mk-ok">{form.messaggio}</div>{/if}

{#if !data.stato.configurato}
	<Manca titolo="{NOME_CANALE[data.canale]} non collegato" testo="Su Vercel (Settings → Environment Variables) mancano: {data.stato.mancanti.join(', ')}. {COME[data.canale]} Salva le chiavi in un file e le carico io da riga di comando senza leggerle." />
{:else if !d || !data.analisi}
	<div class="mk-err">{NOME_CANALE[data.canale]} non risponde: {data.stato.errore}</div>
{:else}
	<Kpi kpi={d.kpi} prima={d.prima} spesaMese={d.spesaMese} valoreStimato={data.analisi.kpi.valoreStimato} />

	{#if piattaforme.length}
		<div class="dcard">
			<h3>Instagram e Facebook</h3>
			<p class="mk-nota" style="margin:0 0 10px">Le campagne Meta girano su entrambe: qui la spesa e i risultati divisi per piattaforma, come li riporta Meta.</p>
			<div class="mk-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
				{#each piattaforme as [p, x] (p)}
					<div class="mk-stat" style="padding:10px 0">
						<small>{PIATT[p] ?? p}</small>
						<b style="font-size:22px">{euro(x.spesa)}</b>
						<span class="mk-delta">{num(x.clic)} clic · {num(x.conversioni)} ordini{cpa(x) != null ? ` a ${euro(cpa(x), 2)}` : ''}{roas(x) != null ? ` · ritorno ${roas(x)!.toFixed(1)}×` : ''}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<Consigli report={data.report} assistente={data.assistente} />

	<h3 class="h4" style="margin:4px 0 -6px">Campagne</h3>
	<Campagne campagne={d.campagne} giudizi={data.analisi.giudizi} puoAgire={data.puoAgire} giorni={data.giorni} piattaforme={data.canale === 'meta'} />

	<Giorni giorni={d.giorni} />

	{#if data.mesi.length}
		<div class="dcard" style="padding:0;overflow-x:auto">
			<table class="dtable mk-mesi">
				<thead><tr><th>Mese</th><th>Spesa</th><th>Clic</th><th>Ordini</th><th>Costo per ordine</th><th>Ritorno</th></tr></thead>
				<tbody>{#each data.mesi as m (m.mese)}<tr><td><b style="text-transform:capitalize">{mese(m.mese)}</b></td><td>{euro(m.spesa)}</td><td>{num(m.clic)}</td><td>{num(m.conversioni)}</td><td>{m.conversioni ? euro(m.spesa / m.conversioni, 2) : '—'}</td><td>{m.valore != null && m.spesa ? `${(m.valore / m.spesa).toFixed(1)}×` : '—'}</td></tr>{/each}</tbody>
			</table>
			<p class="mk-nota" style="padding:10px 16px">Storico salvato ogni notte dal sito: parte dal giorno in cui il canale è stato collegato.</p>
		</div>
	{/if}
{/if}
