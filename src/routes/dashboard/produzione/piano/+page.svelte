<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, itemMeta } from '$lib/dashboard/orders';
	import { COLOURS, fmtAgo, fmtDay, fmtMin, fmtWhen, rome, STAGE_KEYS, STAGES, type Colour } from '$lib/dashboard/produzione';
	import ProdTaskCard from '$lib/components/dashboard/ProdTaskCard.svelte';
	let { data, form } = $props();
	let showAll = $state(false);
	const now = $derived(new Date(data.now));
	const hour = $derived(rome(now).h * 60 + rome(now).min);
	const list = $derived(showAll ? data.open : data.open.slice(0, 12));
	const pct = (m: number, cap: number) => Math.min(100, Math.round((m / cap) * 100));
	const loadColour = (p: number) => (p > 100 ? '#dc2626' : p > 80 ? '#ea580c' : '#16a34a');
	const legend = Object.entries(COLOURS) as [Colour, { label: string; hex: string }][];
	// routine di giornata: cosa controllare in questo momento
	const routine = $derived(hour < 9 * 60 + 30
		? { when: 'Ore 8:30 · apertura', todo: [`${data.kpi.atRisk} lavorazioni rosse o arancioni da mettere in cima`, `${data.kpi.blocked} bloccate da sbloccare`, `${data.approvals.length} anteprime o file in attesa: solleciti`] }
		: hour < 16 * 60
			? { when: 'Giornata', todo: [`${data.kpi.shipToday} commesse da chiudere entro le 16:00 per il ritiro delle 17:00`, 'segui la coda del reparto in ordine di priorità'] }
			: hour < 17 * 60
				? { when: 'Ore 15:30 · verso il ritiro', todo: [`${data.shipToday.filter((g) => g.status !== 'pronto').length} commesse di oggi non ancora pronte: vanno chiuse o va avvisato il cliente`, 'etichette e DDT dalla pagina Spedizioni'] }
				: { when: 'Fine giornata', todo: ['quello che non è partito oggi è già in cima alla lista di domani', 'lascia bloccato solo ciò che ha un motivo scritto'] });
</script>

