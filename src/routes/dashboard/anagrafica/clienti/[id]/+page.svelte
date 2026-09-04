<script lang="ts">
	import { ORDER_STATUS, money, dmy } from '$lib/dashboard/orders';
	let { data } = $props();
	const p = $derived(data.p);
	const lv = $derived(data.loyalty?.loyalty_levels as { name: string; credit_rate: number } | null);
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
</script>

<svelte:head><title>{p.full_name || p.email} | Clienti</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/anagrafica/clienti">← Anagrafica clienti</a></p>
<div class="toolbar" style="justify-content:space-between">
	<div><h1>{p.full_name || p.email}</h1><p class="lead">{p.customer_type === 'azienda' ? '🏢 Azienda' : '👤 Privato'} · cliente dal {dmy(p.created_at)} · <a class="link" href="mailto:{p.email}">{p.email}</a>{#if p.phone} · {p.phone}{/if}</p></div>
	{#if lv}<div class="dcard" style="display:flex;gap:10px;align-items:center;padding:10px 14px"><img src="/images/loyalty/{data.loyalty?.level}.png" alt="" style="width:40px;height:40px" /><div><b>{lv.name}</b><div class="osub">{Math.round(lv.credit_rate * 100)}% di credito · {data.loyalty?.period_points} SP nel periodo</div></div></div>{/if}
</div>

<div class="stats5" style="grid-template-columns:repeat(3,1fr)">
	<div class="dcard stat5"><span class="ico" style="background:#e5f0ff">📦</span><div><small>Ordini</small><b>{data.groups.length}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcfce7">💶</span><div><small>Speso in totale (netto)</small><b>{money(data.spent)}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#fef6db">📊</span><div><small>Spesa media</small><b>{money(data.avg)}</b></div></div>
</div>

<div class="grid3">
	<div class="dcard">
		<h3>Dati fiscali</h3>
		<div class="sumrow"><span>Azienda</span><b>{p.company_name ?? '—'}</b></div>
		<div class="sumrow"><span>P.IVA</span><b>{p.vat_number ?? '—'}</b></div>
		<div class="sumrow"><span>Codice fiscale</span><b>{p.fiscal_code ?? '—'}</b></div>
		<div class="sumrow"><span>SDI / PEC</span><b>{p.sdi_code ?? '—'} {p.pec ? '· ' + p.pec : ''}</b></div>
		{#each data.addresses as a (a.id)}<div class="sumrow"><span>{a.kind === 'billing' ? 'Fatturazione' : 'Spedizione'}</span><b style="text-align:right">{a.street}, {a.zip} {a.city} ({a.province})</b></div>{/each}
	</div>
	<div class="dcard">
		<h3>Ordini</h3>
		{#each data.groups as g (g.key)}
			<div class="sumrow"><span><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a> <span class="osub">{dmy(g.created_at)}</span></span><span><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span> <b>{money(g.net)}</b></span></div>
		{:else}<p style="color:var(--muted);font-size:13px">Nessun ordine.</p>{/each}
	</div>
	<div class="dcard">
		<h3>Fatture</h3>
		{#each data.invoices as inv (inv.id)}
			<div class="sumrow"><span><b>{inv.number}</b> <span class="osub">{dmy(inv.issued_at)}</span></span><b>{money(Number(inv.amount_gross))}</b></div>
		{:else}<p style="color:var(--muted);font-size:13px">Nessuna fattura.</p>{/each}
	</div>
</div>
