<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, dmy, money, itemMeta, thumbOf, CATS } from '$lib/dashboard/orders';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	let selected = $state<Set<string>>(new Set());
	let courierPopup = $state(false);
	let courier = $state('GLS');
	let parcels = $state(1);
	let ddtPopup = $state<string | null>(null);
	let ddtParcels = $state(1);
	let ddtWeight = $state<number | null>(null);
	let ddtQty = $state<Record<string, number>>({});
	let ddtCourier = $state('GLS');
	const ddtGroup = $derived(data.groups.find((g) => g.key === ddtPopup) ?? null);
	const ddtTotal = $derived(ddtGroup ? ddtGroup.items.reduce((s, i) => s + Number(i.unit_net ?? Number(i.total_net) / i.qty) * Number(ddtQty[i.id] ?? i.qty), 0) : 0);
	const ready = $derived(data.groups.filter((g) => g.status === 'pronto'));
	const isDirect = (g: (typeof data.groups)[number]) => /diretta/i.test(g.shipping_method ?? '');
	const selectableAll = $derived(ready.filter((g) => g.channel !== 'manuale').map((g) => g.key));
	function openDdt(g: (typeof data.groups)[number]) { ddtPopup = g.key; ddtParcels = 1; ddtWeight = null; ddtQty = Object.fromEntries(g.items.map((i) => [i.id, i.qty])); ddtCourier = 'GLS'; }
	function toggle(k: string) { const s = new Set(selected); s.has(k) ? s.delete(k) : s.add(k); selected = s; }
	function toggleAll() { selected = selected.size === selectableAll.length ? new Set() : new Set(selectableAll); }
	let expanded = $state<Set<string>>(new Set());
	function toggleRow(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	$effect(() => {
		// dopo la creazione: scarica le etichette e chiudi i popup (se il browser blocca la finestra resta il link nel messaggio)
		if (form?.ok && form.labels) { try { window.open(form.labels, '_blank'); } catch { /* link nel messaggio */ } courierPopup = false; ddtPopup = null; selected = new Set(); }
	});
</script>

<svelte:head><title>In spedizione | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>🚀 In spedizione</h1><p class="lead">Seleziona gli ordini pronti e crea la spedizione: scegli il corriere e scarichi subito le etichette 10×15. Le consegne dirette generano il DDT.</p></div>
	<button type="button" class="btn btn--green" disabled={selected.size === 0} onclick={() => (courierPopup = true)}>📦 Crea spedizione ({selected.size})</button>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.labels}<p class="success">{#if form.ddt}DDT {form.ddt} creato. {/if}Spedizione pronta: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ scarica le etichette 10×15</a> (si aprono anche in una nuova scheda).</p>{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th><input type="checkbox" checked={selected.size > 0 && selected.size === selectableAll.length} onchange={toggleAll} title="Seleziona tutti i pronti" /></th><th>File</th><th>Ordine</th><th>Cliente</th><th>Destinazione</th><th>Spedizione</th><th>Stato</th><th>Tracking</th><th></th></tr></thead>
		<tbody>
			{#each data.groups as g (g.key)}
				{@const ship = g.items[0].shipping ?? {}}
				{@const f = g.items[0]}
				<tr>
					<td>{#if g.status === 'pronto' && g.channel !== 'manuale'}<input type="checkbox" checked={selected.has(g.key)} onchange={() => toggle(g.key)} />{/if}</td>
					<td><ItemsCell items={g.items} size="lg" expanded={expanded.has(g.key)} ontoggle={() => toggleRow(g.key)} /></td>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub">{dmy(g.created_at)} · {g.qty.toLocaleString('it-IT')} pz · {money(g.gross)}</div></td>
					<td><b>{g.customer}</b><div class="osub">{g.email}</div></td>
					<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.street ?? ''}</div></td>
					<td>{#if isDirect(g)}<b>Consegna diretta SP</b>{:else}{g.items[0].courier ?? g.shipping_method ?? 'Corriere'}{/if}{#if g.items[0].parcels}<div class="osub">{g.items[0].parcels} {g.items[0].parcels === 1 ? 'collo' : 'colli'}</div>{/if}{#if g.express}<div class="osub">⚡ express</div>{/if}</td>
					<td><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span></td>
					<td>
						<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px;align-items:center">
							<input type="hidden" name="group" value={g.key} /><input type="hidden" name="status" value={g.status} />
							<input name="tracking" class="sel-sm" style="max-width:180px" placeholder="link tracking" value={f.tracking_url ?? ''} /><button class="ibtn" type="submit" title="Salva tracking">💾</button>
						</form>
					</td>
					<td>
						{#if g.status === 'pronto' && g.channel === 'manuale'}
							<button type="button" class="btn btn--green btn--xs" onclick={() => openDdt(g)}>✓ Spedito → DDT</button>
						{:else}
							<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px">
								<input type="hidden" name="group" value={g.key} />
								{#if g.status === 'pronto'}<button class="btn btn--ghost btn--xs" type="submit" name="status" value="spedito">✓ Spedito</button>
								{:else if g.status === 'in_spedizione' || g.status === 'spedito'}<button class="btn btn--ghost btn--xs" type="submit" name="status" value="in_consegna">In consegna</button><button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>
								{:else}<button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>{/if}
								{#if g.items[0].courier && g.items[0].courier !== 'Consegna diretta'}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?groups={g.key}&courier={g.items[0].courier}" target="_blank">🏷️</a>{/if}
								{#if g.items[0].ddt_id}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?ddt={g.items[0].ddt_id}" target="_blank">🏷️</a>{/if}
							</form>
						{/if}
					</td>
				</tr>
				{#if expanded.has(g.key)}
					{#each g.items as it (it.id)}
						<tr class="orow-sub"><td></td><td><div class="item-cell">{#if thumbOf(it)}<img src={thumbOf(it)} alt="" />{:else}<span class="thumb-ph" style="background:{CATS[it.product_slug]?.soft ?? '#eee'}"></span>{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td><td><span class="osub">{it.number}</span></td><td colspan="6">{it.qty.toLocaleString('it-IT')} pz · {money(Number(it.total_net))}</td></tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine da spedire.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if courierPopup}
	<div class="dmodal-bg"><div class="dmodal dmodal--sm">
		<h3>Con quale corriere?</h3>
		<form method="POST" action="?/ship" use:enhance style="display:grid;gap:12px">
			<input type="hidden" name="groups" value={[...selected].join(',')} />
			<div class="courier-opts">
				{#each ['GLS', 'FedEx', 'TNT'] as c (c)}<label class:is-on={courier === c}><input type="radio" name="courier" value={c} bind:group={courier} /> {c}</label>{/each}
			</div>
			<label style="font-size:13px;font-weight:700">Colli per ordine <input type="number" name="parcels" min="1" bind:value={parcels} class="sel-sm" style="width:80px;margin-left:8px" /></label>
			<p class="note">Le etichette (una per collo) si scaricano in PDF 10×15 per la Zebra. La trasmissione al corriere arriva con l'integrazione delle sue API.</p>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (courierPopup = false)}>Annulla</button><button class="btn btn--green" type="submit">Crea spedizione e scarica etichette</button></div>
		</form>
	</div></div>
{/if}
{#if ddtPopup && ddtGroup}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>DDT per l'ordine {ddtGroup.number} · {ddtGroup.customer}</h3>
		<p class="note">Controlla le voci: puoi cambiare solo le quantità (es. ordinate 1.000, prodotte 1.200). Importi e fattura seguiranno le quantità consegnate.</p>
		<form method="POST" action="?/ddt" use:enhance style="display:grid;gap:12px">
			<input type="hidden" name="group" value={ddtPopup} />
			<input type="hidden" name="qtys" value={JSON.stringify(ddtQty)} />
			{#if !isDirect(ddtGroup)}<input type="hidden" name="courier" value={ddtCourier} />{/if}
			<div class="tscroll"><table class="dtable">
				<thead><tr><th>Articolo</th><th>Q.tà ordinata</th><th>Q.tà consegnata</th><th>Prezzo unit.</th><th style="text-align:right">Imponibile</th></tr></thead>
				<tbody>
					{#each ddtGroup.items as it (it.id)}
						{@const unit = Number(it.unit_net ?? Number(it.total_net) / it.qty)}
						<tr>
							<td><div class="item-cell">{#if thumbOf(it)}<img src={thumbOf(it)} alt="" />{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td>
							<td>{it.qty.toLocaleString('it-IT')}</td>
							<td><input type="number" min="1" class="sel-sm" style="width:100px" bind:value={ddtQty[it.id]} /></td>
							<td>{money(unit)}</td>
							<td style="text-align:right"><b>{money(unit * Number(ddtQty[it.id] ?? it.qty))}</b></td>
						</tr>
					{/each}
				</tbody>
				<tfoot><tr><td colspan="4"><b>Imponibile</b> · IVA {money(ddtTotal * 0.22)} · totale {money(ddtTotal * 1.22)}</td><td style="text-align:right"><b>{money(ddtTotal)}</b></td></tr></tfoot>
			</table></div>
			<div class="row3" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)">
				<label>Colli<input type="number" name="parcels" min="1" bind:value={ddtParcels} /></label>
				<label>Peso (kg)<input type="number" name="weight" step="0.1" min="0" bind:value={ddtWeight} placeholder="es. 2.4" /></label>
				{#if isDirect(ddtGroup)}
					<div><span class="osub">Trasporto</span><br /><b>Consegna diretta Stickerprint</b></div>
				{:else}
					<div><span class="osub">Trasporto: {ddtGroup.shipping_method}</span><div class="courier-opts" style="margin-top:6px">{#each ['GLS', 'FedEx', 'TNT'] as c (c)}<label class:is-on={ddtCourier === c} style="padding:8px"><input type="radio" value={c} bind:group={ddtCourier} /> {c}</label>{/each}</div></div>
				{/if}
			</div>
			<p class="note">Il DDT prende il prossimo numero SPD (Fatturazione → DDT) e le etichette 10×15, una per collo, si scaricano subito.</p>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (ddtPopup = null)}>Annulla</button><button class="btn btn--green" type="submit">Genera DDT ed etichette</button></div>
		</form>
	</div></div>
{/if}

