<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, COURIERS, deliveryMode, dmy, money, itemMeta, thumbOf, CATS } from '$lib/dashboard/orders';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	type G = (typeof data.groups)[number];
	/* Dal 25/11/2026 (Mattia) qui c'e' solo Qapla: niente scelta fra nostro corriere, consegna diretta e corriere del cliente,
	   e nessun DDT creato da qui (si genera, se serve, dalla scheda dell'ordine). Il popup chiede solo colli, peso e corriere. */
	let qaplaPopup = $state<string | null>(null);
	/* ordine del sito gia' pagato: si invia subito, senza popup (1 collo, corriere predefinito) */
	const invioSubito = (g: { channel: string | null; items: { payment_status: string | null }[] }) => g.channel === 'ecommerce' && g.items[0]?.payment_status === 'paid';
	let qaplaCourier = $state(data.defaultCourier ?? 'GLS-ITA');
	let colli = $state(1);
	let peso = $state<number | null>(null);
	/* "Copia link": il link del tracking finisce negli appunti, pronto da incollare nella risposta al cliente */
	let copied = $state<string | null>(null);
	async function copyTracking(key: string, url: string) {
		try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copia il link del tracking:', url); return; }
		copied = key; setTimeout(() => { if (copied === key) copied = null; }, 1800);
	}
	let sending = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	/* negli ordini gia' partiti: come sono stati spediti (consegna diretta e corriere del cliente restano per lo storico) */
	const mode = (g: G) => deliveryMode(g);
	const qaplaGroup = $derived(data.groups.find((g) => g.key === qaplaPopup) ?? null);
	function apriQapla(g: G) { qaplaPopup = g.key; colli = g.items[0].parcels ?? 1; peso = g.items[0].weight_kg ?? null; }
	function toggleRow(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	/* dopo l'invio il popup si chiude */
	$effect(() => { if (form?.ok) qaplaPopup = null; });

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

<svelte:head><title>{data.view === 'spediti' ? 'Spediti' : 'In spedizione'} | Dashboard</title></svelte:head>

<div class="ship-head">
	<!-- le due viste sono due voci del menu' Spedizioni (In spedizione e Spediti): qui niente linguette (Mattia, 25/11/2026) -->
	<div><h1>{#if data.view === 'spediti'}📦 Spediti{:else}🚀 In spedizione <span class="tabbtn__n">{data.groups.length}</span>{/if}</h1>
		{#if data.view === 'da-spedire'}
			<p class="lead" style="margin-top:12px">Qui trovi gli ordini nello stato <b>in spedizione</b>. Con <b>Invia a Qapla</b> l'ordine passa al corriere: l'etichetta si stampa dal pannello Qapla, il cliente riceve l'email "in attesa di ritiro", poi spedito, in consegna e consegnato arrivano da soli, e l'ordine si sposta in <b>Spediti</b>. Da qui non nasce più nessun DDT: se serve lo generi dalla scheda dell'ordine. Un ordine consegnato a mano si chiude dalla sua scheda, cambiando lo stato.</p>
		{:else}
			<p class="lead" style="margin-top:12px">Il calendario degli ordini partiti: clicca un giorno per vedere cosa è stato spedito, con quale corriere e a che punto è. Gli stati delle spedizioni Qapla si aggiornano da soli.</p>
		{/if}
	</div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.qapla}<p class="success">Ordine {form.qapla} inviato a Qapla{form.emailed ? ' · email "in attesa di ritiro" inviata al cliente' : ' · email non inviata'}. Ora stampa l'etichetta dal pannello Qapla (Etichette → Crea): tracking e stati arrivano da soli in <a class="link" href="/dashboard/produzione/spedizioni?vista=spediti">Spediti</a>.</p>{/if}
{#if !data.qaplaOk}<p class="error">Qapla non è ancora collegato (manca QAPLA_API_KEY su Vercel): "Invia a Qapla" non funzionerà finché non viene impostata.</p>{/if}

{#if data.view === 'da-spedire'}
<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Ordine</th><th>File</th><th>Destinazione</th><th>Spedizione</th><th></th></tr></thead>
		<tbody>
			{#each data.groups as g (g.key)}
				{@const ship = g.items[0].shipping ?? {}}
				{@const f = g.items[0]}
				<tr>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub"><b>{g.customer}</b></div><div class="osub">{dmy(g.created_at)} · {g.qty.toLocaleString('it-IT')} pz · {money(g.gross)} · {g.channel === 'manuale' ? '✏️ manuale' : '🛒 e-commerce'}</div></td>
					<td><ItemsCell items={g.items} size="lg" expanded={expanded.has(g.key)} ontoggle={() => toggleRow(g.key)} /></td>
					<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.street ?? ''}{ship.zip ? ` · ${ship.zip}` : ''}</div><div class="osub">{g.email}</div></td>
					<td><img class="courier-logo" src={COURIERS.Qapla.logo} alt="Qapla" />{#if f.ddt_id}<div class="osub">DDT già fatto</div>{/if}</td>
					<td style="white-space:nowrap">
						{#if invioSubito(g)}
							<form method="POST" action="?/qapla" use:enhance={() => { sending = g.key; return async ({ update }) => { sending = null; await update(); }; }} style="display:inline"><input type="hidden" name="group" value={g.key} /><input type="hidden" name="courier" value={qaplaCourier} /><button class="btn btn--blue btn--xs" type="submit" disabled={sending === g.key} title="Invia subito a Qapla (ordine del sito già pagato)">{sending === g.key ? '…' : '📦 Invia a Qapla'}</button></form>
						{:else}
							<button type="button" class="btn btn--blue btn--xs" title="Colli, peso e corriere, poi l'ordine passa a Qapla" onclick={() => apriQapla(g)}>📦 Invia a Qapla</button>
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
						<td><div class="ship-ord"><div class="ship-thumbs">{#each g.items.slice(0, 3) as it (it.id)}{#if thumbOf(it)}<img src={thumbOf(it)} alt="" title="{it.product_name} · {itemMeta(it)}" />{:else}<span class="thumb-ph" style="background:{CATS[it.product_slug]?.soft ?? '#eceef3'}">{CATS[it.product_slug]?.code ?? '?'}</span>{/if}{/each}{#if g.items.length > 3}<span class="osub">+{g.items.length - 3}</span>{/if}</div><div><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub"><b>{g.customer}</b></div><div class="osub">{g.qty.toLocaleString('it-IT')} pz · {money(g.gross)} · {g.channel === 'manuale' ? '✏️ manuale' : '🛒 e-commerce'}</div></div></div></td>
						<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.zip ?? ''}</div></td>
						<td>
							<b style="display:flex;align-items:center;gap:8px">{#if f.courier === 'Qapla'}<img class="courier-logo" src={COURIERS.Qapla.logo} alt="Qapla" />{/if}{info.how}</b>
							<div class="osub">{info.sub}</div>
							{#if f.tracking_url}<div class="trk"><a class="btn btn--ghost btn--xs" href={f.tracking_url} target="_blank" rel="noopener">↗ Tracking</a><button type="button" class="btn btn--xs {copied === g.key ? 'btn--green' : 'btn--ghost'}" onclick={() => copyTracking(g.key, f.tracking_url!)}>{copied === g.key ? '✓ Copiato' : '⧉ Copia link'}</button></div>{/if}
							{#if f.courier === 'Qapla' && !f.tracking_number && data.couriers?.length}
								<!-- non ancora ritirato: si puo' rimandare a Qapla con un altro corriere (l'ordine con lo stesso riferimento viene aggiornato) -->
								<form method="POST" action="?/ricorriere" use:enhance class="reship"><input type="hidden" name="group" value={g.key} /><select name="courier">{#each data.couriers as k (k.code)}<option value={k.code}>{k.name}</option>{/each}</select><button class="btn btn--ghost btn--xs" type="submit">↻ Rimanda</button></form>
							{/if}
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

{#if qaplaPopup && qaplaGroup}
	<div class="dmodal-bg"><div class="dmodal">
		<h3>Invia a Qapla l'ordine {qaplaGroup.number} · {qaplaGroup.customer}</h3>
		<p class="note">Servono solo colli e peso per l'etichetta. Qui non si crea nessun DDT: se a questo cliente serve, generalo dalla <a class="link" href="/dashboard/fatturazione/ordini/{qaplaGroup.key}">scheda dell'ordine</a>.</p>
		<form method="POST" action="?/qapla" use:enhance={() => { sending = qaplaPopup; return async ({ update }) => { sending = null; await update(); }; }} style="display:grid;gap:12px">
			<input type="hidden" name="group" value={qaplaPopup} />
			<div class="row3" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)">
				<label>Colli<input type="number" name="parcels" min="1" bind:value={colli} /></label>
				<label>Peso (kg)<input type="number" name="weight" step="0.1" min="0" bind:value={peso} placeholder="es. 2.4" /></label>
				<div>
					{#if data.couriers?.length}<label style="display:block"><span class="osub">Corriere con cui spedire</span><select name="courier" bind:value={qaplaCourier}>{#each data.couriers as k (k.code)}<option value={k.code}>{k.name}</option>{/each}</select></label>
					{:else}<input type="hidden" name="courier" value={qaplaCourier} /><span class="osub">Corriere</span><br /><b>{qaplaCourier}</b><div class="osub">elenco corrieri non disponibile da Qapla</div>{/if}
				</div>
			</div>
			<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn--ghost btn--xs" onclick={() => (qaplaPopup = null)}>Annulla</button><button class="btn btn--blue" type="submit" disabled={sending === qaplaPopup}>{sending === qaplaPopup ? 'Invio…' : '📦 Invia a Qapla'}</button></div>
		</form>
	</div></div>
{/if}

<style>
	/* ordini spediti: le foto degli articoli accanto al numero d'ordine */
	.ship-ord { display: flex; gap: 10px; align-items: flex-start; }
	.ship-thumbs { display: flex; flex-wrap: wrap; gap: 4px; width: 120px; flex: 0 0 auto; align-items: center; }
	.ship-thumbs img, .ship-thumbs .thumb-ph { width: 56px; height: 56px; border-radius: 10px; object-fit: contain; background: #fff; border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--muted); }
	.trk { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
	.reship { display: flex; gap: 6px; align-items: center; margin-top: 6px; } .reship select { padding: 4px 8px; border: 1px solid var(--line); border-radius: 8px; font: inherit; font-size: 12px; }
</style>
