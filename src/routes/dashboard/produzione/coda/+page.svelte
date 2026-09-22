<script lang="ts">
	import '$lib/styles/produzione.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import ProdNav from '$lib/components/produzione/ProdNav.svelte';
	import Steps from '$lib/components/produzione/Steps.svelte';
	import { fmtMin, fmtWhen } from '$lib/production/format';
	import { RISK, DEPARTMENTS, type RiskStatus } from '$lib/production/types';
	import { thumbOf, itemMeta } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const now = $derived(new Date(data.now));
	const cal = $derived(data.setup.calendar);
	const FILTERS = [['tutti', 'Tutti'], ['da-avviare', 'Da avviare'], ['in-corso', 'In corso'], ['a-rischio', 'In ritardo o a rischio'], ['completati', 'Finiti']] as const;
	const f = $derived(page.url.searchParams.get('f') ?? 'tutti');
	let q = $state('');
	type Row = (typeof data.queue)[number];
	type Done = (typeof data.done)[number];
	const match = (r: Row | Done) => { const s = q.trim().toLowerCase(); return !s || r.job.order_number.toLowerCase().includes(s) || r.group.customer.toLowerCase().includes(s) || r.group.email.toLowerCase().includes(s); };
	const byFilter = (r: Row, k: string) => k === 'da-avviare' ? r.job.status === 'READY_TO_START' : k === 'in-corso' ? ['IN_PROGRESS', 'WAITING_PASSIVE_TIME'].includes(r.job.status) : k === 'a-rischio' ? r.job.risk_status !== 'ON_TRACK' : true;
	const list = $derived(data.queue.filter((r) => byFilter(r, f)).filter(match));
	const done = $derived(data.done.filter(match));
	/* la coda e' gia' in ordine di urgenza: la si divide in tre blocchi cosi' si capisce a colpo d'occhio dove si sta bruciando */
	const SECTIONS: { key: string; risks: RiskStatus[]; label: string; hint: string }[] = [
		{ key: 'late', risks: ['LATE'], label: 'In ritardo', hint: 'la data di spedizione promessa non si regge più: da avviare o finire subito' },
		{ key: 'risk', risks: ['AT_RISK', 'TIGHT'], label: 'A rischio', hint: 'margine quasi finito: vanno avviati oggi' },
		{ key: 'ok', risks: ['ON_TRACK'], label: 'In tempo', hint: 'nell’ordine in cui conviene farli' }
	];
	const sections = $derived(SECTIONS.map((s) => ({ ...s, rows: list.filter((r) => s.risks.includes(r.job.risk_status)) })).filter((s) => s.rows.length));
	const dmy = (d: string) => d.split('-').reverse().join('/');
	const meta = (r: Row | Done) => { const it = r.group.items[0]; const m = itemMeta(it); return `${r.group.qty.toLocaleString('it-IT')} × ${it.product_name}${m ? ` · ${m}` : ''}${r.group.items.length > 1 ? ` (+${r.group.items.length - 1})` : ''}`; };
	const late = (r: Row) => !!r.job.latest_start_at && new Date(r.job.latest_start_at) < now && r.job.status === 'READY_TO_START';
</script>

