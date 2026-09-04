<script lang="ts">
	import Manca from '$lib/components/marketing/Manca.svelte';
	import Stat from '$lib/components/marketing/Stat.svelte';
	import Avvisi from '$lib/components/marketing/Avvisi.svelte';
	import { num, euro, segno, dataLunga, ora, quandoRelativo, statoContenuto, TIPO_ATTIVITA } from '$lib/marketing/formato';
	let { data } = $props();

	const social = $derived(data.configurato && data.social.ok && data.social.collegato ? data.social : null);
	const campagne = $derived(data.configurato && data.campagne.ok && data.campagne.collegato ? data.campagne : null);
	const budget = $derived(data.configurato && data.budget.ok ? data.budget.budget : null);
	const quotaMeta = $derived(budget?.canali.meta ?? null);
	const spesaMeta = $derived(campagne?.budget?.spesa?.meta?.valore ?? null);
	const conteggi = $derived(data.configurato && data.contenuti.ok ? data.contenuti.conteggi : null);
	const daApprovare = $derived(data.configurato && data.contenuti.ok ? data.contenuti.contenuti.filter((c) => c.status === 'in_attesa').slice(0, 4) : []);
	const motivoSocial = $derived(!data.configurato ? '' : !data.social.ok ? data.social.errore : !data.social.collegato ? data.social.motivo : '');
	const motivoCampagne = $derived(!data.configurato ? '' : !data.campagne.ok ? data.campagne.errore : !data.campagne.collegato ? data.campagne.motivo : '');
</script>

