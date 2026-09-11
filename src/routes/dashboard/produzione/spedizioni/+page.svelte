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
	let sending = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	const ddtGroup = $derived(data.groups.find((g) => g.key === ddtPopup) ?? null);
	const ddtTotal = $derived(ddtGroup ? ddtGroup.items.reduce((s, i) => s + Number(i.unit_net ?? Number(i.total_net) / i.qty) * Number(ddtQty[i.id] ?? i.qty), 0) : 0);
	const mode = (g: G) => deliveryMode(g);
	/** scelta nella tendina: qapla (nostro corriere via Qapla'), direct, customer, oppure niente */
	const choice = (g: G): 'qapla' | 'direct' | 'customer' | '' => { const m = mode(g); if (m === 'direct') return 'direct'; if (m === 'customer') return 'customer'; return g.items[0].courier === 'Qapla' ? 'qapla' : ''; };
	const CHOICES: { id: 'qapla' | 'direct' | 'customer'; label: string; sub: string; logo?: string }[] = [
		{ id: 'qapla', label: 'Invia a Qapla', sub: 'nostro corriere · etichetta dal pannello Qapla', logo: COURIERS.Qapla.logo },
		{ id: 'direct', label: 'Consegna diretta', sub: 'consegniamo noi' },
		{ id: 'customer', label: 'Corriere cliente', sub: 'ritira il corriere del cliente' }
	];
	function openDdt(g: G) { ddtPopup = g.key; ddtParcels = g.items[0].parcels ?? 1; ddtWeight = null; ddtQty = Object.fromEntries(g.items.map((i) => [i.id, i.qty])); }
	function toggleRow(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	$effect(() => {
		// dopo la conclusione: scarica DDT ed etichette dei colli e chiudi il popup (se il browser blocca la finestra resta il link nel messaggio)
		if (form?.ok && form.labels) { try { window.open(form.labels, '_blank'); } catch { /* link nel messaggio */ } ddtPopup = null; }
	});
</script>

<svelte:head><title>In spedizione | Dashboard</title></svelte:head>

<div class="ship-head">
	<div><h1>🚀 In spedizione</h1><p class="lead">Per ogni ordine scegli dalla tendina: <b>Invia a Qapla</b> (l'ordine passa a Qapla, stampi l'etichetta dal pannello Qapla, il cliente riceve subito la nostra email "in attesa di ritiro" e poi gli aggiornamenti seguono lo stato del corriere), <b>Consegna diretta</b> o <b>Corriere cliente</b> (si concludono con <b>Concludi</b>: DDT ed etichette dei colli).</p></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.qapla}<p class="success">Ordine {form.qapla} inviato a Qapla{form.emailed ? ' · email "in attesa di ritiro" inviata al cliente' : ' · email non inviata'}. Ora stampa l'etichetta dal pannello Qapla (Etichette → Crea): tracking e stati arriveranno qui da soli.</p>{/if}
{#if form?.ok && form.ddt}<p class="success">DDT {form.ddt} creato: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ etichette dei colli</a>.</p>{/if}
{#if !data.qaplaOk}<p class="error">Qapla non è ancora collegato (manca QAPLA_API_KEY su Vercel): "Invia a Qapla" non funzionerà finché non viene impostata.</p>{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Ordine</th><th>File</th><th>Destinazione</th><th>Spedizione</th><th></th></tr></thead>
		<tbody>
			{#each data.groups as g (g.key)}
				{@const ship = g.items[0].shipping ?? {}}
				{@const f = g.items[0]}
				{@const c = choice(g)}
				<tr>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub"><b>{g.customer}</b></div><div class="osub">{dmy(g.created_at)} · {g.qty.toLocaleString('it-IT')} pz · {money(g.gross)} · {g.channel === 'manuale' ? '✏️ manuale' : '🛒 e-commerce'}</div></td>
					<td><ItemsCell items={g.items} size="lg" expanded={expanded.has(g.key)} ontoggle={() => toggleRow(g.key)} /></td>
					<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.street ?? ''}{ship.zip ? ` · ${ship.zip}` : ''}</div><div class="osub">{g.email}</div></td>
					<td>
						{#if g.status === 'pronto'}
							<div class="cmenu">
								<form method="POST" action="?/mode" use:enhance={() => async ({ update }) => { openMenu = null; await update(); }}>
									<input type="hidden" name="group" value={g.key} />
									<button type="button" class="cmenu__btn" class:is-set={!!c} onclick={() => (openMenu = openMenu === g.key ? null : g.key)} title="Scegli come spedire">
										{#if c === 'qapla'}<img src={COURIERS.Qapla.logo} alt="Qapla" />{:else if c}<span>{CHOICES.find((x) => x.id === c)?.label}</span>{:else}<span>Scegli spedizione</span>{/if}<i>▾</i>
									</button>
									{#if openMenu === g.key}
										<div class="cmenu__list">
											{#each CHOICES as x (x.id)}<button type="submit" name="mode" value={x.id} class:is-on={c === x.id}>{#if x.logo}<img src={x.logo} alt="" />{/if} {x.label}<small style="display:block;font-weight:500;color:var(--muted)">{x.sub}</small></button>{/each}
										</div>
									{/if}
								</form>
							</div>
						{:else}
							{#if f.courier === 'Qapla'}<img class="courier-logo" src={COURIERS.Qapla.logo} alt="Qapla" />{:else}<b>{mode(g) === 'direct' ? 'Consegna diretta SP' : mode(g) === 'customer' ? 'Corriere del cliente' : (f.courier ?? 'Corriere')}</b>{/if}
							<div class="osub"><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span></div>
							{#if f.courier === 'Qapla'}<div class="osub">{f.tracking_number ? `tracking ${f.tracking_number}` : 'in attesa di etichetta dal pannello Qapla'}{#if f.shipping_status} · {f.shipping_status}{/if}</div>{/if}
							{#if f.tracking_url}<div class="osub"><a class="link" href={f.tracking_url} target="_blank" rel="noopener">↗ tracking</a></div>{/if}
							{#if f.parcels}<div class="osub">{f.parcels} {f.parcels === 1 ? 'collo' : 'colli'}</div>{/if}
						{/if}
					</td>
					<td style="white-space:nowrap">
						{#if g.status === 'pronto'}
							{#if c === 'qapla'}
								<form method="POST" action="?/qapla" use:enhance={() => { sending = g.key; return async ({ update }) => { sending = null; await update(); }; }}><input type="hidden" name="group" value={g.key} /><button class="btn btn--blue btn--xs" type="submit" disabled={sending === g.key} title="Trasmette l'ordine a Qapla e avvisa il cliente">{sending === g.key ? '…' : '📦 Invia a Qapla'}</button></form>
							{:else if c}
								<button type="button" class="btn btn--green btn--xs" title="DDT ed etichette dei colli" onclick={() => openDdt(g)}>✓ Concludi</button>
							{:else}
								<span class="osub">scegli la spedizione</span>
							{/if}
						{:else}
							<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px">
								<input type="hidden" name="group" value={g.key} />
								{#if f.courier !== 'Qapla'}<button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>{/if}
								{#if f.ddt_id}<a class="btn btn--ghost btn--xs" href="/dashboard/produzione/spedizioni/etichette?ddt={f.ddt_id}&courier={encodeURIComponent(f.courier ?? '')}" target="_blank" title="Etichette dei colli">🏷️</a>{/if}
							</form>
						{/if}
					</td>
				</tr>
				{#if expanded.has(g.key)}
					{#each g.items as it (it.id)}
						<tr class="orow-sub"><td><span class="osub">{it.number}</span></td><td><div class="item-cell">{#if thumbOf(it)}<img src={thumbOf(it)} alt="" />{:else}<span class="thumb-ph" style="background:{CATS[it.product_slug]?.soft ?? '#eee'}"></span>{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td><td colspan="3">{it.qty.toLocaleString('it-IT')} pz · {money(Number(it.total_net))}</td></tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine da spedire.</td></tr>
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
