<script lang="ts">
	import '$lib/styles/produzione.css';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import FaseCard from '$lib/components/produzione/FaseCard.svelte';
	import { enhance } from '$app/forms';
	import { DEPARTMENTS } from '$lib/production/types';
	import { RUOLO, etichettaProtezione, targhettaProtezione, iconaProdotto, type Ruolo } from '$lib/production/bobine';
	import { fmtMin, fmtWhen, fmtDay } from '$lib/production/format';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const mName = (id: string | null) => data.setup.machines.find((m) => m.id === id)?.name ?? null;
	const deps = Object.entries(DEPARTMENTS) as [string, { label: string; icon: string }][];
</script>

{#snippet rigaLavoro(l: { faseId: string; jobId: string; numero: string; cliente: string; prodotto: string; protezione: string; pezzi: number; mq: number; canale: string; consegna: string | null; thumb: string | null })}
	{@const t = targhettaProtezione(l.protezione)}
	<li class="lav">
		{#if l.thumb}<img class="lav__img" src={l.thumb} alt="" loading="lazy" />{:else}<span class="lav__img lav__img--no">{iconaProdotto(l.prodotto)}</span>{/if}
		<div class="lav__txt">
			<div class="lav__top">
				<a class="oid" href="/dashboard/produzione/commessa/{l.jobId}"><span class="pico" title={l.prodotto.replace(/[-_]/g, ' ')}>{iconaProdotto(l.prodotto)}</span> {l.numero}</a>
				<span class="lav__cli">{l.cliente}</span>
			</div>
			<div class="lav__tags">
				<span class="tag2" style="background:{t.bg};color:{t.fg}">{t.testo}</span>
				{#if l.consegna}<span class="tag2" style="background:#fdba74;color:#4a2004">🚚 {fmtDay(l.consegna, now, data.setup.calendar)}</span>{/if}
				<span class="tag2 tag2--soft">{l.pezzi} pz</span>
				{#if l.mq > 0}<span class="tag2 tag2--soft">{l.mq.toFixed(2)} m²</span>{/if}
				<span class="tag2 tag2--soft">{l.canale === 'manuale' ? '✍️ manuale' : '🛒 sito'}</span>
			</div>
		</div>
	</li>
{/snippet}

<svelte:head><title>{data.info.label} | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>{data.info.icon} {data.info.label}</h1><p class="lead">Prima le fasi in corso, poi quelle da fare nell’ordine in cui conviene farle.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="tabs" style="margin-bottom:18px">{#each deps as [k, d] (k)}<a class:is-active={k === data.stage} href="/dashboard/produzione/reparto/{k}">{d.icon} {d.label}</a>{/each}</div>

{#if data.stampa && (data.stampa.vecchi > 0 || data.conVecchi)}
	<p class="rep__vecchi">
		{#if data.conVecchi}Stai vedendo anche i lavori dei mesi scorsi. <a class="link" href="?">Mostra solo il mese in corso</a>
		{:else}{data.stampa.vecchi} {data.stampa.vecchi === 1 ? 'lavoro' : 'lavori'} dei mesi scorsi {data.stampa.vecchi === 1 ? 'non è' : 'non sono'} in elenco: li mandi tu in stampa dagli ordini. <a class="link" href="?vecchi=1">Mostrali lo stesso</a>{/if}
	</p>
{/if}
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
				<img class="mac__foto" src={RUOLO[ruolo as Ruolo].foto} alt={m?.name ?? RUOLO[ruolo as Ruolo].label} />
				{#if !gruppi.length}
					<p class="mac__empty">Niente da stampare su questa macchina.</p>
				{/if}
				{#each gruppi as b (b.id)}
					<article class="bob" class:is-ready={b.pronta} class:is-run={b.inCorso}>
						<div class="bob__top">
							<b>{etichettaProtezione(b.protezione)}</b>
							<span class="bob__mq">{b.lavori.length} {b.lavori.length === 1 ? 'lavoro' : 'lavori'}{b.mq > 0 ? ` · ${b.mq.toFixed(2)} m²` : ''} · {fmtMin(b.minuti)}</span>
						</div>
						<p class="bob__why" class:is-wait={!b.pronta}>{b.pronta ? '▶' : '⏳'} {b.motivo}{#if b.avviaEntro} · entro {fmtDay(b.avviaEntro, now, data.setup.calendar)}{/if}</p>
						<ul class="bob__list">
							{#each b.lavori as l (l.faseId)}
							{@render rigaLavoro(l)}
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

{#if data.laminazione}
	<!-- LAMINAZIONE: una macchina sola, i lavori in fila per pellicola -->
	<div class="mac1">
		<section class="mac">
			<header class="mac__top mac__top--lam">
				<div><b>Laminatrice</b><small>🧴 una bobina per volta: i lavori della stessa pellicola si fanno di seguito</small></div>
				<span class="mac__n">{data.laminazione.filter((b) => b.pronta).length} da fare</span>
			</header>
			<img class="mac__foto mac__foto--wide" src="/images/macchine/laminatrice.jpg" alt="Laminatrice" />
			{#each data.laminazione as b (b.id)}
				{#if b.cambioBobina}<p class="lam__cambio">🔄 monta la bobina · <b>{etichettaProtezione(b.protezione)}</b></p>{/if}
				<article class="bob" class:is-ready={b.pronta} class:is-run={b.inCorso}>
					<div class="bob__top">
						<b>{b.ordine}ª passata · {etichettaProtezione(b.protezione)}</b>
						<span class="bob__mq">{b.lavori.length} {b.lavori.length === 1 ? 'lavoro' : 'lavori'}{b.mq > 0 ? ` · ${b.mq.toFixed(2)} m²` : ''} · {fmtMin(b.minuti)}</span>
					</div>
					<p class="bob__why" class:is-wait={!b.pronta}>{b.pronta ? '▶' : '⏳'} {b.motivo}{#if b.avviaEntro} · entro {fmtDay(b.avviaEntro, now, data.setup.calendar)}{/if}</p>
					<ul class="bob__list">
						{#each b.lavori as l (l.faseId)}
							{@render rigaLavoro(l)}
						{/each}
					</ul>
					{#if b.pronta && !b.inCorso}
						<form method="POST" action="?/bobina" use:enhance>
							<input type="hidden" name="fasi" value={b.lavori.map((l) => l.faseId).join(',')} />
							<button class="btn btn--green btn--xs" type="submit">▶ Avvia questa passata</button>
						</form>
					{:else if b.inCorso}<p class="bob__run">Laminazione in corso</p>{/if}
				</article>
			{:else}
				<p class="mac__empty">Niente da laminare.</p>
			{/each}
		</section>
	</div>
{/if}

{#if data.taglio}
	<!-- TAGLIO: i lavori divisi sui due plotter, stesso stile della stampa -->
	<div class="mac2">
		{#each data.taglio as coda, i (i)}
			<section class="mac">
				<header class="mac__top mac__top--taglio">
					<div><b>Graphtec {i + 1}</b><small>✂️ taglio e mezzo taglio</small></div>
					<span class="mac__n">{coda.length} {coda.length === 1 ? 'lavoro' : 'lavori'}</span>
				</header>
				<img class="mac__foto" src="/images/macchine/graphtec.jpg" alt="Plotter Graphtec {i + 1}" />
				{#each coda as l (l.faseId)}
					<article class="bob" class:is-ready={l.stato === 'pronto'} class:is-run={l.stato === 'in_corso'}>
						<div class="bob__top">
							<b><span class="pico">{iconaProdotto(l.prodotto)}</span> <a class="oid" href="/dashboard/produzione/commessa/{l.jobId}">{l.numero}</a></b>
							<span class="bob__mq">{l.pezzi} pz{l.mq > 0 ? ` · ${l.mq.toFixed(2)} m²` : ''} · {fmtMin(l.minuti)}</span>
						</div>
						<ul class="bob__list">{@render rigaLavoro(l)}</ul>
						{#if l.stato === 'pronto'}
							<form method="POST" action="?/inizia" use:enhance><input type="hidden" name="task" value={l.faseId} /><button class="btn btn--green btn--xs" type="submit">▶ Avvia taglio</button></form>
						{:else if l.stato === 'in_corso'}
							<form method="POST" action="?/completa" use:enhance><input type="hidden" name="task" value={l.faseId} /><button class="btn btn--blue btn--xs" type="submit">✓ Taglio finito</button></form>
						{:else}
							<p class="bob__why is-wait">⏳ aspetta la lavorazione prima</p>
						{/if}
					</article>
				{:else}
					<p class="mac__empty">Nessun lavoro in coda su questo plotter.</p>
				{/each}
			</section>
		{/each}
	</div>
{/if}

{#if data.resinatura}
	<!-- RESINATURA: una macchina sola -->
	<div class="mac1">
		<section class="mac">
			<header class="mac__top mac__top--res">
				<div><b>Resinatrice</b><small>💧 resina sui pezzi già tagliati</small></div>
				<span class="mac__n">{data.resinatura.filter((l) => l.stato === 'pronto').length} da fare</span>
			</header>
			<img class="mac__foto mac__foto--wide" src="/images/macchine/resinatrice.jpg" alt="Resinatrice" />
			{#each data.resinatura as l (l.faseId)}
				<article class="bob" class:is-ready={l.stato === 'pronto'} class:is-run={l.stato === 'in_corso'}>
					<div class="bob__top">
						<b><span class="pico">{iconaProdotto(l.prodotto)}</span> <a class="oid" href="/dashboard/produzione/commessa/{l.jobId}">{l.numero}</a></b>
						<span class="bob__mq">{l.pezzi} pz · {fmtMin(l.minuti)}</span>
					</div>
					<ul class="bob__list">{@render rigaLavoro(l)}</ul>
					{#if l.stato === 'pronto'}
						<form method="POST" action="?/inizia" use:enhance><input type="hidden" name="task" value={l.faseId} /><button class="btn btn--green btn--xs" type="submit">▶ Avvia resinatura</button></form>
					{:else if l.stato === 'in_corso'}
						<form method="POST" action="?/completa" use:enhance><input type="hidden" name="task" value={l.faseId} /><button class="btn btn--blue btn--xs" type="submit">✓ Resinatura finita</button></form>
					{/if}
				</article>
			{:else}
				<p class="mac__empty">Niente da resinare.</p>
			{/each}
		</section>
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
