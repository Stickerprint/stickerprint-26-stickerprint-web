<script lang="ts">
	import { page } from '$app/state';
	import { OPEN_TICKET, SLA_HOURS, TICKET_KIND, TICKET_STATUS, waitingHours, type TicketKind, type TicketStatus } from '$lib/dashboard/helpdesk';
	import { fmtAgo } from '$lib/dashboard/produzione';
	let { data } = $props();
	const filter = $derived(page.url.searchParams.get('stato') ?? 'aperti');
	const kind = $derived(page.url.searchParams.get('tipo') ?? '');
	const priority = (t: (typeof data.tickets)[number]) => {
		const w = waitingHours(t) ?? -1;
		let p = 0;
		if (t.status === 'nuovo' || t.unread) p += 100; // aspetta noi
		if (t.kind === 'lamentela' || t.kind === 'problema' || t.kind === 'reso') p += 50;
		if (w > SLA_HOURS) p += 200;
		return p;
	};
	const list = $derived(data.tickets
		.filter((t) => (filter === 'aperti' ? OPEN_TICKET.includes(t.status) : filter === 'tutti' ? true : t.status === filter))
		.filter((t) => (kind ? t.kind === kind : true))
		.sort((a, b) => priority(b) - priority(a) || b.last_message_at.localeCompare(a.last_message_at)));
	const waitingUs = $derived(data.tickets.filter((t) => OPEN_TICKET.includes(t.status) && (t.status === 'nuovo' || t.unread)));
	const overSla = $derived(waitingUs.filter((t) => (waitingHours(t) ?? 0) > SLA_HOURS));
</script>

<svelte:head><title>Richieste di aiuto | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Richieste di aiuto</h1><p class="lead">Supporto, problemi sugli ordini, resi e lamentele dai moduli del sito. In cima chi aspetta una nostra risposta: lamentele e problemi prima, e tutto ciò che aspetta da più di {SLA_HOURS} ore è rosso.</p></div>
	<div class="pr-kpis pr-kpis--side" style="min-width:260px">
		<div class="pr-kpi" class:is-warn={waitingUs.length > 0}><b>{waitingUs.length}</b><span>aspettano noi</span></div>
		<div class="pr-kpi" class:is-hot={overSla.length > 0}><b>{overSla.length}</b><span>oltre {SLA_HOURS} h</span></div>
		<div class="pr-kpi"><b>{data.tickets.filter((t) => OPEN_TICKET.includes(t.status)).length}</b><span>aperti</span></div>
	</div>
</div>

<div class="tabs">
	<a class="tab-link" class:is-active={filter === 'aperti'} href="?stato=aperti&tipo={kind}">Aperti</a>
	{#each Object.entries(TICKET_STATUS) as [k, v] (k)}<a class="tab-link" class:is-active={filter === k} href="?stato={k}&tipo={kind}">{v.label} ({data.tickets.filter((t) => t.status === k).length})</a>{/each}
	<a class="tab-link" class:is-active={filter === 'tutti'} href="?stato=tutti&tipo={kind}">Tutti</a>
	<span style="width:12px"></span>
	<a class="tab-link" class:is-active={kind === ''} href="?stato={filter}">Ogni tipo</a>
	{#each Object.entries(TICKET_KIND) as [k, v] (k)}<a class="tab-link" class:is-active={kind === k} href="?stato={filter}&tipo={k}">{v.icon} {v.label}</a>{/each}
</div>

{#if list.length === 0}
	<div class="dcard" style="text-align:center;color:var(--muted)">Nessuna richiesta qui.</div>
{:else}
	<div class="rq-list">
		{#each list as t (t.id)}
			{@const st = TICKET_STATUS[t.status as TicketStatus]}
			{@const k = TICKET_KIND[t.kind as TicketKind]}
			{@const w = waitingHours(t)}
			<a class="rq-row" class:is-unread={t.status === 'nuovo' || t.unread} class:is-late={(w ?? 0) > SLA_HOURS} href="/dashboard/supporto/ticket/{t.id}">
				<span class="rq-dot" title={t.unread || t.status === 'nuovo' ? 'Aspetta una risposta' : ''}></span>
				<div class="rq-main">
					<div class="rq-head"><span class="pr-chip">{t.number}</span><b>{t.name || t.email}</b><span class="pr-chip">{k.icon} {k.label}</span><span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>{#if t.order_number}<span class="pr-chip">📦 {t.order_number}</span>{/if}{#if (w ?? 0) > SLA_HOURS}<span class="pr-chip pr-chip--late">aspetta da {w} h</span>{/if}</div>
					<div class="rq-msg">{t.subject ?? ''}</div>
					<div class="osub">{t.email} · ultimo messaggio {fmtAgo(t.last_message_at)}{#if t.assigned} · {t.assigned}{/if}</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