<svelte:head><title>Marketing | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Marketing</h1><p class="lead">La parte social di Stickerprint, curata da PERIZ Marketing: i numeri sono quelli veri di Meta, letti adesso.</p></div>
	{#if data.configurato && data.brand.ok}
		{#if data.brand.meta.collegato}<span class="pill pill--on">Meta collegato</span>{:else}<span class="pill pill--off">Meta non collegato</span>{/if}
	{/if}
</div>

{#if !data.configurato}
	<Manca titolo="Collegamento con PERIZ Marketing non configurato" testo="Manca PERIZ_API_KEY nelle variabili d'ambiente del sito (Vercel → Settings → Environment Variables). La chiave si crea dalla dashboard PERIZ, scheda Collegamenti del brand Stickerprint, e si vede in chiaro una volta sola." />
{:else}
	{#if !data.brand.ok}<div class="mk-err">{data.brand.errore}</div>{/if}

	<section>
		<h3 class="h4" style="margin-bottom:10px">Ultimi 30 giorni su Instagram e Facebook</h3>
		{#if social}
			<div class="mk-stats">
				<Stat etichetta="Copertura" valore={num(social.kpi.copertura)} delta={segno(social.kpi.variazioneCopertura)} />
				<Stat etichetta="Interazioni" valore={num(social.kpi.interazioni)} nota="like e commenti dei post veri" />
				<Stat etichetta="Follower" valore={num(social.kpi.follower)} nota={social.kpi.nuoviFollower != null ? `${social.kpi.nuoviFollower >= 0 ? '+' : ''}${num(social.kpi.nuoviFollower)} nuovi nel periodo` : ''} />
				<Stat etichetta="Spesa ADV del mese" valore={euro(spesaMeta, 2)} nota={quotaMeta != null ? `su ${euro(quotaMeta)} di quota Meta` : ''} />
			</div>
			<div style="height:10px"></div>
			<Avvisi avvisi={social.avvisi} />
		{:else}
			<Manca titolo="Numeri social non disponibili" testo={motivoSocial} />
		{/if}
	</section>

	<div class="mk-grid2">
		<div class="dcard">
			<h3>Contenuti</h3>
			{#if conteggi}
				<div class="mk-lista">
					<div class="mk-riga"><span>Da approvare</span><b>{conteggi.in_attesa}</b></div>
					<div class="mk-riga"><span>Modifiche richieste</span><b>{conteggi.modifiche_richieste}</b></div>
					<div class="mk-riga"><span>Da programmare</span><b>{conteggi.approvato}</b></div>
					<div class="mk-riga"><span>Programmati</span><b>{conteggi.programmato}</b></div>
					<div class="mk-riga"><span>Pubblicati</span><b>{conteggi.pubblicato}</b></div>
					{#if conteggi.errori}<div class="mk-riga" style="color:#b3261e"><span>Pubblicazioni non riuscite</span><b>{conteggi.errori}</b></div>{/if}
				</div>
				<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
					<a class="btn btn--sm btn--yellow" href="/dashboard/marketing/approvazioni">Approvazioni{#if conteggi.in_attesa} ({conteggi.in_attesa}){/if}</a>
					<a class="btn btn--sm btn--ghost" href="/dashboard/marketing/programmazione">Programmazione</a>
				</div>
			{:else if data.contenuti.ok === false}
				<div class="mk-err">{data.contenuti.errore}</div>
			{/if}
		</div>

		<div class="dcard">
			<h3>Budget di {budget?.mese ?? 'questo mese'}</h3>
			{#if budget}
				{#if budget.totale != null || quotaMeta != null}
					<div class="mk-lista">
						{#if budget.totale != null}<div class="mk-riga"><span>Tetto per tutto</span><b>{euro(budget.totale)}</b></div>{/if}
						<div class="mk-riga"><span>Quota Meta</span><b>{euro(quotaMeta)}</b></div>
						<div class="mk-riga"><span>Speso su Meta dal 1° del mese</span><b>{campagne ? euro(spesaMeta, 2) : '—'}</b></div>
						{#if budget.canali.tiktok != null}<div class="mk-riga"><span>Quota TikTok<small>TikTok Ads non è collegato: quota decisa, spesa non leggibile</small></span><b>{euro(budget.canali.tiktok)}</b></div>{/if}
					</div>
					{#if quotaMeta && spesaMeta != null}
						<div class="mk-prog" style="margin-top:10px"><i style="width:{Math.min(100, Math.round((spesaMeta / quotaMeta) * 100))}%"></i></div>
					{/if}
				{:else}
					<p class="mk-nota">Nessun budget mensile impostato. Si decide in <a class="link" href="/dashboard/marketing/budget">Budget & ADV</a>.</p>
				{/if}
				{#if !campagne && motivoCampagne}<p class="mk-nota" style="margin-top:10px">Spesa non leggibile: {motivoCampagne}</p>{/if}
				{#if budget.avviso}<p class="mk-nota">{budget.avviso}</p>{/if}
			{:else if data.budget.ok === false}
				<div class="mk-err">{data.budget.errore}</div>
			{/if}
		</div>
	</div>

	<div class="mk-grid2">
		<div class="dcard">
			<h3>In attesa della tua approvazione</h3>
			{#if daApprovare.length}
				<div class="mk-lista">
					{#each daApprovare as c (c.id)}
						<a class="mk-riga" href="/dashboard/marketing/approvazioni" style="text-decoration:none;color:inherit">
							<span>{c.title}<small>{c.content_type ?? ''}{#if c.respond_by} · risposta entro il {dataLunga(c.respond_by)}{/if}</small></span>
							<span class="mk-chip {statoContenuto(c.status).classe}">{statoContenuto(c.status).label}</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="mk-nota">Niente da approvare adesso.</p>
			{/if}
		</div>

		<div class="dcard">
			<h3>Prossimo appuntamento</h3>
			{#if data.prossimo}
				<p style="margin:0;font-size:15px"><b>{data.prossimo.title}</b></p>
				<p class="mk-nota">{TIPO_ATTIVITA[data.prossimo.type] ?? data.prossimo.type} · {dataLunga(data.prossimo.date)}{#if data.prossimo.time} alle {ora(data.prossimo.time)}{/if}</p>
				{#if data.prossimo.notes}<p class="mk-nota">{data.prossimo.notes}</p>{/if}
			{:else}
				<p class="mk-nota">Nessun appuntamento fissato. <a class="link" href="/dashboard/marketing/appuntamenti">Chiedine uno</a>.</p>
			{/if}
			<h3 style="margin-top:18px">Ultime notifiche</h3>
			{#if data.notifiche.ok && data.notifiche.notifiche.length}
				<div class="mk-lista">
					{#each data.notifiche.notifiche.slice(0, 4) as n (n.id)}
						<div class="mk-riga" class:non-letta={!n.letta_at}><span>{n.titolo}<small>{n.testo ?? ''}</small></span><small>{quandoRelativo(n.created_at)}</small></div>
					{/each}
				</div>
				<a class="link" href="/dashboard/marketing/notifiche" style="font-size:13px">Tutte le notifiche →</a>
			{:else}
				<p class="mk-nota">Nessuna notifica.</p>
			{/if}
		</div>
	</div>
{/if}
