<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, COURIERS, deliveryMode, dmy, money, itemMeta, thumbOf, CATS } from '$lib/dashboard/orders';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	type G = (typeof data.groups)[number];
	let ddtPopup = $state<string | null>(null);
	let ddtParcels = $state(1);
	let ddtWeight = $state<number | null>(null);
	let ddtQty = $state<Record<string, number>>({});
	let openMenu = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	const ddtGroup = $derived(data.groups.find((g) => g.key === ddtPopup) ?? null);
	const ddtTotal = $derived(ddtGroup ? ddtGroup.items.reduce((s, i) => s + Number(i.unit_net ?? Number(i.total_net) / i.qty) * Number(ddtQty[i.id] ?? i.qty), 0) : 0);
	const mode = (g: G) => deliveryMode(g);
	/** "Concludi" si attiva subito per consegna diretta e corriere del cliente; con il nostro corriere solo dopo la trasmissione */
	const canConclude = (g: G) => g.status === 'pronto' && (mode(g) !== 'ours' || !!(g.items[0].courier && g.items[0].transmitted_at));
	function openDdt(g: G) { ddtPopup = g.key; ddtParcels = g.items[0].parcels ?? 1; ddtWeight = null; ddtQty = Object.fromEntries(g.items.map((i) => [i.id, i.qty])); }
	function toggleRow(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	$effect(() => {
		// dopo trasmissione o conclusione: scarica le etichette e chiudi il popup (se il browser blocca la finestra resta il link nel messaggio)
		if (form?.ok && form.labels) { try { window.open(form.labels, '_blank'); } catch { /* link nel messaggio */ } ddtPopup = null; }
	});
</script>

<svelte:head><title>In spedizione | Dashboard</title></svelte:head>

<div class="ship-head">
	<div><h1>🚀 In spedizione</h1><p class="lead">Scegli il corriere dalla tendina. Nelle colonne: <b>Genera spedizioni</b> scarica in un unico PDF le etichette del corriere, poi <b>Trasmetti spedizioni</b> invia al corriere e scarica il MANIFEST da consegnare all'autista. Infine <b>Concludi</b>: DDT ed etichette dei colli. Consegna diretta e corriere del cliente si concludono subito.</p></div>
	<div class="ship-cols">
		{#each data.couriers as c (c.id)}
			<div class="ship-col" class:is-off={!c.today}>
				<img src={COURIERS[c.id].logo} alt={c.id} />
				<b class="ship-col__n">{c.today}</b>
				<span class="ship-col__cap">{c.today === 1 ? 'spedizione affidata oggi' : 'spedizioni affidate oggi'}{#if !c.configured}<br /><span title="Collega le API in Setup → Corrieri">senza API</span>{/if}</span>
				<form method="POST" action="?/labels" use:enhance><input type="hidden" name="courier" value={c.id} /><button class="btn btn--blue btn--xs" type="submit" disabled={!c.toGenerate.length} title={c.toGenerate.length ? 'Crea le spedizioni e scarica le etichette' : 'Nessuna spedizione da generare'}>🏷️ Genera spedizioni{#if c.toGenerate.length} ({c.toGenerate.length}){/if}</button></form>
				{#if c.toTransmit.length}
					<form method="POST" action="?/transmit" use:enhance><input type="hidden" name="courier" value={c.id} /><button class="btn btn--green btn--xs" type="submit" title="Invia al corriere e scarica il manifest">📤 Trasmetti spedizioni ({c.toTransmit.length})</button></form>
				{/if}
				{#if c.manifestId}<a class="link ship-col__link" href="/dashboard/produzione/spedizioni/manifest/{c.manifestId}" target="_blank">⬇ manifest di oggi</a>{/if}
			</div>
		{/each}
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.generated}<p class="success">{form.count} {form.count === 1 ? 'spedizione generata' : 'spedizioni generate'} per {form.generated}: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ etichette {form.generated}</a> (si aprono anche in una nuova scheda). Applica le etichette sui pacchi e poi "Trasmetti spedizioni".{#if form.warnings?.length}<br /><small>{form.warnings.join(' · ')}</small>{/if}</p>{/if}
{#if form?.ok && form.transmitted}<p class="success">{form.count} {form.count === 1 ? 'spedizione trasmessa' : 'spedizioni trasmesse'} a {form.transmitted} · manifest {form.manifest}: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ MANIFEST da consegnare all'autista</a>. Ora puoi concludere gli ordini.{#if form.warnings?.length}<br /><small>{form.warnings.join(' · ')}</small>{/if}</p>{/if}
{#if form?.ok && form.ddt}<p class="success">DDT {form.ddt} creato: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ etichette dei colli</a>.</p>{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>File</th><th>Ordine</th><th>Cliente</th><th>Destinazione</th><th>Spedizione</th><th>Stato</th><th>Tracking</th><th></th></tr></thead>
		<tbody>
			{#each data.groups as g (g.key)}
				{@const ship = g.items[0].shipping ?? {}}
				{@const f = g.items[0]}
				{@const m = mode(g)}
				<tr>
					<td><ItemsCell items={g.items} size="lg" expanded={expanded.has(g.key)} ontoggle={() => toggleRow(g.key)} /></td>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub">{dmy(g.created_at)} · {g.qty.toLocaleString('it-IT')} pz · {money(g.gross)}</div><div class="osub">{g.channel === 'manuale' ? '✏️ manuale' : '🛒 e-commerce'}{#if g.express} · ⚡ express{/if}</div></td>
					<td><b>{g.customer}</b><div class="osub">{g.email}</div></td>
					<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.street ?? ''}</div></td>
					<td>
						{#if m === 'direct'}<b>Consegna diretta SP</b>
						{:else if m === 'customer'}<b>Corriere del cliente</b><div class="osub">a carico del destinatario</div>
						{:else if g.status !== 'pronto'}
							{#if f.courier && COURIERS[f.courier]}<img class="courier-logo" src={COURIERS[f.courier].logo} alt={f.courier} />{:else}{f.courier ?? 'Corriere'}{/if}
						{:else}
							<div class="cmenu">
								<form method="POST" action="?/courier" use:enhance={() => async ({ update }) => { openMenu = null; await update(); }}>
									<input type="hidden" name="group" value={g.key} />
									<button type="button" class="cmenu__btn" class:is-set={!!f.courier} onclick={() => (openMenu = openMenu === g.key ? null : g.key)} title="Scegli il corriere">
										{#if f.courier && COURIERS[f.courier]}<img src={COURIERS[f.courier].logo} alt={f.courier} />{:else}<span>Scegli corriere</span>{/if}<i>▾</i>
									</button>
									{#if openMenu === g.key}
										<div class="cmenu__list">
											{#each Object.entries(COURIERS) as [k, c] (k)}<button type="submit" name="courier" value={k} class:is-on={f.courier === k}><img src={c.logo} alt="" /> {c.name}</button>{/each}
										</div>
									{/if}
								</form>
							</div>
							{#if f.courier}<div class="osub">{f.transmitted_at ? '✓ trasmessa' : f.labels_generated_at ? 'etichette pronte · da trasmettere' : 'da generare'}{#if f.tracking_number} · {f.tracking_number}{/if}</div>{/if}
						{/if}
						{#if f.parcels && g.status !== 'pronto'}<div class="osub">{f.parcels} {f.parcels === 1 ? 'collo' : 'colli'}</div>{/if}
					</td>
					<td><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span></td>
					<td>
						<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px;align-items:center">
							<input type="hidden" name="group" value={g.key} /><input type="hidden" name="status" value={g.status} />
							<input name="tracking" class="sel-sm" style="max-width:180px" placeholder="link tracking" value={f.tracking_url ?? ''} /><button class="ibtn" type="submit" title="Salva tracking">💾</button>
						</form>
					</td>
					<td style="white-space:nowrap">
						{#if g.status === 'pronto'}
							<button type="button" class="btn btn--green btn--xs" disabled={!canConclude(g)} title={canConclude(g) ? 'DDT ed etichette dei colli' : 'Scegli il corriere e trasmetti la spedizione'} onclick={() => openDdt(g)}>✓ Concludi</button>
							{#if f.courier && f.labels_generated_at}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?groups={g.key}&courier={f.courier}&day=1" target="_blank" title="Etichetta di spedizione">🏷️</a>{/if}
						{:else}
							<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px">
								<input type="hidden" name="group" value={g.key} />
								{#if g.status === 'in_spedizione' || g.status === 'spedito'}<button class="btn btn--ghost btn--xs" type="submit" name="status" value="in_consegna">In consegna</button>{/if}
								<button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>
								{#if f.ddt_id}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?ddt={f.ddt_id}&courier={encodeURIComponent(f.courier ?? '')}" target="_blank" title="Etichette dei colli">🏷️</a>{/if}
							</form>
						{/if}
					</td>
				</tr>
				{#if expanded.has(g.key)}
					{#each g.items as it (it.id)}
						<tr class="orow-sub"><td><div class="item-cell">{#if thumbOf(it)}<img src={thumbOf(it)} alt="" />{:else}<span class="thumb-ph" style="background:{CATS[it.product_slug]?.soft ?? '#eee'}"></span>{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td><td><span class="osub">{it.number}</span></td><td colspan="6">{it.qty.toLocaleString('it-IT')} pz · {money(Number(it.total_net))}</td></tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine da spedire.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if ddtPopup && ddtGroup}
	{@const m = mode(ddtGroup)}
	{@const c = ddtGroup.items[0].courier ?? ''}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>Concludi l'ordine {ddtGroup.number} · {ddtGroup.customer}</h3>
		<p class="note">Controlla le voci: puoi cambiare solo le quantità (es. ordinate 1.000, prodotte 1.200). Importi e fattura seguiranno le quantità consegnate.</p>
		<form method="POST" action="?/ddt" use:enhance style="display:grid;gap:12px">
			<input type="hidden" name="group" value={ddtPopup} />
			<input type="hidden" name="qtys" value={JSON.stringify(ddtQty)} />
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
				<div><span class="osub">Trasporto</span><br />
					{#if m === 'direct'}<b>Consegna diretta Stickerprint</b>
					{:else if m === 'customer'}<b>Corriere a carico del destinatario</b><div class="osub">ritira il corriere del cliente</div>
					{:else}<b style="display:flex;align-items:center;gap:8px">{#if COURIERS[c]}<img class="courier-logo" src={COURIERS[c].logo} alt={c} />{/if}Corriere a carico del mittente · {c}</b><div class="osub">spedizione trasmessa il {dmy(ddtGroup.items[0].transmitted_at ?? null)}</div>{/if}
				</div>
			</div>
			<p class="note">Il DDT prende il prossimo numero SPD (Fatturazione → DDT){ddtGroup.channel === 'manuale' ? ' e sarà da fatturare' : ' (ordine e-commerce già fatturato)'}; le etichette dei colli, una per collo, si scaricano subito.</p>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (ddtPopup = null)}>Annulla</button><button class="btn btn--green" type="submit">Genera DDT ed etichette</button></div>
		</form>
	</div></div>
{/if}