<svelte:head><title>Produzione di oggi | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Produzione di oggi</h1><p class="lead">Ogni riga d'ordine è una commessa con la sua coda di lavorazioni. Le scadenze si calcolano a ritroso dal ritiro del corriere (17:00) della data promessa: prima i ritardi, poi ciò che parte oggi, poi il percorso critico.</p></div>
	<div class="pr-routine"><b>{routine.when}</b><ul>{#each routine.todo as t (t)}<li>{t}</li>{/each}</ul></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="pr-kpis">
	<div class="pr-kpi" class:is-hot={data.kpi.shipToday > 0}><b>{data.kpi.shipToday}</b><span>da spedire oggi</span></div>
	<div class="pr-kpi"><b>{data.kpi.open}</b><span>lavorazioni aperte</span></div>
	<div class="pr-kpi" class:is-hot={data.kpi.atRisk > 0}><b>{data.kpi.atRisk}</b><span>a rischio</span></div>
	<div class="pr-kpi" class:is-warn={data.kpi.approvals > 0}><b>{data.kpi.approvals}</b><span>in attesa del cliente</span></div>
	<div class="pr-kpi" class:is-hot={data.kpi.blocked > 0}><b>{data.kpi.blocked}</b><span>bloccate</span></div>
</div>

<div class="pr-legend">{#each legend as [k, c] (k)}<span><i style="background:{c.hex}"></i>{c.label}</span>{/each}</div>

<div class="pr-two">
	<div class="dcard">
		<h3>Carico dei reparti oggi</h3>
		<p class="osub" style="margin-bottom:10px">Minuti delle lavorazioni con scadenza entro oggi rispetto alla capacità del reparto (7 ore per macchina o persona).</p>
		<div class="pr-load">
			{#each STAGE_KEYS as k (k)}
				{@const l = data.load[k]}
				{@const p = pct(l.minutes, l.capacity)}
				<a href="/dashboard/produzione/{k}" class="pr-load__row">
					<span class="pr-load__name">{STAGES[k].icon} {STAGES[k].label}</span>
					<span class="pr-load__bar"><i style="width:{p}%;background:{loadColour(p)}"></i></span>
					<span class="pr-load__val">{p}% <small>· {fmtMin(l.minutes)} · {l.open} {l.open === 1 ? 'aperta' : 'aperte'}</small></span>
				</a>
			{/each}
		</div>
	</div>

	<div class="dcard">
		<h3>Da spedire oggi <small class="osub">({data.shipToday.length})</small></h3>
		{#if data.shipToday.length === 0}
			<p class="osub">Nessuna commessa promessa per oggi.</p>
		{:else}
			<ul class="pr-list">
				{#each data.shipToday as g (g.key)}
					<li>
						<a class="pr-num" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a> · {g.customer}
						<span class="pill" style="background:{ORDER_STATUS[g.status]?.soft};color:{ORDER_STATUS[g.status]?.color}">{ORDER_STATUS[g.status]?.label}</span>
						{#if g.items[0].ship_by && g.items[0].ship_by < data.now.slice(0, 10)}<span class="pr-chip pr-chip--late">in ritardo dal {fmtDay(g.items[0].ship_by)}</span>{/if}
						<div class="osub">{g.items.map((i) => `${i.qty} × ${i.product_name}`).join(' · ')}</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<div class="dcard">
	<div class="toolbar" style="justify-content:space-between">
		<h3 style="margin:0">Ordine di lavoro <small class="osub">({data.open.length} lavorazioni aperte)</small></h3>
		{#if data.open.length > 12}<button class="btn btn--ghost btn--xs" type="button" onclick={() => (showAll = !showAll)}>{showAll ? 'Mostra le prime 12' : `Mostra tutte (${data.open.length})`}</button>{/if}
	</div>
	<p class="osub" style="margin:6px 0 12px">In ritardo → da spedire oggi → percorso critico (meno di 4 ore di margine) → domani → il resto a lotti per materiale e macchina.</p>
	{#if data.open.length === 0}
		<p class="osub">Nessuna lavorazione aperta: la produzione è vuota.</p>
	{:else}
		<div class="pr-grid">{#each list as p (p.task.id)}<ProdTaskCard {p} showStage />{/each}</div>
	{/if}
</div>

<div class="pr-two">
	<div class="dcard">
		<h3>In attesa del cliente <small class="osub">({data.approvals.length})</small></h3>
		<p class="osub" style="margin-bottom:10px">Anteprime da inviare o da approvare, file mancanti. La scadenza è l'ultimo momento utile per mantenere la data di spedizione promessa.</p>
		{#if data.approvals.length === 0}
			<p class="osub">Nessuna commessa aspetta il cliente.</p>
		{:else}
			<ul class="pr-list">
				{#each data.approvals as a (a.order.id)}
					<li class:is-overdue={a.overdue}>
						<a class="pr-num" href="/dashboard/fatturazione/ordini/{a.order.checkout_group ?? a.order.id}">{a.order.number}</a> · {a.order.qty} × {a.order.product_name}
						<span class="pill" style="background:{ORDER_STATUS[a.order.status]?.soft};color:{ORDER_STATUS[a.order.status]?.color}">{ORDER_STATUS[a.order.status]?.label}</span>
						<div class="osub">{itemMeta(a.order)}{#if a.order.customer_name} · {a.order.customer_name}{/if} · da {fmtAgo(a.since, now)} · spedizione {fmtDay(a.order.ship_by, now)}</div>
						<div class="osub" class:is-late={a.overdue}>{a.overdue ? '⏰ termine superato: la data slitterà' : `entro ${fmtWhen(a.deadline, now)}`}</div>
						{#if a.waitingCustomer}
							<form method="POST" action="?/sollecita" use:enhance style="margin-top:6px"><input type="hidden" name="order" value={a.order.id} /><button class="btn btn--ghost btn--xs" type="submit">✉ Sollecita{#if a.order.proof_reminded_at} <small>(ultimo {fmtAgo(a.order.proof_reminded_at, now)})</small>{/if}</button></form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="dcard">
		<h3>Problemi <small class="osub">({data.problems.length})</small> <a class="link" style="font-size:12px;float:right" href="/dashboard/produzione/problemi">Centro problemi ›</a></h3>
		{#if data.problems.length === 0}
			<p class="osub">Nessuna lavorazione bloccata o in ritardo.</p>
		{:else}
			<ul class="pr-list">
				{#each data.problems.slice(0, 10) as p (p.task.id)}
					<li>
						<span class="pr-dot" style="--c:{COLOURS[p.risk.colour].hex}"></span>
						<a class="pr-num" href="/dashboard/produzione/commessa/{p.task.order.id}">{p.task.order.number}</a> · {STAGES[p.task.stage]?.icon} {p.task.label}
						<div class="osub">{p.task.status === 'bloccato' ? `⚠ ${p.task.block_reason ?? 'bloccata'}` : `⏰ scaduta ${fmtWhen(p.task.due_at, now)}`}</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
