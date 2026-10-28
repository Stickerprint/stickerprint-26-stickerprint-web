<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, money, dmy } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const p = $derived(data.p);
	const c = $derived(data.contact);
	const lv = $derived(data.loyalty?.loyalty_levels as { name: string; credit_rate: number } | null);
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	const title = $derived(p ? (p.full_name || p.email) : (c?.name ?? ''));
</script>

<svelte:head><title>{title} | Clienti</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/anagrafica/clienti">← Anagrafica clienti</a></p>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Anagrafica aggiornata.</p>{/if}
<div class="toolbar" style="justify-content:space-between">
	<div><h1>{title}</h1>
		{#if p}<p class="lead">{p.customer_type === 'azienda' ? '🏢 Azienda' : '👤 Privato'} · cliente registrato dal {dmy(p.created_at)} · <a class="link" href="mailto:{p.email}">{p.email}</a>{#if p.phone} · {p.phone}{/if}</p>
		{:else if c}<p class="lead">{c.kind === 'azienda' || c.vat ? '🏢 Azienda' : '👤 Privato'} · in anagrafica dal {dmy(c.created_at)}{#if c.email} · <a class="link" href="mailto:{c.email}">{c.email}</a>{/if}{#if c.phone} · {c.phone}{/if}</p>{/if}
	</div>
	{#if lv}<div class="dcard" style="display:flex;gap:10px;align-items:center;padding:10px 14px"><img src="/images/loyalty/{data.loyalty?.level}.webp" alt="" style="width:40px;height:40px" /><div><b>{lv.name}</b><div class="osub">{Math.round(lv.credit_rate * 100)}% di credito · {data.loyalty?.period_points} SP nel periodo</div></div></div>{/if}
</div>

<div class="stats5" style="grid-template-columns:repeat(3,1fr)">
	<div class="dcard stat5"><span class="ico" style="background:#e5f0ff">📦</span><div><small>Ordini</small><b>{data.groups.length}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcfce7">💶</span><div><small>Speso in totale (netto)</small><b>{money(data.spent)}</b></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#fef6db">📊</span><div><small>Spesa media</small><b>{money(data.avg)}</b></div></div>
</div>

<div class="grid3">
	<div class="dcard">
		{#if p}
			<h3>Dati fiscali</h3>
			<div class="sumrow"><span>Azienda</span><b>{p.company_name ?? '—'}</b></div>
			<div class="sumrow"><span>P.IVA</span><b>{p.vat_number ?? '—'}</b></div>
			<div class="sumrow"><span>Codice fiscale</span><b>{p.fiscal_code ?? '—'}</b></div>
			<div class="sumrow"><span>SDI / PEC</span><b>{p.sdi_code ?? '—'} {p.pec ? '· ' + p.pec : ''}</b></div>
			{#each data.addresses as a (a.id)}<div class="sumrow"><span>{a.kind === 'billing' ? 'Fatturazione' : 'Spedizione'}</span><b style="text-align:right">{a.street}, {a.zip} {a.city} ({a.province})</b></div>{/each}
		{:else if c}
			<h3>Anagrafica <span class="note">modificabile</span></h3>
			<form method="POST" action="?/update" use:enhance class="dform dform--1">
				<label>Cliente / ragione sociale<input name="name" value={c.name} required /></label>
				<div class="row2"><label>Nome<input name="first_name" value={c.first_name ?? ''} /></label><label>Cognome<input name="last_name" value={c.last_name ?? ''} /></label></div>
				<label>Indirizzo<input name="address" value={c.street ?? ''} /></label>
				<div class="row3"><label>Comune<input name="city" value={c.city ?? ''} /></label><label>CAP<input name="cap" value={c.zip ?? ''} /></label><label>Prov.<input name="province" value={c.province ?? ''} maxlength="2" /></label></div>
				<label>Paese<select name="country" value={c.country ?? 'IT'}>{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k}>{v.flag} {v.name}</option>{/each}</select></label>
				<div class="row2"><label>Partita IVA<input name="piva" value={c.vat ?? ''} /></label><label>Codice fiscale<input name="cf" value={c.fiscal_code ?? ''} /></label></div>
				<div class="row2"><label>Codice SDI<input name="sdi" value={c.sdi ?? ''} maxlength="7" /></label><label>PEC<input name="pec" value={c.pec ?? ''} type="email" /></label></div>
				<div class="row2"><label>Email<input name="email" value={c.email ?? ''} type="email" /></label><label>Telefono<input name="phone" value={c.phone ?? ''} /></label></div>
				<label>Note<textarea name="notes" rows="2">{c.notes ?? ''}</textarea></label>
				<div style="display:flex;gap:8px;justify-content:space-between"><button class="btn btn--green btn--xs" type="submit">💾 Salva</button><button class="link-btn" type="submit" formaction="?/delete" style="color:#b3261e" onclick={(e) => { if (!confirm('Eliminare questa anagrafica?')) e.preventDefault(); }}>🗑️ Elimina</button></div>
			</form>
		{/if}
	</div>
	<div class="dcard">
		<h3>Area personale</h3>
		{#if p}<p class="osub" style="margin:0 0 8px">Account registrato dal {dmy(p.created_at)}. Se il cliente non riesce a entrare: confermo l'email, collego gli ordini fatti da ospite e gli mando il link per scegliere la password.</p>
		{:else}<p class="osub" style="margin:0 0 8px">Il cliente non ha un account. Lo creo io con la sua email, collego gli ordini già fatti e gli mando il link per scegliere la password.</p>{/if}
		{#if form?.area}
			<p class="success" style="margin:0 0 8px">
				{form.area.esisteva ? 'Account già esistente' : 'Account creato'}{form.area.confermataOra ? ', email confermata ora' : ''} ·
				{form.area.ordiniCollegati} ordini e {form.area.fattureCollegate} fatture collegati ·
				{form.area.emailInviata ? 'email con il link inviata ✓' : `email NON inviata: ${form.area.erroreEmail}`}
			</p>
		{/if}
		<form method="POST" use:enhance class="dform dform--1">
			<label>Altre email dello stesso cliente <span class="note">facoltativo, es. indirizzo con refuso: i suoi ordini passano a questo account</span><input name="altre_email" placeholder="nome@gmai.com, altro@esempio.it" /></label>
			<div style="display:flex;gap:8px;flex-wrap:wrap">
				<button class="btn btn--xs" type="submit" formaction="?/areaAnteprima">👁 Anteprima email</button>
				<button class="btn btn--green btn--xs" type="submit" formaction="?/areaCrea">{p ? '🔑 Manda il link password e collega gli ordini' : '🔑 Crea area personale e manda il link'}</button>
			</div>
		</form>
		{#if p && data.groups.length === 0 && data.invoices.length === 0 && p.role === 'customer'}
			<form method="POST" action="?/eliminaAccount" use:enhance style="margin-top:10px">
				<button class="link-btn" type="submit" style="color:#b3261e" onclick={(e) => { if (!confirm(`Eliminare l'account ${p.email}? Non ha ordini né fatture.`)) e.preventDefault(); }}>🗑️ Elimina questo account (nessun ordine, es. doppione con email sbagliata)</button>
			</form>
		{/if}
		{#if form?.anteprima}
			<p class="osub" style="margin:12px 0 4px">A: {form.anteprima.to} · Oggetto: <b>{form.anteprima.subject}</b></p>
			<iframe title="Anteprima email" srcdoc={form.anteprima.html} style="width:100%;height:640px;border:1px solid #e5e7eb;border-radius:10px;background:#f4f5fa"></iframe>
		{/if}
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
			<div class="sumrow"><span><a class="oid" href="/dashboard/fatturazione/fatture/{inv.id}">{inv.number}</a> <span class="osub">{dmy(inv.issued_at)}</span></span><b>{money(Number(inv.amount_gross))}</b></div>
		{:else}<p style="color:var(--muted);font-size:13px">Nessuna fattura.</p>{/each}
	</div>
</div>
