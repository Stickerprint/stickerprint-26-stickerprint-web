<script lang="ts">
	import '$lib/styles/produzione.css';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import FaseCard from '$lib/components/produzione/FaseCard.svelte';
	import { enhance } from '$app/forms';
	import { DEPARTMENTS } from '$lib/production/types';
	import { RUOLO, type Ruolo } from '$lib/production/bobine';
	import { fmtMin, fmtWhen, fmtDay } from '$lib/production/format';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const mName = (id: string | null) => data.setup.machines.find((m) => m.id === id)?.name ?? null;
	const deps = Object.entries(DEPARTMENTS) as [string, { label: string; icon: string }][];
</script>

<svelte:head><title>{data.info.label} | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>{data.info.icon} {data.info.label}</h1><p class="lead">Prima le fasi in corso, poi quelle da fare nell’ordine in cui conviene farle.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="tabs" style="margin-bottom:18px">{#each deps as [k, d] (k)}<a class:is-active={k === data.stage} href="/dashboard/produzione/reparto/{k}">{d.icon} {d.label}</a>{/each}</div>

{#if data.stampa}
	<!-- STAMPA: le tre macchine affiancate, ognuna con i compiti di oggi raggruppati per plastifica -->
	<div class="mac3">
		{#each ['uv', 'resinati', 'laminati'] as ruolo (ruolo)}
			{@const m = data.stampa.macchine[ruolo as Ruolo]}
			{@const gruppi = data.stampa.gruppi.filter((b) => b.ruolo === ruolo)}
			{@const daFare = gruppi.filter((b) => b.pronta)}
			<section class="mac">
				<header class="mac__top mac__top--{ruolo}">
					<div><b>{m?.name ?? RUOLO[ruolo as Ruolo].label}</b><small>{RUOLO[ruolo as Ruolo].icon} {RUOLO[ruolo as Ruolo].cosa}</small></div>
					<span class="mac__n">{daFare.length} da fare</span>
				</header>
				{#if !gruppi.length}
					<p class="mac__empty">Niente da stampare su questa macchina.</p>
				{/if}
				{#each gruppi as b (b.id)}
					<article class="bob" class:is-ready={b.pronta} class:is-run={b.inCorso}>
						<div class="bob__top">
							<b>{b.protezione === 'nessuna' ? 'Senza plastifica' : b.protezione === 'rilievo' ? 'Rilievo' : `Plastifica ${b.protezione}`}</b>
							<span class="bob__mq">{b.lavori.length} {b.lavori.length === 1 ? 'lavoro' : 'lavori'} · {b.mq.toFixed(2)} m² · {fmtMin(b.minuti)}</span>
						</div>
						<p class="bob__why" class:is-wait={!b.pronta}>{b.pronta ? '▶' : '⏳'} {b.motivo}{#if b.avviaEntro} · entro {fmtDay(b.avviaEntro, now, data.setup.calendar)}{/if}</p>
						<ul class="bob__list">
							{#each b.lavori as l (l.faseId)}
								<li>
									<a class="oid" href="/dashboard/produzione/commessa/{l.jobId}">{l.numero}</a>
									<span>{l.cliente}</span>
									<small>{l.pezzi} pz · {l.mq.toFixed(2)} m² · {l.canale === 'manuale' ? '✍️ manuale' : '🛒 sito'}{#if l.consegna} · consegna {fmtDay(l.consegna, now, data.setup.calendar)}{/if}</small>
								</li>
							{/each}
						</ul>
						{#if b.pronta && !b.inCorso}
							<form method="POST" action="?/bobina" use:enhance>
								<input type="hidden" name="fasi" value={b.lavori.map((l) => l.faseId).join(',')} />
								<button class="btn btn--green btn--xs" type="submit">▶ Avvia questa stampata</button>
							</form>
						{:else if b.inCorso}
							<p class="bob__run">Stampa in corso</p>
						{/if}
					</article>
				{/each}
			</section>
		{/each}
	</div>
{/if}

{#if data.taglio}
	<!-- TAGLIO: i lavori divisi sui due plotter -->
	<div class="mac2">
		{#each data.taglio as coda, i (i)}
			<section class="mac">
				<header class="mac__top mac__top--taglio">
					<div><b>Graphtec {i + 1}</b><small>✂️ taglio e mezzo taglio</small></div>
					<span class="mac__n">{coda.length} {coda.length === 1 ? 'lavoro' : 'lavori'}</span>
				</header>
				<img class="mac__foto" src="/images/macchine-graphtec.jpg" alt="Plotter Graphtec {i + 1}" />
				{#each coda as x (x.phase.id)}
					<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={`Graphtec ${i + 1}`} {now} />
				{:else}
					<p class="mac__empty">Nessun lavoro in coda su questo plotter.</p>
				{/each}
			</section>
		{/each}
	</div>
{/if}

<section class="rep" class:rep--soft={!!data.stampa || !!data.taglio}>
	<h2 class="rep__title">▶ In corso <i>{data.running.length}</i></h2>
	{#each data.running as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{:else}<p class="rep__empty">Nessuna fase avviata in questo reparto.</p>{/each}
</section>
<section class="rep">
	<h2 class="rep__title">📌 Da fare <i>{data.ready.length}</i><small>{data.stampa ? 'elenco completo, fase per fase' : 'in ordine di urgenza'}</small></h2>
	{#each data.ready as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{:else}<p class="rep__empty">Niente di pronto: tutto fermo alle fasi precedenti.</p>{/each}
</section>
{#if data.blocked.length}
	<section class="rep"><h2 class="rep__title">⚠ Bloccate <i>{data.blocked.length}</i></h2>
	{#each data.blocked as x (x.phase.id)}<FaseCard phase={x.phase} job={x.row.job} group={x.row.group} machineName={mName(x.phase.machine_id)} {now} />{/each}</section>
{/if}
{#if data.waiting.length || data.incoming.length}
	<section class="rep rep--soft">
		<h2 class="rep__title">🔜 In arrivo <i>{data.waiting.length + data.incoming.length}</i><small>quando finiscono le fasi prima, o il tempo di attesa</small></h2>
		<ul class="rep__list">
			{#each data.waiting as x (x.phase.id)}<li><b>{x.row.job.order_number}</b> {x.row.group.customer} · {x.phase.label} · ⏳ pronta {fmtWhen(x.phase.planned_end_at, now, data.setup.calendar)}</li>{/each}
			{#each data.incoming as x (x.phase.id)}<li><b>{x.row.job.order_number}</b> {x.row.group.customer} · {x.phase.label} · {fmtMin(x.phase.minutes)} · previsto {fmtWhen(x.phase.planned_start_at, now, data.setup.calendar)}{#if mName(x.phase.machine_id)} · {mName(x.phase.machine_id)}{/if}</li>{/each}
		</ul>
	</section>
{/if}
