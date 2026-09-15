<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { CATS, dmy } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const filter = $derived(page.url.searchParams.get('stato') ?? 'pending');
	const list = $derived(data.reviews.filter((r) => (filter === 'tutte' ? true : r.status === filter)));
	const count = (s: string) => data.reviews.filter((r) => r.status === s).length;
	const name = (r: (typeof data.reviews)[number]) => r.author || r.profile?.full_name || [r.order?.shipping?.first_name, r.order?.shipping?.last_name].filter(Boolean).join(' ') || r.email || 'Cliente';
	const avg = $derived.by(() => { const a = data.reviews.filter((r) => r.status === 'approved'); return a.length ? (a.reduce((s, r) => s + r.rating, 0) / a.length).toFixed(1) : '—'; });
	let adding = $state(false);
	let stars = $state(5);
	const STATUS: Record<string, { label: string; color: string; soft: string }> = { pending: { label: 'Da approvare', color: '#b45309', soft: '#fef3c7' }, approved: { label: 'Pubblicata', color: '#15803d', soft: '#dcfce7' }, rejected: { label: 'Rifiutata', color: '#6b7280', soft: '#e5e7eb' } };
	const TABS = ['pending', 'approved'];
	const when = (d: string | null) => (d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
	const reqs = $derived(data.requests);
	const opened = $derived(reqs.filter((r) => r.opened_count > 0).length);
	const tracked = $derived(reqs.filter((r) => r.tracked).length);
	const reviewed = $derived(reqs.filter((r) => r.review_id).length);
</script>

<svelte:head><title>Recensioni | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>Recensioni</h1><p class="lead">Quelle dei clienti arrivano "da approvare": le leggi e decidi se pubblicarle. Sul sito compaiono solo le pubblicate (media e conteggio contano tutte le pubblicate, l'elenco mostra quelle da 4 stelle in su con un commento).</p></div>
	<div class="pr-kpis pr-kpis--side" style="min-width:300px">
		<div class="pr-kpi" class:is-warn={count('pending') > 0}><b>{count('pending')}</b><span>da approvare</span></div>
		<div class="pr-kpi"><b>{count('approved')}</b><span>pubblicate</span></div>
		<div class="pr-kpi"><b>{avg}</b><span>media pubblicata</span></div>
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.message}<p class="ok">{form.message}</p>{/if}

<div class="toolbar" style="justify-content:space-between">
	<div class="tabs">
		{#each TABS as k (k)}<a class="tab-link" class:is-active={filter === k} href="?stato={k}">{STATUS[k].label} ({count(k)})</a>{/each}
		<a class="tab-link" class:is-active={filter === 'inviate'} href="?stato=inviate">Inviate ({reqs.length})</a>
		<a class="tab-link" class:is-active={filter === 'tutte'} href="?stato=tutte">Tutte</a>
	</div>
	<button class="btn btn--xs" type="button" onclick={() => (adding = !adding)}>＋ Inserisci una recensione</button>
</div>

{#if adding}
	<form method="POST" action="?/aggiungi" use:enhance={() => async ({ update }) => { await update(); adding = false; }} class="dcard hd-tpl">
		<p class="osub" style="margin:0">Per le recensioni che i clienti lasciano fuori dal sito (Google, email, WhatsApp, di persona). Vengono pubblicate subito.</p>
		<div class="toolbar" style="gap:10px">
			<input name="author" placeholder="Nome del cliente (es. Marco R.)" required style="flex:1" />
			<label class="osub" style="display:flex;gap:6px;align-items:center">Stelle <span style="font-size:22px;cursor:pointer">{#each [1, 2, 3, 4, 5] as n (n)}<button type="button" class="link-btn" style="color:{n <= stars ? '#f5b301' : '#d6d9e2'};font-size:22px;padding:0 1px" onclick={() => (stars = n)}>★</button>{/each}</span><input type="hidden" name="rating" value={stars} /></label>
			<select name="product_slug" class="sel-sm"><option value="">Prodotto (facoltativo)</option>{#each Object.entries(CATS) as [k, c] (k)}<option value={k}>{c.name}</option>{/each}</select>
		</div>
		<input name="title" placeholder="Titolo (facoltativo)" />
		<textarea name="comment" rows="4" placeholder="Testo della recensione, così com'è stata scritta" required></textarea>
		<div class="toolbar" style="gap:10px">
			<label class="osub">Data <input type="date" name="date" class="sel-sm" /></label>
			<button class="btn btn--green btn--xs" type="submit">Pubblica</button>
			<button class="btn btn--ghost btn--xs" type="button" onclick={() => (adding = false)}>Annulla</button>
		</div>
	</form>
{/if}

{#if filter === 'inviate'}
	<div class="dcard" style="display:grid;gap:10px">
		<div class="toolbar" style="justify-content:space-between;align-items:flex-start;gap:12px">
			<p class="osub" style="margin:0;max-width:640px">Le email "Com'è andata con l'ordine?" partono da sole il giorno dopo la consegna. Qui vedi chi le ha ricevute, chi le ha aperte e quante volte, chi ha cliccato e chi ha lasciato la recensione. L'apertura si conta con un'immagine invisibile: chi blocca le immagini nella posta risulta "non aperta" anche se l'ha letta.</p>
			<div class="pr-kpis pr-kpis--side" style="min-width:320px">
				<div class="pr-kpi"><b>{reqs.length}</b><span>inviate</span></div>
				<div class="pr-kpi"><b>{tracked ? Math.round((opened / tracked) * 100) : 0}%</b><span>aperte</span></div>
				<div class="pr-kpi"><b>{reqs.length ? Math.round((reviewed / reqs.length) * 100) : 0}%</b><span>recensite</span></div>
			</div>
		</div>
		<div style="overflow-x:auto">
			<table class="dtable">
				<thead><tr><th>Inviata</th><th>Ordine</th><th>Cliente</th><th>Aperta</th><th>Cliccato</th><th>Recensione</th></tr></thead>
				<tbody>
					{#each reqs as r (r.id)}
						<tr>
							<td>{when(r.sent_at)}</td>
							<td>{#if r.checkout_group}<a class="link" href="/dashboard/fatturazione/ordini/{r.checkout_group}">{r.number}</a>{:else}{r.number}{/if}</td>
							<td><b>{r.name ?? ''}</b><div class="osub">{r.email}</div></td>
							<td>
								{#if !r.tracked}<span class="osub">non tracciata</span>
								{:else if r.opened_count > 0}<span class="pill" style="background:#dcfce7;color:#15803d">✓ {r.opened_count} {r.opened_count === 1 ? 'volta' : 'volte'}</span><div class="osub">{r.opened_count === 1 ? '' : 'prima '}{when(r.first_opened_at)}{#if r.opened_count > 1} · ultima {when(r.last_opened_at)}{/if}</div>
								{:else}<span class="pill" style="background:#fee2e2;color:#b91c1c">non aperta</span>{/if}
							</td>
							<td>{#if r.clicked_at}<span class="pill" style="background:#dbeafe;color:#1d4ed8">✓ {when(r.clicked_at)}</span>{:else}<span class="osub">—</span>{/if}</td>
							<td>{#if r.review}<span style="color:#f5b301">{'★'.repeat(r.review.rating)}</span> <span class="osub">{STATUS[r.review.status]?.label ?? r.review.status}</span>{:else}<span class="osub">non ancora</span>{/if}</td>
						</tr>
					{:else}
						<tr><td colspan="6" style="text-align:center;color:var(--muted)">Nessuna richiesta inviata finora.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else}
<div class="rq-list">
	{#each list as r (r.id)}
		{@const st = STATUS[r.status]}
		<div class="dcard" style="display:grid;gap:8px">
			<div class="toolbar" style="justify-content:space-between;gap:10px">
				<div class="toolbar" style="gap:8px"><span style="color:#f5b301;font-size:18px;letter-spacing:1px">{'★'.repeat(r.rating)}<span style="color:#d6d9e2">{'★'.repeat(5 - r.rating)}</span></span><b>{name(r)}</b><span class="pill" style="background:{st.soft};color:{st.color}">{st.label}</span>{#if r.source === 'staff'}<span class="pr-chip">inserita da noi</span>{:else}<span class="pr-chip">dal sito</span>{/if}{#if r.product_slug}<span class="pr-chip">{CATS[r.product_slug]?.name ?? r.product_slug}</span>{/if}</div>
				<span class="osub">{dmy(r.created_at)}{#if r.order} · <a class="link" href="/dashboard/fatturazione/ordini/{r.order_id}">{r.order.number}</a>{/if}{#if r.coupon_code} · codice {r.coupon_code}{/if}</span>
			</div>
			{#if r.title}<b>{r.title}</b>{/if}
			<div class="hd-msg__body" style="font-size:14px">{r.comment ?? '(senza testo)'}</div>
			<div class="toolbar" style="gap:6px">
				{#if r.status !== 'approved'}<form method="POST" action="?/stato" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="approved" /><button class="btn btn--green btn--xs" type="submit">✓ Pubblica</button></form>{/if}
				{#if r.status !== 'rejected'}<form method="POST" action="?/stato" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="rejected" /><button class="btn btn--ghost btn--xs" type="submit">Non pubblicare</button></form>{/if}
				{#if r.email}<a class="btn btn--ghost btn--xs" href="mailto:{r.email}?subject=La%20tua%20recensione%20su%20Stickerprint">✉ Rispondi al cliente</a>{/if}
				{#if r.source === 'staff'}<form method="POST" action="?/elimina" use:enhance><input type="hidden" name="id" value={r.id} /><button class="btn btn--ghost btn--xs" type="submit">🗑️</button></form>{/if}
			</div>
		</div>
	{:else}
		<div class="dcard" style="text-align:center;color:var(--muted)">Nessuna recensione qui.</div>
	{/each}
</div>
{/if}
