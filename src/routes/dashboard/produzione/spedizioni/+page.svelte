<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, COURIERS, deliveryMode, dmy, money, itemMeta, thumbOf, CATS } from '$lib/dashboard/orders';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	type G = (typeof data.groups)[number];
	let ddtPopup = $state<string | null>(null);
	/* il popup serve a "Concludi" (consegna diretta, corriere cliente) e a "Invia a Qapla" per gli ordini manuali (serve il DDT) */
	let popupKind = $state<'ddt' | 'qapla'>('ddt');
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
	function openDdt(g: G, kind: 'ddt' | 'qapla' = 'ddt') { popupKind = kind; ddtPopup = g.key; ddtParcels = g.items[0].parcels ?? 1; ddtWeight = null; ddtQty = Object.fromEntries(g.items.map((i) => [i.id, i.qty])); }
	function toggleRow(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	$effect(() => {
		// dopo la conclusione: scarica DDT ed etichette dei colli e chiudi il popup (se il browser blocca la finestra resta il link nel messaggio)
		if (form?.ok && form.labels) { try { window.open(form.labels, '_blank'); } catch { /* link nel messaggio */ } ddtPopup = null; }
		else if (form?.ok) ddtPopup = null;
	});

	/* ---------- calendario degli ordini spediti ---------- */
	const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
	const monthLabel = $derived(`${MESI[Number(data.month.slice(5, 7)) - 1]} ${data.month.slice(0, 4)}`);
	const shiftMonth = (d: number) => { const [y, m] = data.month.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
	/** celle del mese, da lunedi': null = casella vuota prima del giorno 1 */
	const cells = $derived.by(() => {
		const [y, m] = data.month.split('-').map(Number);
		const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m, 0)).getUTCDate();
		return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${data.month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
	});
	const monthTotal = $derived(Object.values(data.days).reduce((a, b) => a + b, 0));
	const dayLabel = (d: string) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
	const dhm = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(d)) : '—');
	/** come e' partito l'ordine e cosa mostrare come stato */
	function shipInfo(g: G) {
		const f = g.items[0], m = mode(g);
		if (m === 'direct') return { how: 'Consegna diretta Stickerprint', sub: 'consegnato da noi', state: 'consegnato', detail: null as string | null };
		if (m === 'customer') return { how: 'Corriere del cliente', sub: 'ritirato dal corriere del cliente', state: g.status === 'consegnato' ? 'consegnato' : 'spedito', detail: null as string | null };
		const waiting = g.status === 'in_spedizione' && f.courier === 'Qapla';
		return { how: f.shipping_courier || (f.courier === 'Qapla' ? 'Qapla' : (f.courier ?? 'Corriere')), sub: f.tracking_number ? `tracking ${f.tracking_number}` : f.courier === 'Qapla' ? 'etichetta ancora da creare nel pannello Qapla' : f.legacy_id ? 'spedito dal vecchio sito' : '', state: g.status, detail: f.shipping_status ? [f.shipping_status, f.shipping_place].filter(Boolean).join(' · ') : (waiting ? 'In attesa del ritiro del corriere' : null) };
	}
	const problem = (g: G) => [5, 6, 8, 95].includes(Number(g.items[0].shipping_status_id));
</script>

<svelte:head><title>Spedizioni | Dashboard</title></svelte:head>