<svelte:head><title>Coda ordini | Produzione</title></svelte:head>
<div class="pv-head"><div><h1>📋 Coda ordini</h1><p class="lead">Dall’alto in basso: prima quello che brucia. Ogni riga è un ordine, i pallini sono le sue fasi.</p></div><ProdNav /></div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
<div class="pv-filters">
	<div class="tabs">{#each FILTERS as [k, l] (k)}<button type="button" class:is-active={f === k} onclick={() => goto(`?f=${k}`, { keepFocus: true, noScroll: true })}>{l}{#if k !== 'completati'}<i class="tabs__n">{data.queue.filter((r) => byFilter(r, k)).length}</i>{/if}</button>{/each}</div>
	<input placeholder="Cerca ordine o cliente…" bind:value={q} />
</div>

{#if f === 'completati'}
	<div class="q">
		{#each done as r (r.job.id)}
			<a class="q__row q__row--done" href="/dashboard/produzione/commessa/{r.job.id}">
				{#if thumbOf(r.group.items[0])}<img class="q__thumb" src={thumbOf(r.group.items[0])} alt="" />{:else}<span class="q__thumb"></span>{/if}
				<div class="q__who"><b class="q__num">{r.job.order_number}</b><span class="q__cust">{r.group.customer}</span><span class="q__what">{meta(r)}</span></div>
				<div class="q__steps"><Steps phases={r.phases} compact /></div>
				<div class="q__when"><small>{r.job.status === 'CANCELLED' ? 'Annullata' : 'Finita → Spedizioni'}</small><b>{fmtWhen(r.job.completed_at ?? r.job.cancelled_at, now, cal)}</b></div>
				<div class="q__act"><span class="q__date">promessa {dmy(r.job.promised_ship_date)}</span></div>
			</a>
		{:else}<p class="osub" style="padding:20px">Nessuna commessa finita.</p>{/each}
	</div>
{:else}
	{#each sections as s (s.key)}
		<section class="q q--{s.key}">
			<h2 class="q__title"><span class="q__title-dot"></span>{s.label} <i>{s.rows.length}</i><small>{s.hint}</small></h2>
			{#each s.rows as r (r.job.id)}
				{@const rk = RISK[r.job.risk_status]}
				{@const ph = r.current ?? r.next}
				<div class="q__row" style="--c:{rk.hex};--cs:{rk.soft}">
					{#if thumbOf(r.group.items[0])}<img class="q__thumb" src={thumbOf(r.group.items[0])} alt="" />{:else}<span class="q__thumb"></span>{/if}
					<div class="q__who">
						<a class="q__num" href="/dashboard/produzione/commessa/{r.job.id}">{r.job.order_number}</a>
						<span class="q__cust">{r.group.customer}</span>
						<span class="q__what">{meta(r)}{#if r.laminated} · 🧴 {r.protection}{/if}</span>
					</div>
					<div class="q__steps">
						<Steps phases={r.phases} />
						{#if ph}<span class="q__now">{#if r.job.status === 'WAITING_PASSIVE_TIME'}⏳ {ph.label}: pronta {fmtWhen(ph.planned_end_at, now, cal)}{:else if r.job.status === 'IN_PROGRESS'}▶ {ph.label}{ph.machine ? ` su ${ph.machine}` : ''}{:else}prossima: {ph.label}{ph.machine ? ` · ${ph.machine}` : ` · ${DEPARTMENTS[ph.stage]?.label ?? ''}`}{/if}</span>{/if}
					</div>
					<div class="q__when" class:is-late={late(r)}>
						<small>{r.job.status === 'READY_TO_START' ? 'avvia entro' : 'lavoro restante'}</small>
						<b>{r.job.status === 'READY_TO_START' ? fmtWhen(r.job.latest_start_at, now, cal) : fmtMin(r.job.total_minutes)}</b>
						<small>{r.job.predicted_delay_minutes > 0 ? `⚠ oltre di ${fmtMin(r.job.predicted_delay_minutes)}` : `margine ${fmtMin(r.job.slack_minutes ?? 0)}`}</small>
					</div>
					<div class="q__act">
						<span class="q__date" title="Data di spedizione promessa al cliente">🚚 {dmy(r.job.promised_ship_date)}</span>
						{#if r.job.status === 'READY_TO_START'}<form method="POST" action="?/avvia" use:enhance><input type="hidden" name="job" value={r.job.id} /><button class="btn btn--green btn--sm" type="submit">▶ Avvia</button></form>{/if}
					</div>
				</div>
			{/each}
		</section>
	{:else}<p class="osub" style="padding:20px">Nessun ordine con questo filtro.</p>{/each}
{/if}
