<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, PROD_STAGES, CATS, COUNTRIES, money, dmy, itemMeta } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const g = $derived(data.group);
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	const addr = (a: Record<string, string> | null) => a ? [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' '), COUNTRIES[a.country]?.name ?? a.country].filter(Boolean) : [];
	const first = $derived(g.items[0]);
	const vat = $derived(g.gross - g.net);
	const discount = $derived(g.items.reduce((s, i) => s + Number(i.discount_amount), 0));
	const credit = $derived(g.items.reduce((s, i) => s + Number(i.credit_used), 0));
</script>

<svelte:head><title>Ordine {g.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/produzione/ordini">← Torna agli ordini</a></p>
{#if data.created}<p class="success">Ordine {data.created} creato.</p>{/if}
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Salvato.</p>{/if}

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div>
		<h1>Ordine {g.number} <span class="st" style="background:{st(g.status).soft};color:{st(g.status).color};vertical-align:middle;font-size:12px">{st(g.status).label}</span></h1>
		<p class="lead">{dmy(g.created_at)} · {g.customer} · <span class="chan chan--{g.channel}">{g.channel === 'manuale' ? '✍️ Manuale' : '🛒 E-commerce'}</span> · {COUNTRIES[g.country]?.flag ?? ''} {COUNTRIES[g.country]?.name ?? g.country}{#if g.express} · ⚡ Produzione express{/if}</p>
	</div>
	<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm('Eliminare questo ordine?')) e.preventDefault(); }}><button class="btn btn--ghost btn--xs" type="submit">🗑️ Elimina ordine</button></form>
</div>

<div class="grid3">
	<div class="dcard">
		<h3>👤 Cliente</h3>
		<p><b>{g.customer}</b><br />{#if g.email}<a class="link" href="mailto:{g.email}">{g.email}</a><br />{/if}{#if first.shipping?.phone}{first.shipping.phone}{/if}</p>
		<h4 class="h4">Fatturazione</h4>
		<p class="small">{#each addr(first.billing) as l, k (k)}{l}<br />{/each}{#if first.billing?.vat}P.IVA {first.billing.vat}<br />{/if}{#if first.billing?.fiscal_code}C.F. {first.billing.fiscal_code}<br />{/if}{#if first.billing?.sdi}SDI {first.billing.sdi}{/if}</p>
		<h4 class="h4">Spedizione</h4>
		<p class="small">{#each addr(first.shipping) as l, k (k)}{l}<br />{/each}</p>
	</div>
	<div class="dcard">
		<h3>💳 Pagamento e spedizione</h3>
		<div class="sumrow"><span>Metodo di pagamento</span><b>{g.payment_method ?? '—'}</b></div>
		<div class="sumrow"><span>Stato pagamento</span><b>{first.payment_status === 'paid' ? 'Pagato' : first.payment_status === 'test' ? 'Test (nessun addebito)' : 'In attesa'}</b></div>
		<div class="sumrow"><span>Spedizione</span><b>{g.shipping_method ?? 'Corriere espresso'}</b></div>
		<div class="sumrow"><span>Spedizione prevista</span><b>{dmy(g.delivery_date)}</b></div>
		{#if first.tracking_url}<div class="sumrow"><span>Tracking</span><a class="link" href={first.tracking_url} target="_blank" rel="noopener">apri ↗</a></div>{/if}
		{#if data.invoices.length}<h4 class="h4">Fatture</h4>{#each data.invoices as inv (inv.id)}<div class="sumrow"><span>{inv.number} · {dmy(inv.issued_at)}</span><b>{money(Number(inv.amount_gross))}</b></div>{/each}{/if}
		<form method="POST" action="?/tracking" use:enhance class="dform dform--1" style="margin-top:12px">
			<label>Link tracking<input name="tracking" value={first.tracking_url ?? ''} placeholder="https://…" /></label>
			<label>Spedizione prevista<input name="delivery_date" type="date" value={g.delivery_date ?? ''} /></label>
			<label>Note interne<textarea name="internal_notes" rows="2">{first.internal_notes ?? ''}</textarea></label>
			<div><button class="btn btn--ghost btn--xs" type="submit">Salva</button></div>
		</form>
	</div>
	<div class="dcard">
		<h3>🧾 Totali</h3>
		<div class="sumrow"><span>Imponibile</span><b>{money(g.net)}</b></div>
		<div class="sumrow"><span>IVA 22%</span><b>{money(vat)}</b></div>
		{#if discount > 0}<div class="sumrow"><span>Sconto {first.discount_code ?? ''}</span><b>−{money(discount)}</b></div>{/if}
		{#if credit > 0}<div class="sumrow"><span>Credito Stickerprint usato</span><b>−{money(credit)}</b></div>{/if}
		<div class="sumrow sumrow--tot"><span>Totale</span><b>{money(g.gross)}</b></div>
		{#if g.paid}<div class="sumrow"><span>Pagato</span><b>{money(g.paid)}</b></div>{/if}
		{#if first.notes}<h4 class="h4">Note del cliente</h4><p class="small">{first.notes}</p>{/if}
		<h4 class="h4">Stato ordine</h4>
		<form method="POST" action="?/status" use:enhance class="dform" style="grid-template-columns:1fr 1fr auto">
			<label>Stato<select name="status" value={g.status}>{#each Object.entries(ORDER_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select></label>
			<label>Fase produzione<select name="prod_stage" value={first.prod_stage ?? ''}><option value="">—</option>{#each Object.entries(PROD_STAGES) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select></label>
			<button class="btn btn--green btn--xs" type="submit">Aggiorna</button>
		</form>
	</div>
</div>

<div class="dcard" style="overflow-x:auto">
	<h3>📦 Articoli</h3>
	<table class="dtable">
		<thead><tr><th>N.</th><th>Articolo</th><th>Categoria</th>{#if g.channel === 'manuale'}<th>Codice</th><th>Laminazione</th>{/if}<th>Q.tà</th><th>Prezzo unit.</th><th>Imponibile</th><th>Stato</th><th>File</th></tr></thead>
		<tbody>
			{#each g.items as it (it.id)}
				<tr>
					<td>{it.number}</td>
					<td><div class="item-cell">{#if it.preview_url || it.mockup_url}<img src={it.mockup_url ?? it.preview_url} alt="" />{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td>
					<td><span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color}">{CATS[it.product_slug]?.name ?? it.product_slug}</span></td>
					{#if g.channel === 'manuale'}<td>{it.product_code ?? '—'}</td><td>{it.lamination ?? '—'}</td>{/if}
					<td>{it.qty.toLocaleString('it-IT')} pz</td>
					<td>{money(Number(it.unit_net ?? Number(it.total_net) / it.qty))}</td>
					<td><b>{money(Number(it.total_net))}</b></td>
					<td>
						<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px;align-items:center">
							<input type="hidden" name="item" value={it.id} />
							<select name="status" value={it.status} class="sel-sm">{#each Object.entries(ORDER_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select>
							<select name="prod_stage" value={it.prod_stage ?? ''} class="sel-sm"><option value="">—</option>{#each Object.entries(PROD_STAGES) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
							<button class="ibtn" type="submit" title="Salva">💾</button>
						</form>
					</td>
					<td>{#if data.files[it.id]}<a class="btn btn--ghost btn--xs" href={data.files[it.id]} target="_blank" rel="noopener">⬇ File cliente</a>{:else if it.mockup_url}<a class="btn btn--ghost btn--xs" href={it.mockup_url} target="_blank" rel="noopener">⬇ Mockup</a>{:else}<span class="osub">—</span>{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
