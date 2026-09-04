<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import OrderEditor from '$lib/components/dashboard/OrderEditor.svelte';
	import { ORDER_STATUS, PROD_STAGES, CATS, COUNTRIES, money, dmy, itemMeta, thumbOf, DEVICE_ICON, CHANNEL_ICON } from '$lib/dashboard/orders';
	import { draftFromGroup } from '$lib/dashboard/orderDraft';
	import { paymentLabel, paymentIcon } from '$lib/dashboard/payments';
	let { data, form } = $props();
	const g = $derived(data.group);
	let editing = $state(false);
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	const addr = (a: Record<string, string> | null) => a ? [a.company, [a.first_name, a.last_name].filter(Boolean).join(' '), [a.street, a.street2].filter(Boolean).join(', '), [a.zip, a.city, a.province ? `(${a.province})` : ''].filter(Boolean).join(' '), COUNTRIES[a.country]?.name ?? a.country].filter(Boolean) : [];
	const first = $derived(g.items[0]);
	const vat = $derived(g.gross - g.net);
	const terms = $derived(first.payment_terms ?? []);
	// dopo un salvataggio dall'editor si torna alla vista
	$effect(() => { if (form?.saved) { editing = false; invalidateAll(); } });
</script>

<svelte:head><title>Ordine {g.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/ordini">← Torna agli ordini</a></p>
{#if data.created}<p class="success">Ordine {data.created} creato.{#if data.mail} {data.mail}{/if}</p>{/if}
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}

{#if editing}
	<OrderEditor draft={draftFromGroup(g, data.methods)} methods={data.methods} codes={data.codes} contacts={data.contacts} supabase={data.supabase} mode="edit" {form} title="Modifica ordine {g.number}" oncancel={() => (editing = false)} />
{:else}
	<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
		<div>
			<h1>Ordine {g.number} <span class="st" style="background:{st(g.status).soft};color:{st(g.status).color};vertical-align:middle;font-size:12px">{st(g.status).label}</span></h1>
			<p class="lead">{dmy(g.created_at)} · {g.customer} · <span title={CHANNEL_ICON[g.channel]?.label}>{CHANNEL_ICON[g.channel]?.icon} {CHANNEL_ICON[g.channel]?.label}</span>{#if g.device} · {DEVICE_ICON[g.device]} da {g.device}{/if} · {COUNTRIES[g.country]?.flag ?? ''} {COUNTRIES[g.country]?.name ?? g.country}{#if g.express} · ⚡ Produzione express{/if}</p>
			<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
				<button type="button" class="btn btn--yellow btn--xs" onclick={() => (editing = true)}>✏️ Modifica</button>
				<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini/{g.key}/pdf" target="_blank" rel="noopener">⬇ PDF conferma d'ordine</a>
			</div>
		</div>
		<div style="display:grid;gap:8px;justify-items:end">
			<form method="POST" action="?/status" use:enhance class="dform" style="grid-template-columns:auto auto auto;gap:8px">
				<label>Stato<select name="status" value={g.status} class="sel-sm">{#each Object.entries(ORDER_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select></label>
				<label>Fase<select name="prod_stage" value={first.prod_stage ?? ''} class="sel-sm"><option value="">—</option>{#each Object.entries(PROD_STAGES) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select></label>
				<button class="btn btn--ghost btn--xs" type="submit">Aggiorna</button>
			</form>
			<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm('Eliminare questo ordine?')) e.preventDefault(); }}><button class="link-btn" type="submit" style="color:#b3261e">🗑️ Elimina ordine</button></form>
		</div>
	</div>

	<div class="grid3" style="grid-template-columns:1fr 1fr">
		<div class="dcard">
			<h3>👤 Cliente</h3>
			<p><b>{g.customer}</b><br />{#if g.email}<a class="link" href="mailto:{g.email}">{g.email}</a><br />{/if}{#if first.billing?.phone ?? first.shipping?.phone}{first.billing?.phone ?? first.shipping?.phone}{/if}</p>
			<div class="row2">
				<div><h4 class="h4">Fatturazione</h4><p class="small">{#each addr(first.billing) as l, k (k)}{l}<br />{/each}{#if first.billing?.vat}P.IVA {first.billing.vat}<br />{/if}{#if first.billing?.fiscal_code}C.F. {first.billing.fiscal_code}<br />{/if}{#if first.billing?.sdi}SDI {first.billing.sdi}{/if}</p></div>
				<div><h4 class="h4">Spedizione</h4><p class="small">{#each addr(first.shipping) as l, k (k)}{l}<br />{/each}</p></div>
			</div>
		</div>
		<div class="dcard">
			<h3>🚚 Spedizione e documenti</h3>
			<div class="sumrow"><span>Metodo</span><b>{g.shipping_method ?? 'Corriere espresso'}</b></div>
			<div class="sumrow"><span>Spedizione prevista</span><b>{dmy(g.delivery_date)}</b></div>
			{#if first.courier}<div class="sumrow"><span>Corriere</span><b>{first.courier}{#if first.parcels} · {first.parcels} {first.parcels === 1 ? 'collo' : 'colli'}{/if}</b></div>{/if}
			<form method="POST" action="?/tracking" use:enhance class="sumrow" style="align-items:center"><span>Tracking</span><span style="display:flex;gap:6px"><input name="tracking" class="sel-sm" style="max-width:220px" placeholder="link tracking" value={first.tracking_url ?? ''} /><button class="ibtn" type="submit" title="Salva">💾</button>{#if first.tracking_url}<a class="link" href={first.tracking_url} target="_blank" rel="noopener">↗</a>{/if}</span></form>
			{#if data.ddts.length}<div class="sumrow"><span>DDT</span><b>{#each data.ddts as d (d.id)}<a class="link" href="/dashboard/fatturazione/ddt/{d.id}/pdf" target="_blank">{d.number}</a> {/each}</b></div>{/if}
			{#if data.invoices.length}<div class="sumrow"><span>Fatture</span><b>{#each data.invoices as inv (inv.id)}<a class="link" href="/dashboard/fatturazione/fatture/{inv.id}">{inv.number}</a> · {money(Number(inv.amount_gross))} {/each}</b></div>{/if}
			<div class="sumrow"><span>Stato pagamento</span><b>{first.payment_status === 'paid' ? 'Pagato' : first.payment_status === 'test' ? 'Test (nessun addebito)' : 'In attesa'}</b></div>
			{#if first.internal_notes}<h4 class="h4">Note interne</h4><p class="small">{first.internal_notes}</p>{/if}
			{#if first.notes}<h4 class="h4">Note del cliente</h4><p class="small">{first.notes}</p>{/if}
		</div>
	</div>

	<div class="dcard">
		<h3>📦 Articoli e file</h3>
		<div class="items">
			{#each g.items as it (it.id)}
				{@const img = thumbOf(it)}
				<div class="oitem">
					<div class="oitem__file">
						{#if img}<img src={img} alt="Anteprima {it.product_name}" />{:else}<div class="oitem__nofile">Nessuna anteprima</div>{/if}
						<span class="oitem__tag">{it.auto_proof ? 'Prova automatica confermata dal cliente' : it.channel === 'manuale' ? 'Mockup' : 'In attesa di prova'}</span>
					</div>
					<div class="oitem__body">
						<div class="toolbar" style="justify-content:space-between">
							<div><b class="oid">{it.number}</b> · <b>{it.product_name}</b><div class="osub">{itemMeta(it)}{#if it.product_code} · codice {it.product_code}{/if}{#if it.lamination && it.lamination !== 'nessuna'} · laminazione {it.lamination}{/if}</div></div>
							<span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color}">{CATS[it.product_slug]?.name ?? it.product_slug}</span>
						</div>
						<div class="sumrow"><span>Quantità</span><b>{it.qty.toLocaleString('it-IT')} pz</b></div>
						<div class="sumrow"><span>Prezzo unitario</span><b>{money(Number(it.unit_net ?? Number(it.total_net) / it.qty))}</b></div>
						<div class="sumrow"><span>Imponibile</span><b>{money(Number(it.total_net))}</b></div>
						<div class="ofiles">
							{#if data.files[it.id]}<a class="btn btn--ghost btn--xs" href={data.files[it.id]} target="_blank" rel="noopener">1 · File originale del cliente</a>{:else}<span class="btn btn--ghost btn--xs is-off">1 · File originale: non presente</span>{/if}
							{#if it.proof_url ?? it.preview_url}<a class="btn btn--ghost btn--xs" href={it.proof_url ?? it.preview_url} target="_blank" rel="noopener" download>2 · File generato con tracciato di taglio</a>{:else}<span class="btn btn--ghost btn--xs is-off">2 · File generato: non disponibile</span>{/if}
							{#if it.imposition_url}<a class="btn btn--ghost btn--xs" href={it.imposition_url} target="_blank" rel="noopener">3 · Impaginato per la stampa</a>{:else}<span class="btn btn--ghost btn--xs is-off" title="La griglia di stampa arriva con il motore di produzione">3 · Impaginato: in arrivo</span>{/if}
							{#if it.mockup_url}<a class="btn btn--ghost btn--xs" href={it.mockup_url} target="_blank" rel="noopener">Mockup</a>{/if}
						</div>
						{#if g.items.length > 1}
							<form method="POST" action="?/status" use:enhance class="oitem__status">
								<input type="hidden" name="item" value={it.id} />
								<label>Stato<select name="status" value={it.status} class="sel-sm">{#each Object.entries(ORDER_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select></label>
								<label>Fase<select name="prod_stage" value={it.prod_stage ?? ''} class="sel-sm"><option value="">—</option>{#each Object.entries(PROD_STAGES) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select></label>
								<button class="btn btn--ghost btn--xs" type="submit">Salva</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="dcard">
		<h3>🧾 Riepilogo <span class="note">Compare nella conferma d'ordine in PDF</span></h3>
		<div class="riepilogo">
			<div>
				<div class="h4" style="margin-top:0">Scadenze di pagamento</div>
				{#if terms.length}
					<table class="dtable"><thead><tr><th>Metodo di pagamento</th><th>Scadenza</th><th style="text-align:right">Importo</th></tr></thead>
						<tbody>{#each terms as t, i (i)}<tr><td>{#if paymentIcon(t.method)}<img src={paymentIcon(t.method)} alt="" style="height:16px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(t.method)}</td><td>{dmy(t.due)}</td><td style="text-align:right"><b>{money(Number(t.amount))}</b></td></tr>{/each}</tbody></table>
				{:else}
					<div class="sumrow"><span>Metodo di pagamento</span><b>{#if paymentIcon(g.payment_method)}<img src={paymentIcon(g.payment_method)} alt="" style="height:18px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(g.payment_method)}</b></div>
				{/if}
			</div>
			<div class="tot-box">
				<div class="sumrow"><span>Imponibile</span><b>{money(g.net)}</b></div>
				<div class="sumrow"><span>IVA 22%</span><b>{money(vat)}</b></div>
				<div class="sumrow sumrow--tot"><span>Totale IVA inclusa</span><b>{money(g.gross)}</b></div>
			</div>
		</div>
		<div class="editor-actions" style="margin-top:14px">
			<form method="POST" action="?/confirm" use:enhance><button class="btn btn--blue" type="submit" disabled={!g.email} title={g.email ? '' : 'L’ordine non ha un’email'}>✉️ Invia conferma per email</button></form>
			<button type="button" class="btn btn--green" onclick={() => (editing = true)}>✏️ Modifica ordine</button>
		</div>
	</div>
{/if}
