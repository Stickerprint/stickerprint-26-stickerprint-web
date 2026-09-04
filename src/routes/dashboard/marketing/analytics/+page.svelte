<script lang="ts">
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Stat from '$lib/components/marketing/Stat.svelte';
	import { num, euro, segno } from '$lib/marketing/formato';
	let { data } = $props();
	const ga = $derived(data.configurato ? data.ga : null);
	const delta = (cur: number, prev: number) => (prev ? segno(Math.round(((cur - prev) / prev) * 100)) + '%' : '');
	const maxG = $derived(ga ? Math.max(1, ...ga.giorni.map((g) => g.sessioni)) : 1);
	const durata = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
	const CANALE: Record<string, string> = { 'Organic Search': 'Ricerca organica', 'Paid Search': 'Ricerca a pagamento', 'Organic Social': 'Social organico', 'Paid Social': 'Social a pagamento', Direct: 'Diretto', Referral: 'Referral', Email: 'Email', Unassigned: 'Non assegnato', 'Cross-network': 'Cross-network', Display: 'Display', 'Organic Video': 'Video organico', 'Organic Shopping': 'Shopping organico' };
	const DISP: Record<string, string> = { desktop: '💻 Computer', mobile: '📱 Telefono', tablet: '📱 Tablet' };
</script>

<svelte:head><title>Google Analytics | Marketing</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Google Analytics 4</h1><p class="lead">Traffico e conversioni di stickerprint.it letti adesso da Google Analytics: chi arriva, da dove, cosa guarda e quanto compra.</p></div>
	<div class="mk-sub">{#each [7, 30, 90] as g (g)}<a href="?giorni={g}" class:is-active={data.days === g}>{g} giorni</a>{/each}</div>
</div>

{#if !data.configurato}
	<Manca titolo="Google Analytics 4 non collegato" testo="Su Vercel mancano: {data.mancanti.join(', ')}. Crea un account di servizio su Google Cloud (API Google Analytics Data), aggiungilo come Lettore nella proprietà GA4 e incolla email e chiave privata; GA4_PROPERTY_ID è il numero della proprietà (Amministrazione → Impostazioni proprietà)." />
{:else if !ga}
	<div class="mk-err">Google Analytics non risponde: {data.errore}</div>
{:else}
	<div class="mk-stats" style="grid-template-columns:repeat(5,1fr)">
		<Stat etichetta="Utenti attivi adesso" valore={ga.attivi == null ? '—' : num(ga.attivi)} nota="in tempo reale" />
		<Stat etichetta="Sessioni" valore={num(ga.kpi.sessioni)} delta={delta(ga.kpi.sessioni, ga.prima.sessioni)} />
		<Stat etichetta="Utenti" valore={num(ga.kpi.utenti)} delta={delta(ga.kpi.utenti, ga.prima.utenti)} />
		<Stat etichetta="Conversioni" valore={num(ga.kpi.conversioni)} delta={delta(ga.kpi.conversioni, ga.prima.conversioni)} />
		<Stat etichetta="Ricavi (acquisti)" valore={euro(ga.kpi.ricavi, 2)} delta={delta(ga.kpi.ricavi, ga.prima.ricavi)} />
	</div>
	<div class="mk-stats" style="grid-template-columns:repeat(4,1fr)">
		<Stat etichetta="Nuovi utenti" valore={num(ga.kpi.nuoviUtenti)} nota="{Math.round((ga.kpi.nuoviUtenti / Math.max(1, ga.kpi.utenti)) * 100)}% degli utenti" />
		<Stat etichetta="Pagine viste" valore={num(ga.kpi.pagine)} nota="{(ga.kpi.pagine / Math.max(1, ga.kpi.sessioni)).toFixed(1)} a sessione" />
		<Stat etichetta="Durata media sessione" valore={durata(ga.kpi.durata)} nota="minuti:secondi" />
		<Stat etichetta="Tasso di coinvolgimento" valore="{Math.round(ga.kpi.engagement * 100)}%" nota="sessioni con interazione" />
	</div>

	<div class="dcard">
		<h3>Sessioni giorno per giorno</h3>
		<div class="mk-bars">
			{#each ga.giorni as g (g.giorno)}
				<div class="mk-bar" title="{g.giorno}: {g.sessioni} sessioni · {g.utenti} utenti"><i style="height:{Math.round((g.sessioni / maxG) * 100)}%"></i>{#if ga.giorni.length <= 31}<b>{g.giorno.slice(6)}</b>{/if}</div>
			{/each}
		</div>
	</div>

	<div class="mk-grid3">
		<div class="dcard">
			<h3>Da dove arrivano</h3>
			<div class="mk-lista">{#each ga.canali as c (c.nome)}<div class="mk-riga"><span>{CANALE[c.nome] ?? c.nome}<small>{num(c.conversioni)} conversioni</small></span><b>{num(c.sessioni)}</b></div>{/each}</div>
		</div>
		<div class="dcard">
			<h3>Sorgenti principali</h3>
			<div class="mk-lista">{#each ga.sorgenti as s (s.nome)}<div class="mk-riga"><span>{s.nome}</span><b>{num(s.sessioni)}</b></div>{/each}</div>
		</div>
		<div class="dcard">
			<h3>Dispositivi</h3>
			<div class="mk-lista">{#each ga.dispositivi as d (d.nome)}<div class="mk-riga"><span>{DISP[d.nome] ?? d.nome}<small>{Math.round((d.sessioni / Math.max(1, ga.kpi.sessioni)) * 100)}%</small></span><b>{num(d.sessioni)}</b></div>{/each}</div>
		</div>
	</div>
	<div class="dcard">
		<h3>Pagine più viste</h3>
		<div class="mk-lista">{#each ga.pagine as p (p.path)}<div class="mk-riga"><span><a class="link" href="https://stickerprint.it{p.path}" target="_blank" rel="noopener">{p.path}</a></span><b>{num(p.viste)}</b></div>{/each}</div>
	</div>
	<p class="mk-nota">Proprietà {ga.property} · periodo {ga.periodo.da} → {ga.periodo.a} · aggiornato {new Date(ga.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
{/if}