<div class="ship-head">
	<div><h1>🚀 Spedizioni</h1>
		<div class="tabs" style="margin-top:10px">
			<a class="tabbtn" class:is-active={data.view === 'da-spedire'} href="/dashboard/produzione/spedizioni">Da spedire <span class="tabbtn__n">{data.todoCount}</span></a>
			<a class="tabbtn" class:is-active={data.view === 'spediti'} href="/dashboard/produzione/spedizioni?vista=spediti">Ordini spediti</a>
		</div>
		{#if data.view === 'da-spedire'}
			<p class="lead" style="margin-top:12px">Qui arrivano gli ordini usciti dall'ultimo reparto. Per ognuno scegli dalla tendina: <b>Invia a Qapla</b> (nostro corriere: etichetta dal pannello Qapla, il cliente riceve l'email "in attesa di ritiro", poi spedito, in consegna e consegnato arrivano da soli), <b>Consegna diretta</b> (con Concludi l'ordine è <b>consegnato</b>) o <b>Corriere cliente</b> (con Concludi l'ordine è <b>spedito</b> e si chiude lì). Appena inviato o concluso, l'ordine esce da questa lista e lo ritrovi in <b>Ordini spediti</b>.</p>
		{:else}
			<p class="lead" style="margin-top:12px">Il calendario degli ordini partiti: clicca un giorno per vedere cosa è stato spedito, con quale corriere e a che punto è. Gli stati delle spedizioni Qapla si aggiornano da soli.</p>
		{/if}
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.qapla}<p class="success">Ordine {form.qapla} inviato a Qapla{form.emailed ? ' · email "in attesa di ritiro" inviata al cliente' : ' · email non inviata'}. Ora stampa l'etichetta dal pannello Qapla (Etichette → Crea): tracking e stati arrivano da soli in <a class="link" href="/dashboard/produzione/spedizioni?vista=spediti">Ordini spediti</a>.{#if form.ddt} DDT {form.ddt} creato: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ etichette dei colli</a>.{/if}</p>
{:else if form?.ok && form.ddt}<p class="success">DDT {form.ddt} creato, ordine {form.closed === 'consegnato' ? 'consegnato' : 'spedito'}: <a class="link" href={form.labels} target="_blank" rel="noopener">⬇ etichette dei colli</a>. Lo ritrovi in <a class="link" href="/dashboard/produzione/spedizioni?vista=spediti">Ordini spediti</a>.</p>{/if}
{#if !data.qaplaOk}<p class="error">Qapla non è ancora collegato (manca QAPLA_API_KEY su Vercel): "Invia a Qapla" non funzionerà finché non viene impostata.</p>{/if}

{#if data.view === 'da-spedire'}
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
							<div class="cmenu">
								<form method="POST" action="?/mode" use:enhance={() => async ({ update }) => { openMenu = null; await update(); }}>
									<input type="hidden" name="group" value={g.key} />
									<button type="button" class="cmenu__btn" class:is-set={!!c} onclick={() => (openMenu = openMenu === g.key ? null : g.key)} title="Scegli come spedire">
										{#if c === 'qapla'}<img src={COURIERS.Qapla.logo} alt="Qapla" />{:else if c}<span>{CHOICES.find((x) => x.id === c)?.label}</span>{:else}<span>Scegli spedizione</span>{/if}<i>▾</i>
									</button>
									{#if openMenu === g.key}
										<div class="cmenu__list">
											{#each CHOICES as x (x.id)}<button type="submit" name="mode" value={x.id} class:is-on={c === x.id} class="cmenu__opt">{#if x.logo}<img src={x.logo} alt="" />{/if}<span class="cmenu__txt"><b>{x.label}</b><small>{x.sub}</small></span></button>{/each}
										</div>
									{/if}
								</form>
							</div>
					</td>
					<td style="white-space:nowrap">
						{#if c === 'qapla'}
							{#if g.channel === 'manuale' && !f.ddt_id}
								<button type="button" class="btn btn--blue btn--xs" title="Colli, peso e quantità consegnate, poi DDT e invio a Qapla" onclick={() => openDdt(g, 'qapla')}>📦 Invia a Qapla</button>
							{:else}
								<form method="POST" action="?/qapla" use:enhance={() => { sending = g.key; return async ({ update }) => { sending = null; await update(); }; }}><input type="hidden" name="group" value={g.key} /><button class="btn btn--blue btn--xs" type="submit" disabled={sending === g.key} title="Trasmette l'ordine a Qapla e avvisa il cliente">{sending === g.key ? '…' : '📦 Invia a Qapla'}</button></form>
							{/if}
						{:else if c}
							<button type="button" class="btn btn--green btn--xs" title={c === 'direct' ? 'DDT ed etichette: l’ordine risulta consegnato' : 'DDT ed etichette: l’ordine risulta spedito'} onclick={() => openDdt(g)}>✓ Concludi</button>
						{:else}
							<span class="osub">scegli la spedizione</span>
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
{:else}
<div class="shipcal">
	<div class="dcard shipcal__cal">
		<div class="shipcal__nav">
			<a class="btn btn--ghost btn--xs" href="?vista=spediti&mese={shiftMonth(-1)}" aria-label="Mese precedente">‹</a>
			<b>{monthLabel}</b>
			<a class="btn btn--ghost btn--xs" href="?vista=spediti&mese={shiftMonth(1)}" aria-label="Mese successivo">›</a>
		</div>
		<div class="shipcal__grid shipcal__grid--head">{#each ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as d (d)}<span>{d}</span>{/each}</div>
		<div class="shipcal__grid">
			{#each cells as d, i (i)}
				{#if d}
					<a class="shipcal__day" class:is-on={d === data.day} class:is-today={d === data.today} class:has={!!data.days[d]} href="?vista=spediti&mese={data.month}&giorno={d}">
						<span>{Number(d.slice(8))}</span>{#if data.days[d]}<b>{data.days[d]}</b>{/if}
					</a>
				{:else}<span class="shipcal__day is-empty"></span>{/if}
			{/each}
		</div>
		<p class="osub" style="margin-top:10px">{monthTotal} {monthTotal === 1 ? 'ordine spedito' : 'ordini spediti'} a {monthLabel}{#if data.month !== data.today.slice(0, 7)} · <a class="link" href="?vista=spediti">torna a oggi</a>{/if}</p>
	</div>

	<div class="dcard" style="padding:0;overflow-x:auto">
		<h3 style="padding:16px 18px 6px;text-transform:capitalize">{dayLabel(data.day)} <small class="osub" style="text-transform:none">· {data.shipped.length} {data.shipped.length === 1 ? 'ordine' : 'ordini'}</small></h3>
		<table class="dtable">
			<thead><tr><th>Ordine</th><th>Destinazione</th><th>Spedito con</th><th>Stato</th><th>Date</th></tr></thead>
			<tbody>
				{#each data.shipped as g (g.key)}
					{@const ship = g.items[0].shipping ?? {}}
					{@const f = g.items[0]}
					{@const info = shipInfo(g)}
					<tr>
						<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub"><b>{g.customer}</b></div><div class="osub">{g.qty.toLocaleString('it-IT')} pz · {money(g.gross)} · {g.channel === 'manuale' ? '✏️ manuale' : '🛒 e-commerce'}</div></td>
						<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.zip ?? ''}</div></td>
						<td>
							<b style="display:flex;align-items:center;gap:8px">{#if f.courier === 'Qapla'}<img class="courier-logo" src={COURIERS.Qapla.logo} alt="Qapla" />{/if}{info.how}</b>
							<div class="osub">{info.sub}</div>
							{#if f.tracking_url}<div class="osub"><a class="link" href={f.tracking_url} target="_blank" rel="noopener">↗ segui la spedizione</a></div>{/if}
							{#if f.parcels}<div class="osub">{f.parcels} {f.parcels === 1 ? 'collo' : 'colli'}{#if f.ddt_id} · <a class="link" href="/dashboard/produzione/spedizioni/etichette?ddt={f.ddt_id}&courier={encodeURIComponent(f.courier ?? '')}" target="_blank">etichette</a>{/if}</div>{/if}
						</td>
						<td>
							<span class="st" style="background:{st(info.state).soft};color:{st(info.state).color}">{st(info.state).label}</span>
							{#if info.detail}<div class="osub" class:is-late={problem(g)}>{problem(g) ? '⚠ ' : ''}{info.detail}</div>{/if}
							{#if f.shipping_updated_at}<div class="osub">aggiornato {dhm(f.shipping_updated_at)}</div>{/if}
						</td>
						<td><div class="osub">spedito <b>{dhm(f.shipped_at)}</b></div>{#if f.delivered_at}<div class="osub">consegnato <b>{dhm(f.delivered_at)}</b></div>{/if}</td>
					</tr>
				{:else}
					<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine spedito in questo giorno.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
{/if}

{#if ddtPopup && ddtGroup}
	{@const m = mode(ddtGroup)}
	{@const c = ddtGroup.items[0].courier ?? ''}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>{popupKind === 'qapla' ? 'Invia a Qapla' : 'Concludi'} l'ordine {ddtGroup.number} · {ddtGroup.customer}</h3>
		<p class="note">Controlla le voci: puoi cambiare solo le quantità (es. ordinate 1.000, prodotte 1.200). Importi e fattura seguiranno le quantità consegnate.</p>
		<form method="POST" action={popupKind === 'qapla' ? '?/qapla' : '?/ddt'} use:enhance style="display:grid;gap:12px">
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
					{:else}<b style="display:flex;align-items:center;gap:8px">{#if COURIERS[c]}<img class="courier-logo" src={COURIERS[c].logo} alt={c} />{/if}Corriere a carico del mittente · {c || 'Qapla'}</b><div class="osub">l'ordine passa a Qapla: etichetta dal pannello Qapla</div>{/if}
				</div>
			</div>
			<p class="note">Il DDT prende il prossimo numero SPD (Fatturazione → DDT){ddtGroup.channel === 'manuale' ? ' e sarà da fatturare' : ' (ordine e-commerce già fatturato)'}; le etichette dei colli, una per collo, si scaricano subito.</p>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (ddtPopup = null)}>Annulla</button><button class="btn btn--green" type="submit">{popupKind === 'qapla' ? 'Genera DDT e invia a Qapla' : m === 'direct' ? 'Genera DDT: ordine consegnato' : 'Genera DDT: ordine spedito'}</button></div>
		</form>
	</div></div>
{/if}
