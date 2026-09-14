<script lang="ts">
	import { page } from '$app/state';
	import { REQUEST_STATUS, type RequestStatus } from '$lib/dashboard/richieste';
	import { fmtAgo } from '$lib/dashboard/produzione';
	let { data } = $props();
	const filter = $derived(page.url.searchParams.get('stato') ?? 'aperte');
	const OPEN = new Set(['new', 'in_progress', 'quoted']);
	const list = $derived(data.requests.filter((r) => filter === 'tutte' ? true : filter === 'aperte' ? OPEN.has(r.status) : r.status === filter));
	const counts = $derived(Object.fromEntries(Object.keys(REQUEST_STATUS).map((k) => [k, data.requests.filter((r) => r.status === k).length])));
	const hoursOpen = (r: { created_at: string }) => (Date.now() - new Date(r.created_at).getTime()) / 36e5;
</script>

<svelte:head><title>Richieste aziende | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Richieste aziende</h1><p class="lead">Quello che arriva dal modulo Aziende. Regola: prima risposta entro un giorno lavorativo. Da qui si apre il preventivo e si segue la commessa fino all'ordine.</p></div>
	<a class="btn btn--xs" href="/dashboard/aziende/preventivi/nuovo">＋ Preventivo senza richiesta</a>
</div>

<div class="tabs">
	<a class="tab-link" class:is-active={filter === 'aperte'} href="?stato=aperte">Aperte ({data.requests.filter((r) => OPEN.has(r.status)).length})</a>
	{#each Object.entries(REQUEST_STATUS) as [k, v] (k)}<a class="tab-link" class:is-active={filter === k} href="?stato={k}">{v.label} ({counts[k]})</a>{/each}
	<a class="tab-link" class:is-active={filter === 'tutte'} href="?stato=tutte">Tutte</a>
</div>

{#if list.length === 0}
	<div class="dcard" style="text-align:center;color:var(--muted)">Nessuna richiesta {filter === 'aperte' ? 'aperta' : ''}.</div>
{:else}
	<div class="rq-list">
		{#each list as r (r.id)}
			{@const st = REQUEST_STATUS[r.status as RequestStatus]}
			{@const late = r.status === 'new' && hoursOpen(r) > 24}
			{@const q = data.quoteByRequest[r.id]}
			<a class="rq-row" class:is-unread={!r.read_at} class:is-late={late} href="/dashboard/aziende/richieste/{r.id}">
				<span class="rq-dot" title={r.read_at ? '' : 'Da leggere'}></span>
				<div class="rq-main">
					<div class="rq-head"><b>{r.company || r.name || r.email}</b>{#if r.company && r.name} · {r.name}{/if}<span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>{#if late}<span class="pr-chip pr-chip--late">oltre 24 h senza risposta</span>{/if}{#if r.file_path}<span class="pr-chip">📎 allegato</span>{/if}{#if q}<span class="pr-chip">📄 {q.number}</span>{/if}</div>
					<div class="rq-msg">{r.message.length > 180 ? r.message.slice(0, 177) + '…' : r.message}</div>
					<div class="osub">{r.email}{#if r.phone} · {r.phone}{/if} · {fmtAgo(r.created_at)}</div>
				</div>
			</a>
		{/each}
	</div>
{/if}
