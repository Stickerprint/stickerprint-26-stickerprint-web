<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, ACTIVE_STATUSES, statiPerTendina, LEGACY_STATUSES, PROD_STAGES, CATS, COUNTRIES, MONTHS, money, dmy, itemMeta, thumbOf, PRODUCTION_STATUSES, SHIPPING_STATUSES, DEVICE_ICON, CHANNEL_ICON, arretrati, giornoFra, partenzaDi, partonoIl, type OrderGroup } from '$lib/dashboard/orders';
	import { chiaveClienteOrdine, fatturabile, nonFatturabile } from '$lib/dashboard/fattura-ordini';
	import { paymentIcon, paymentLabel } from '$lib/dashboard/payments';
	import ItemsCell from '$lib/components/dashboard/ItemsCell.svelte';
	let { data, form } = $props();
	let search = $state('');
	let cat = $state('all');
	let channel = $state('all');
	let status = $state('all');
	let star = $state('entrambi');
	/* "Data partenza": oggi, domani o dopodomani = gli ordini che devono partire quel giorno (Mattia, 25/11/2026).
	   Vale la data, non il mese in cui l'ordine e' stato fatto: con questo filtro il mese scelto non conta */
	let partenza = $state('all');
	const GIORNI_PARTENZA = $derived(['Oggi', 'Domani', 'Dopodomani'].map((nome, i) => {
		const giorno = giornoFra(i);
		const quando = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${giorno}T12:00:00`));
		return { k: String(i), nome, giorno, quando, n: partonoIl(data.groups as OrderGroup[], giorno).length };
	}));
	const giornoScelto = $derived(GIORNI_PARTENZA.find((x) => x.k === partenza) ?? null);
	/* "Ordini arretrati": dovevano partire nei giorni scorsi del mese in corso e non sono ancora partiti */
	const ARRETRATI = $derived(new Set(arretrati(data.groups as OrderGroup[], giornoFra(0)).map((g) => g.key)));
	const soloArretrati = $derived(partenza === 'arretrati');
	const meseCorrente = $derived(`${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`);
	/* si parte dal mese in corso: elenco, totali e riquadri parlano sempre dello stesso mese.
	   Con "Tutti i mesi" si vede tutto l'anno, elenco compreso. */
	let month = $state<string | null>(new Date().getFullYear() === (data.year ?? new Date().getFullYear()) ? String(new Date().getMonth()) : null);
	/* "Inizia produzione": ordini appena creati (manuali, o in attesa di prova del vecchio flusso) che non hanno ancora una coda di lavorazioni.
	   Gli e-commerce pagati entrano da soli; quelli in attesa dell'anticipo si possono forzare (es. pagato a voce). */
	let starting = $state<string | null>(null);
	/* richiesta di recensione mandata a mano da qui */
	let chiedo = $state<string | null>(null);
	const canStart = (g: (typeof data.groups)[number]) => ['attesa_pagamento', 'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione'].includes(g.status) || (g.status === 'in_produzione' && !g.items[0].prod_stage);
	let expanded = $state<Set<string>>(new Set());
	const year = $derived(data.year);
	/* cambiando anno si riparte dal mese giusto: l'anno in corso sul mese in corso, gli anni passati
	   su tutto l'anno */
	let annoVisto = data.year;
	$effect(() => {
		const y = data.year;
		if (y === annoVisto) return;
		annoVisto = y;
		month = y === new Date().getFullYear() ? String(new Date().getMonth()) : null;
	});
	const buckets = $derived.by(() => {
		const b: Record<string, { n: number; amt: number }> = { prev: { n: 0, amt: 0 }, next: { n: 0, amt: 0 } };
		for (let m = 0; m < 12; m++) b[m] = { n: 0, amt: 0 };
		for (const g of data.groups) {
			const d = new Date(g.created_at); const y = d.getFullYear();
			const k = y < year ? 'prev' : y > year ? 'next' : String(d.getMonth());
			b[k].n++; b[k].amt += g.net;
		}
		return b;
	});
	const list = $derived(data.groups.filter((g: OrderGroup) => {
		const q = search.trim().toLowerCase();
		if (q && !(g.number.toLowerCase().includes(q) || g.numbers.some((n) => n.toLowerCase().includes(q)) || g.customer.toLowerCase().includes(q) || g.email.toLowerCase().includes(q))) return false;
		if (cat !== 'all' && !g.items.some((i) => i.product_slug === cat)) return false;
		if (channel !== 'all' && g.channel !== channel) return false;
		if (status === 'vecchi') { if (!LEGACY_STATUSES.includes(g.status)) return false; }
		else if (status !== 'all' && g.status !== status) return false;
		if (star === 'starred' && !g.starred) return false;
		if (star === 'unstarred' && g.starred) return false;
		if (giornoScelto && (g.status === 'annullato' || partenzaDi(g) !== giornoScelto.giorno)) return false;
		if (soloArretrati && !ARRETRATI.has(g.key)) return false;
		/* con del testo nella ricerca si cerca in tutto l'anno: il mese scelto non conta (Mattia, 24/11/2026).
		   Lo stesso con la data di partenza: un ordine di fine mese puo' partire il mese dopo */
		if (month !== null && !q && !giornoScelto && !soloArretrati) {
			const d = new Date(g.created_at); const y = d.getFullYear();
			const k = y < year ? 'prev' : y > year ? 'next' : String(d.getMonth());
			if (k !== month) return false;
		}
		return true;
	}));
	/* paginazione (70 per pagina) e totali dell'elenco filtrato: imponibile, IVA e totale, senza gli annullati */
	const PER_PAGE = 70;
	let page = $state(1);
	$effect(() => { void [search, cat, channel, status, star, month, partenza]; page = 1; });
	const pages = $derived(Math.max(1, Math.ceil(list.length / PER_PAGE)));
	const pageList = $derived(list.slice((page - 1) * PER_PAGE, page * PER_PAGE));
	const totals = $derived.by(() => {
		const valid = list.filter((g: OrderGroup) => g.status !== 'annullato');
		const net = valid.reduce((s: number, g: OrderGroup) => s + g.net, 0), gross = valid.reduce((s: number, g: OrderGroup) => s + g.gross, 0);
		const pv = pageList.filter((g: OrderGroup) => g.status !== 'annullato');
		return { n: valid.length, net, vat: gross - net, gross, pageNet: pv.reduce((s: number, g: OrderGroup) => s + g.net, 0), pageGross: pv.reduce((s: number, g: OrderGroup) => s + g.gross, 0), cancelled: list.length - valid.length };
	});
	/* mese di riferimento del fatturato: quello scelto nella barra dei mesi; con "Tutti i mesi" vale
	   il mese in corso (se si guarda l'anno corrente), altrimenti tutto l'anno scelto */
	const cerca = $derived(search.trim());
	const meseRif = $derived(cerca || giornoScelto || soloArretrati ? null : month);
	const meseLabel = $derived(
		meseRif === null ? `tutto il ${year}` : meseRif === 'prev' ? `prima del ${year}` : meseRif === 'next' ? `dopo il ${year}` : `${MONTHS[+meseRif]} ${year}`
	);
	/* come i riquadri chiamano gli ordini che stanno contando: il mese, oppure il giorno di partenza scelto */
	const rifTitolo = $derived(soloArretrati ? `arretrati di ${meseCorrente}` : giornoScelto ? `in partenza ${giornoScelto.nome.toLowerCase()}` : meseLabel);
	const rifDi = $derived(soloArretrati ? `arretrati di ${meseCorrente}` : giornoScelto ? `in partenza ${giornoScelto.nome.toLowerCase()}` : `di ${meseLabel}`);
	/* TUTTI i riquadri parlano del mese di riferimento e dei filtri attivi (categoria, canale, stato, segnati, ricerca):
	   scegliendo agosto e "solo manuali" si vedono ordini e fatturato di agosto dei soli manuali */
	const filtriAttivi = $derived(search.trim() !== '' || cat !== 'all' || channel !== 'all' || status !== 'all' || star !== 'entrambi' || partenza !== 'all');
	const stats = $derived.by(() => {
		const mese = list;
		const validi = mese.filter((g: OrderGroup) => g.status !== 'annullato');
		return {
			total: mese.length,
			ecom: mese.filter((g: OrderGroup) => g.channel === 'ecommerce').length,
			manuali: mese.filter((g: OrderGroup) => g.channel !== 'ecommerce').length,
			produzione: mese.filter((g: OrderGroup) => PRODUCTION_STATUSES.includes(g.status)).length,
			spedizione: mese.filter((g: OrderGroup) => SHIPPING_STATUSES.includes(g.status)).length,
			consegnati: mese.filter((g: OrderGroup) => g.status === 'consegnato').length,
			net: validi.reduce((s: number, g: OrderGroup) => s + g.net, 0),
			netOrdini: validi.length
		};
	});
	/* ---------- «Genera fattura da ordini» (Mattia, 25/11/2026) ----------
	   Si spuntano gli ordini senza fattura dello stesso cliente (di solito dopo averlo cercato per nome) e un bottone
	   genera un'unica fattura. Scelto il primo, gli ordini degli altri clienti si disattivano. */
	let scelti = $state<Set<string>>(new Set());
	let confermaFattura = $state(false);
	let fatturando = $state(false);
	const fatturati = $derived((data.fatturati ?? {}) as Record<string, string>);
	const primoScelto = $derived(scelti.size ? (data.groups as OrderGroup[]).find((g) => scelti.has(g.key)) ?? null : null);
	const clienteScelto = $derived(primoScelto ? chiaveClienteOrdine(primoScelto) : null);
	const spuntabile = (g: OrderGroup) => fatturabile(g, fatturati) && (!clienteScelto || chiaveClienteOrdine(g) === clienteScelto);
	/* «seleziona tutti» vale per tutto l'elenco filtrato (tutte le pagine), non solo per quelli a schermo */
	const spuntabili = $derived(list.filter((g: OrderGroup) => spuntabile(g)).map((g: OrderGroup) => g.key));
	const tuttiScelti = $derived(spuntabili.length > 0 && spuntabili.every((k: string) => scelti.has(k)));
	function spunta(k: string) { const s = new Set(scelti); s.has(k) ? s.delete(k) : s.add(k); scelti = s; confermaFattura = false; }
	function spuntaTutti() {
		confermaFattura = false;
		if (tuttiScelti) { scelti = new Set(); return; }
		/* senza un cliente gia' scelto, «tutti» ha senso solo se l'elenco e' di un cliente solo: si parte dal primo */
		const chiave = clienteScelto ?? (list.find((g: OrderGroup) => fatturabile(g, fatturati)) ? chiaveClienteOrdine(list.find((g: OrderGroup) => fatturabile(g, fatturati))!) : null);
		scelti = new Set(list.filter((g: OrderGroup) => fatturabile(g, fatturati) && chiaveClienteOrdine(g) === chiave).map((g: OrderGroup) => g.key));
	}
	const ordiniScelti = $derived((data.groups as OrderGroup[]).filter((g) => scelti.has(g.key)));
	const totScelti = $derived({ net: ordiniScelti.reduce((s, g) => s + g.net, 0), gross: ordiniScelti.reduce((s, g) => s + g.gross, 0) });
	const altriClienti = $derived(clienteScelto ? list.filter((g: OrderGroup) => fatturabile(g, fatturati) && chiaveClienteOrdine(g) !== clienteScelto).length : 0);
	const fatta = $derived((form as { fattura?: { id: string; number: string; ordini: string[]; ddt: string[]; metodoAnagrafica: string | null; pagata: boolean } } | null)?.fattura ?? null);
	function toggle(k: string) { const s = new Set(expanded); s.has(k) ? s.delete(k) : s.add(k); expanded = s; }
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
</script>

<svelte:head><title>Ordini | Dashboard Stickerprint</title></svelte:head>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if fatta}<p class="success">Fattura <b>{fatta.number}</b> creata da {fatta.ordini.length === 1 ? `l'ordine ${fatta.ordini[0]}` : `${fatta.ordini.length} ordini (${fatta.ordini.join(', ')})`}{#if fatta.ddt.length}, con {fatta.ddt.length === 1 ? `il DDT ${fatta.ddt[0]}` : `i DDT ${fatta.ddt.join(', ')}`}{/if}: <a class="link" href="/dashboard/fatturazione/fatture/{fatta.id}">aprila</a>.{#if fatta.metodoAnagrafica} Pagamento preso dall'anagrafica del cliente: <b>{fatta.metodoAnagrafica}</b>.{/if}{#if fatta.pagata} Gli ordini erano già pagati: la fattura risulta pagata.{/if}</p>{/if}
{#if form?.ok && form.started}<p class="success">Ordine {form.started} in produzione: lo trovi in <a class="link" href="/dashboard/produzione">Produzione › Stampa</a>.</p>{/if}

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Ordini {data.year}</h1><p class="lead">E-commerce e manuali, in un'unica vista · {list.length} risultati{#if pages > 1} · pagina {page} di {pages}{/if}</p></div>
	<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
		<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
		<a class="btn btn--green" href="/dashboard/fatturazione/ordini/nuovo">+ Nuovo ordine</a>
	</div>
</div>

<div class="month-bar">
	<div class="month-cells">
		{#each [['prev', 'Preced.'], ...MONTHS.map((m, i) => [String(i), m]), ['next', 'Succ.']] as [k, label] (k)}
			<button type="button" class="month-cell" class:has-data={buckets[k].n > 0} class:is-active={month === k} class:is-current={year === new Date().getFullYear() && k === String(new Date().getMonth())} onclick={() => (month = month === k ? null : k)}>
				<span class="mc-label">{label}</span><span class="mc-doc">{buckets[k].n} ord.</span><span class="mc-amt">{money(buckets[k].amt)}</span>
			</button>
		{/each}
	</div>
	<button type="button" class="btn btn--xs {month === null ? 'btn--blue' : 'btn--ghost'}" onclick={() => (month = null)}>Tutti i mesi</button>
</div>

{#if soloArretrati}<p class="stats5-rif">Stai guardando gli <b>ordini arretrati di {meseCorrente}</b>{#if cerca || cat !== 'all' || channel !== 'all' || status !== 'all' || star !== 'entrambi'} <b>con gli altri filtri attivi</b>{/if}: dovevano partire nei giorni scorsi di questo mese e non sono ancora partiti. Quelli rimasti indietro dai mesi prima non ci sono.</p>
{:else if giornoScelto}<p class="stats5-rif">Stai guardando gli ordini che devono partire <b>{giornoScelto.nome.toLowerCase()}, {giornoScelto.quando}</b>{#if cerca || cat !== 'all' || channel !== 'all' || status !== 'all' || star !== 'entrambi'} <b>con gli altri filtri attivi</b>{/if}: conta la data di partenza, non il mese dell'ordine. Ci sono anche quelli già partiti, col loro stato; gli annullati no.</p>
{:else if cerca}<p class="stats5-rif">Ricerca di <b>«{cerca}»</b> in <b>tutto il {year}</b>, tutti i mesi insieme: riquadri, elenco e totali qui sotto sono degli ordini trovati.</p>
{:else}<p class="stats5-rif">Stai guardando <b>{meseLabel}</b>{#if filtriAttivi} <b>con i filtri attivi</b>{/if}: riquadri, elenco e totali qui sotto sono solo di {meseLabel}{#if filtriAttivi} e degli ordini che passano i filtri{/if}.</p>{/if}
<div class="stats5">
	<div class="dcard stat5"><span class="ico" style="background:#fde7f1;color:#e0117f">📦</span><div><small>Ordini · {rifTitolo}</small><b>{stats.total}</b><i>{stats.ecom} e-commerce · {stats.manuali} manuali</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#e5f0ff;color:#3b82f6">🖨️</span><div><small>In produzione</small><b>{stats.produzione}</b><i>{rifDi}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcf9f4;color:#0d9488">🚚</span><div><small>In spedizione</small><b>{stats.spedizione}</b><i>{rifDi}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#dcfce7;color:#15803d">✅</span><div><small>Consegnati</small><b>{stats.consegnati}</b><i>{rifDi}</i></div></div>
	<div class="dcard stat5"><span class="ico" style="background:#fef6db;color:#c48a00">💶</span><div><small>Fatturato netto</small><b>{money(stats.net)}</b><i>{stats.netOrdini} {stats.netOrdini === 1 ? 'ordine' : 'ordini'} {rifDi}{#if filtriAttivi} · filtri attivi{/if}</i></div></div>
</div>

<div class="dcard filters filters--ordini">
	<input type="text" placeholder="Cerca ordine, cliente o email…" bind:value={search} />
	<select bind:value={cat}><option value="all">Tutte le categorie</option>{#each Object.entries(CATS) as [slug, c] (slug)}<option value={slug}>{c.name}</option>{/each}</select>
	<select bind:value={channel}><option value="all">Tutti i canali</option><option value="ecommerce">🛒 E-commerce</option><option value="manuale">✍️ Manuale</option></select>
	<select bind:value={status}><option value="all">Tutti gli stati</option>{#each ACTIVE_STATUSES as k (k)}<option value={k}>{ORDER_STATUS[k].label}</option>{/each}<option value="vecchi">Vecchio flusso (prove)</option></select>
	<select bind:value={partenza} aria-label="Data partenza" class:is-on={partenza !== 'all'}><option value="all">🚚 Data partenza: tutte</option>{#each GIORNI_PARTENZA as p (p.k)}<option value={p.k}>{p.nome} · {p.quando} ({p.n})</option>{/each}<option value="arretrati">⚠ Ordini arretrati ({ARRETRATI.size})</option></select>
	<select bind:value={star}><option value="entrambi">⭐ Tutti</option><option value="starred">Segnati</option><option value="unstarred">Non segnati</option></select>
</div>

{#if scelti.size}
	<div class="dcard selbar">
		<div><b>{scelti.size} {scelti.size === 1 ? 'ordine selezionato' : 'ordini selezionati'}</b> di <b>{primoScelto?.customer}</b> · {money(totScelti.net)} + IVA = {money(totScelti.gross)}
			{#if altriClienti}<div class="osub">Una fattura è di un cliente solo: gli ordini degli altri clienti sono disattivati.</div>{/if}</div>
		<div class="selbar__btns">
			{#if confermaFattura}
				<form method="POST" action="?/fattura" use:enhance={() => { fatturando = true; return async ({ result, update }) => { fatturando = false; confermaFattura = false; if (result.type === 'success') scelti = new Set(); await update(); }; }}>
					<input type="hidden" name="groups" value={[...scelti].join(',')} />
					<button class="btn btn--green" type="submit" disabled={fatturando}>{fatturando ? 'Genero la fattura…' : `Sì, genera la fattura (${scelti.size} ${scelti.size === 1 ? 'ordine' : 'ordini'})`}</button>
				</form>
				<button type="button" class="btn btn--ghost btn--xs" onclick={() => (confermaFattura = false)}>annulla</button>
			{:else}
				<button type="button" class="btn btn--green" onclick={() => (confermaFattura = true)} title="Un'unica fattura per gli ordini selezionati: prende il prossimo numero SPF">🧾 Genera fattura da ordini</button>
				<button type="button" class="btn btn--ghost btn--xs" onclick={() => (scelti = new Set())}>azzera la selezione</button>
			{/if}
		</div>
	</div>
{/if}

<div class="dcard" style="overflow-x:auto;padding:0">
	<table class="dtable otable">
		<thead><tr><th title="Seleziona gli ordini senza fattura per generarne una"><input type="checkbox" checked={tuttiScelti} disabled={!spuntabili.length} onchange={spuntaTutti} aria-label="Seleziona tutti gli ordini senza fattura dell'elenco" /></th><th></th><th>Ordine</th><th>Cliente</th><th>Articolo</th><th>Categoria</th><th>Q.tà</th><th>Stato</th><th>Spedizione</th><th style="text-align:right">Importo</th><th></th></tr></thead>
		<tbody>
			{#each pageList as g (g.key)}
				{@const first = g.items[0]}
				<!-- le classi oc-* servono al telefono (dashboard-telefono.css): le celle si riconoscono dal nome, non dalla posizione -->
				<tr class="orow-main" class:is-scelto={scelti.has(g.key)}>
					<td class="oc-sel">{#if fatturabile(g, fatturati)}<input type="checkbox" checked={scelti.has(g.key)} disabled={!spuntabile(g)} onchange={() => spunta(g.key)} aria-label="Seleziona l'ordine {g.number} per la fattura" title={spuntabile(g) ? 'Senza fattura: selezionalo per generarla' : 'È di un altro cliente rispetto agli ordini già selezionati'} />{:else if fatturati[g.key]}<span class="osub" title="Fattura {fatturati[g.key]}">🧾</span>{:else if g.status !== 'annullato' && g.channel !== 'ecommerce'}<span class="osub" title={nonFatturabile(g, fatturati) ?? ''}>—</span>{/if}</td>
					<td class="oc-flag">{COUNTRIES[g.country]?.flag ?? '🌍'}</td>
					<td class="oc-num"><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}{#if g.items.length > 1} <small>+{g.items.length - 1}</small>{/if}</a><div class="osub">{dmy(g.created_at)} <span title={CHANNEL_ICON[g.channel]?.label}>{CHANNEL_ICON[g.channel]?.icon ?? ''}</span>{#if g.device}<span title="Ordinato da {g.device}">{DEVICE_ICON[g.device] ?? ''}</span>{/if}{#if g.express} <span title="Produzione express">⚡</span>{/if}</div></td>
					<td class="oc-cust"><b>{g.customer}</b><div class="osub">{g.email}</div></td>
					<td class="oc-art">
						<div class="item-cell">
							{#if first.proof_url || first.preview_url || first.mockup_url}<img src={first.proof_url ?? first.preview_url ?? first.mockup_url} alt="" />{:else}<span class="thumb-ph" style="background:{CATS[first.product_slug]?.soft ?? '#eee'}"></span>{/if}
							<div><b>{first.product_name}</b><div class="osub">{itemMeta(first)}</div></div>
						</div>
						{#if g.items.length > 1}<button type="button" class="link-btn" style="font-size:12px" onclick={() => toggle(g.key)}>{expanded.has(g.key) ? 'Nascondi' : `Mostra altri ${g.items.length - 1}`}</button>{/if}
					</td>
					<td class="oc-cat"><span class="cat" style="background:{CATS[first.product_slug]?.soft};color:{CATS[first.product_slug]?.color}">{CATS[first.product_slug]?.name ?? first.product_slug}</span></td>
					<td class="oc-qty">{g.qty.toLocaleString('it-IT')} pz</td>
					<td class="oc-stato">
						{#if canStart(g)}
							<form method="POST" action="?/produzione" use:enhance={() => { starting = g.key; return async ({ update }) => { starting = null; await update(); }; }}><input type="hidden" name="group" value={g.key} /><button class="btn btn--green btn--xs" type="submit" disabled={starting === g.key} title="L'ordine va in produzione e compare subito nel reparto Stampa">{starting === g.key ? '…' : '▶ Metti in stampa'}</button></form>
							{#if g.status === 'attesa_pagamento'}<div class="osub" style="margin-top:4px">in attesa dell'anticipo</div>{/if}
						{:else}
							<!-- cambio stato al volo: la tendina ha i colori dello stato e invia da sola -->
							<form method="POST" action="?/stato" use:enhance class="stform"><input type="hidden" name="group" value={g.key} />
								<select name="status" class="st stsel" style="background:{st(g.status).soft};color:{st(g.status).color}" value={g.status} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} title="Cambia stato senza aprire l'ordine">
									{#each statiPerTendina(g.status) as k (k)}<option value={k}>{st(k).label}</option>{/each}
								</select>
							</form>
							{#if g.status === 'in_produzione' && first.prod_stage}<div class="osub">{PROD_STAGES[first.prod_stage] ?? first.prod_stage}</div>{/if}
							{#if g.status === 'consegnato'}
								{#if g.review_asked_at}
									<div class="osub" title="Richiesta di recensione inviata">⭐ chiesta il {dmy(g.review_asked_at)}</div>
								{:else}
									<form method="POST" action="?/recensione" use:enhance={() => { chiedo = g.key; return async ({ update }) => { chiedo = null; await update(); }; }} style="margin-top:4px">
										<input type="hidden" name="group" value={g.key} />
										<button class="btn btn--ghost btn--xs" type="submit" disabled={chiedo === g.key} title="Manda adesso la richiesta di recensione">{chiedo === g.key ? '…' : '⭐ mai chiesta: manda'}</button>
									</form>
								{/if}
							{/if}
						{/if}
					</td>
					<td class="shipcol oc-sped">
						{#if g.shipBy}
							{@const late = !['spedito', 'in_consegna', 'consegnato', 'annullato'].includes(g.status) && g.shipBy < new Date().toISOString().slice(0, 10)}
							<b class:is-late={late} title={late ? 'Doveva partire entro questa data' : 'Deve partire entro questa data'}>{late ? '⚠ ' : ''}{dmy(g.shipBy)}</b>
							{#if first.shipped_at}<div class="osub">partito {dmy(first.shipped_at)}</div>{:else}<div class="osub">entro</div>{/if}
						{:else if g.delivery_date}<b title="Spedizione prevista scritta sull'ordine">{dmy(g.delivery_date)}</b><div class="osub">prevista</div>
						{:else}<span class="osub">—</span>{/if}
					</td>
					<td class="oc-imp" style="text-align:right"><b>{money(g.net)}</b>{#if g.discount > 0}<div class="osub" style="color:#b45309">sconto {g.discountCode ?? ''} −{money(g.discount)}</div>{/if}<div class="osub">{money(g.gross)} IVA incl.</div>{#if paymentIcon(g.payment_method)}<div class="payrow"><img src={paymentIcon(g.payment_method)} alt={paymentLabel(g.payment_method)} title={paymentLabel(g.payment_method)} /></div>{:else if g.payment_method}<div class="osub">{paymentLabel(g.payment_method)}</div>{/if}</td>
					<td class="oc-act">
						<div class="row-actions">
							<form method="POST" action="?/star" use:enhance><input type="hidden" name="group" value={g.key} /><input type="hidden" name="on" value={g.starred ? '0' : '1'} /><button type="submit" class="ibtn" title="Segna ordine">{g.starred ? '⭐' : '☆'}<span class="ibtn__lbl">{g.starred ? 'Segnato' : 'Segna'}</span></button></form>
							<a class="ibtn" href="/dashboard/fatturazione/ordini/nuovo?da={g.key}" title="Duplica: ordine nuovo con gli stessi dati">⧉<span class="ibtn__lbl">Duplica</span></a>
							<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm(`Eliminare l'ordine ${g.number}?`)) e.preventDefault(); }}><input type="hidden" name="group" value={g.key} /><button type="submit" class="ibtn" title="Elimina">🗑️<span class="ibtn__lbl">Elimina</span></button></form>
						</div>
					</td>
				</tr>
				{#if expanded.has(g.key)}
					{#each g.items.slice(1) as it (it.id)}
						<tr class="orow-sub">
							<td></td><td></td><td class="os-num"><span class="osub">{it.number}</span></td><td></td>
							<td class="os-art"><div class="item-cell">{#if it.preview_url || it.mockup_url}<img src={it.mockup_url ?? it.preview_url} alt="" />{/if}<div><b>{it.product_name}</b><div class="osub">{itemMeta(it)}</div></div></div></td>
							<td class="os-cat"><span class="cat" style="background:{CATS[it.product_slug]?.soft};color:{CATS[it.product_slug]?.color}">{CATS[it.product_slug]?.name ?? it.product_slug}</span></td>
							<td class="os-qty">{it.qty.toLocaleString('it-IT')} pz</td>
							<td class="os-stato"><span class="st" style="background:{st(it.status).soft};color:{st(it.status).color}">{st(it.status).label}</span></td><td></td>
							<td class="os-imp" style="text-align:right">{money(Number(it.total_net))}</td><td></td>
						</tr>
					{/each}
				{/if}
			{:else}
				<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine corrisponde ai filtri selezionati.</td></tr>
			{/each}
		</tbody>
		{#if list.length}
			<tfoot class="otot">
				<tr>
					<td colspan="9"><b>Totale {totals.n} {totals.n === 1 ? 'ordine' : 'ordini'}</b> con i filtri attivi{#if totals.cancelled} <span class="osub">({totals.cancelled} {totals.cancelled === 1 ? 'annullato escluso' : 'annullati esclusi'})</span>{/if}{#if pages > 1}<div class="osub">In questa pagina: {money(totals.pageNet)} imponibile · {money(totals.pageGross)} IVA inclusa</div>{/if}</td>
					<td style="text-align:right"><div class="otot__row"><span>Imponibile</span><b>{money(totals.net)}</b></div><div class="otot__row"><span>IVA</span><b>{money(totals.vat)}</b></div><div class="otot__row otot__row--tot"><span>Totale IVA inclusa</span><b>{money(totals.gross)}</b></div></td>
					<td></td>
				</tr>
			</tfoot>
		{/if}
	</table>
</div>
{#if pages > 1}
	<div class="pager">
		<button type="button" class="btn btn--ghost btn--xs" disabled={page === 1} onclick={() => (page = Math.max(1, page - 1))}>‹ Precedente</button>
		{#each Array.from({ length: pages }, (_, i) => i + 1) as n (n)}<button type="button" class="pager__n" class:is-active={n === page} onclick={() => (page = n)}>{n}</button>{/each}
		<button type="button" class="btn btn--ghost btn--xs" disabled={page === pages} onclick={() => (page = Math.min(pages, page + 1))}>Successiva ›</button>
		<span class="osub">{PER_PAGE} per pagina</span>
	</div>
{/if}

<style>
	/* sei campi su una riga (ricerca + cinque tendine); sotto i 1100 px vale la colonna unica di dashboard.css */
	@media (min-width: 1101px) { .filters--ordini { grid-template-columns: 1.6fr repeat(5, 1fr); } }
	.filters--ordini select.is-on { border-color: var(--blue); background: #f4f9ff; font-weight: 700; }
	/* barra della selezione per «Genera fattura da ordini»: resta in vista mentre si scorre l'elenco */
	.selbar { position: sticky; top: 8px; z-index: 5; display: flex; gap: 14px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 12px 16px; border: 2px solid var(--green); }
	.selbar__btns { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
	.orow-main.is-scelto > td { background: #f2fbe9; }
</style>
