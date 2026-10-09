<script lang="ts">
	import '$lib/styles/margini.css';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { CATS, MONTHS, CHANNEL_ICON, dmy } from '$lib/dashboard/orders';
	import { totali, materiali, perProdotto, perMese } from '$lib/margini/aggrega';
	import { euro, perc, mq, metri, grammi, pezzi, mm, classeMargine } from '$lib/margini/formato';
	import type { OrdineMargine } from '$lib/margini/tipi';
	let { data } = $props();

	type Vista = 'riepilogo' | 'materiale' | 'ordini' | 'prodotti';
	const VISTE: { id: Vista; label: string; icon: string }[] = [
		{ id: 'riepilogo', label: 'Riepilogo', icon: '📊' },
		{ id: 'materiale', label: 'Materiale', icon: '🧻' },
		{ id: 'ordini', label: 'Ordini', icon: '🧾' },
		{ id: 'prodotti', label: 'Prodotti', icon: '🏷️' }
	];
	const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
	const oggi = new Date();
	const meseDefault = (y: number) => (y === oggi.getFullYear() ? String(oggi.getMonth()) : 'anno');
	const nomeProdotto = (slug: string) => CATS[slug]?.name ?? (slug === 'kit_adesivi' ? 'Kit di adesivi' : slug ? slug.replace(/_/g, ' ') : 'Senza codice');
	const coloreProdotto = (slug: string) => CATS[slug]?.color ?? '#94a3b8';

	/* periodo, scheda e canale stanno nell'indirizzo: tornando indietro dal dettaglio si ritrova tutto com'era */
	const q0 = page.url.searchParams;
	let periodo = $state(q0.get('mese') ?? meseDefault(data.year));
	let vista = $state<Vista>(VISTE.some((v) => v.id === q0.get('vista')) ? (q0.get('vista') as Vista) : 'riepilogo');
	let canale = $state(q0.get('canale') ?? 'tutti');
	let annoVisto = data.year;
	$effect(() => {
		const y = data.year;
		if (y === annoVisto) return;
		annoVisto = y;
		periodo = page.url.searchParams.get('mese') ?? meseDefault(y);
	});
	const query = $derived(`?anno=${data.year}&mese=${periodo}&vista=${vista}${canale !== 'tutti' ? `&canale=${canale}` : ''}`);
	$effect(() => {
		const q = query;
		if (page.url.search !== q) replaceState(new URL(q, page.url), page.state);
	});

	function sposta(d: number) {
		if (periodo === 'anno') return;
		const m = Number(periodo) + d;
		if (m < 0) { if (data.years.includes(data.year - 1)) goto(`?anno=${data.year - 1}&mese=11&vista=${vista}`, { noScroll: true }); return; }
		if (m > 11) { if (data.years.includes(data.year + 1)) goto(`?anno=${data.year + 1}&mese=0&vista=${vista}`, { noScroll: true }); return; }
		periodo = String(m);
	}
	const primoMese = $derived(periodo === '0' && !data.years.includes(data.year - 1));
	const ultimoMese = $derived(periodo !== 'anno' && ((Number(periodo) === 11 && !data.years.includes(data.year + 1)) || (data.year === oggi.getFullYear() && Number(periodo) >= oggi.getMonth())));
	const periodoLabel = $derived(periodo === 'anno' ? `tutto il ${data.year}` : `${MESI[Number(periodo)]} ${data.year}`);

	const delPeriodo = $derived(data.ordini.filter((o: OrdineMargine) => {
		if (canale !== 'tutti' && (canale === 'manuale') !== (o.channel === 'manuale')) return false;
		return periodo === 'anno' || new Date(o.created_at).getMonth() === Number(periodo);
	}));
	const t = $derived(totali(delPeriodo));
	const mat = $derived(materiali(delPeriodo, nomeProdotto));
	const prodotti = $derived(perProdotto(delPeriodo));
	const mesi = $derived(perMese(data.ordini.filter((o: OrdineMargine) => canale === 'tutti' || (canale === 'manuale') === (o.channel === 'manuale')), data.year));
	const maxMese = $derived(Math.max(1, ...mesi.map((m) => m.fatturato)));

	/* "Dove va ogni euro": ogni voce in percentuale del fatturato con il costo calcolato */
	const voci = $derived([
		{ label: 'Vinile', v: t.costo.vinile }, { label: 'Inchiostro', v: t.costo.stampa }, { label: 'Lamina', v: t.costo.lamina },
		{ label: 'Resina', v: t.costo.resina }, { label: 'Corriere', v: t.costo.corriere }
	].filter((x) => x.v > 0));
	const quota = (v: number) => (t.calcolato > 0 ? Math.max(0, Math.min(100, (v / t.calcolato) * 100)) : 0);
	const peggiori = $derived(delPeriodo.filter((o: OrdineMargine) => o.marginePct != null).sort((a: OrdineMargine, b: OrdineMargine) => (a.marginePct ?? 0) - (b.marginePct ?? 0)).slice(0, 5));

	/* scheda Ordini */
	let cerca = $state('');
	let filtro = $state<'tutti' | 'manca' | 'stima' | 'lette'>((q0.get('filtro') as 'manca') ?? 'tutti');
	let prodotto = $state('tutti');
	let ordina = $state<'data' | 'pct' | 'margine' | 'ricavo' | 'bobina'>('data');
	const bobinaOrdine = (o: OrdineMargine) => o.righe.reduce((s, r) => s + (r.costo.consumo?.bobinaMm ?? 0), 0);
	const elenco = $derived.by(() => {
		const q = cerca.trim().toLowerCase();
		const l = delPeriodo.filter((o: OrdineMargine) => {
			if (filtro === 'manca' && o.margine != null) return false;
			if (filtro === 'stima' && o.stato !== 'stima') return false;
			if (filtro === 'lette' && !o.lette) return false;
			if (prodotto !== 'tutti' && !o.righe.some((r) => r.product_slug === prodotto)) return false;
			if (q && !(o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.righe.some((r) => r.number.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)))) return false;
			return true;
		});
		if (ordina === 'pct') l.sort((a, b) => (a.marginePct ?? 1e9) - (b.marginePct ?? 1e9));
		else if (ordina === 'margine') l.sort((a, b) => (a.margine ?? 1e9) - (b.margine ?? 1e9));
		else if (ordina === 'ricavo') l.sort((a, b) => b.ricavo.totale - a.ricavo.totale);
		else if (ordina === 'bobina') l.sort((a, b) => bobinaOrdine(b) - bobinaOrdine(a));
		return l;
	});
	const prodottiPresenti = $derived([...new Set(delPeriodo.flatMap((o: OrdineMargine) => o.righe.filter((r) => r.costo.tipo === 'prodotto').map((r) => r.product_slug)))].sort());
	function vaiOrdini(f: typeof filtro) { filtro = f; vista = 'ordini'; window.scrollTo({ top: 0 }); }
	const dettaglio = (o: OrdineMargine) => `/dashboard/analisi-margini/ordine/${encodeURIComponent(o.key)}?torna=${encodeURIComponent(query + (filtro !== 'tutti' ? `&filtro=${filtro}` : ''))}`;
	const misura = (r: OrdineMargine['righe'][number]) => (r.costo.lettura ? `${mm(r.costo.lettura.w)}×${mm(r.costo.lettura.h)} mm` : '');
	const maxV = (l: { m2: number }[]) => Math.max(0.0001, ...l.map((x) => x.m2));
</script>

<svelte:head><title>Analisi margini | Dashboard Stickerprint</title></svelte:head>

<div class="mg-page">
	<header class="mg-head">
		<h1>Analisi margini</h1>
		<p class="lead">Quanto materiale usa ogni ordine, quanto costa e quanto resta. E-commerce e manuali, importi netti IVA esclusa.</p>
	</header>

	<!-- barra fissa: periodo, canale e schede (sul telefono resta sotto la barra blu) -->
	<div class="mg-bar">
		<div class="mg-period">
			<button type="button" class="mg-step" aria-label="Mese precedente" disabled={periodo === 'anno' || primoMese} onclick={() => sposta(-1)}>‹</button>
			<select class="mg-sel mg-sel--mese" aria-label="Mese" bind:value={periodo}>
				<option value="anno">Anno</option>
				{#each MESI as m, i (m)}<option value={String(i)}>{m}</option>{/each}
			</select>
			<select class="mg-sel" aria-label="Anno" value={data.year} onchange={(e) => goto(`?anno=${(e.currentTarget as HTMLSelectElement).value}&vista=${vista}`, { noScroll: true })}>
				{#each data.years as y (y)}<option value={y}>{y}</option>{/each}
			</select>
			<button type="button" class="mg-step" aria-label="Mese successivo" disabled={periodo === 'anno' || ultimoMese} onclick={() => sposta(1)}>›</button>
			<select class="mg-sel mg-sel--canale" aria-label="Canale" bind:value={canale}>
				<option value="tutti">Tutti</option><option value="ecommerce">Sito</option><option value="manuale">Manuali</option>
			</select>
		</div>
		<nav class="mg-tabs" aria-label="Sezioni dell'analisi">
			{#each VISTE as v (v.id)}
				<button type="button" class:is-on={vista === v.id} aria-current={vista === v.id ? 'page' : undefined} onclick={() => { vista = v.id; window.scrollTo({ top: 0 }); }}><span>{v.icon}</span>{v.label}{#if v.id === 'ordini' && t.daCompletare}<i class="mg-dot-n">{t.daCompletare}</i>{/if}</button>
			{/each}
		</nav>
	</div>

	{#if delPeriodo.length === 0}
		<div class="mg-card mg-empty"><b>Nessun ordine in {periodoLabel}</b><span>Cambia mese o canale qui sopra.</span></div>
	{:else if vista === 'riepilogo'}
		<!-- ================= RIEPILOGO ================= -->
		<section class="mg-hero {classeMargine(t.marginePct)}">
			<small>Margine · {periodoLabel}</small>
			<div class="mg-hero__row"><b>{euro(t.margine)}</b><span class="mg-pill {classeMargine(t.marginePct)}">{perc(t.marginePct)}</span></div>
			<p>su {euro(t.calcolato)} di fatturato netto, con {euro(t.costo.totale)} di costi</p>
			{#if t.daCompletare}<button type="button" class="mg-hero__warn" onclick={() => vaiOrdini('manca')}>⚠️ {t.daCompletare} {t.daCompletare === 1 ? 'ordine' : 'ordini'} senza misura, fuori dal margine ({euro(t.fatturato - t.calcolato)}) › completali</button>{/if}
		</section>

		<div class="mg-tiles">
			<div class="mg-tile"><small>Fatturato netto</small><b>{euro(t.fatturato)}</b><span>{t.ordini} ordini · {t.sito} sito · {t.manuali} manuali</span></div>
			<div class="mg-tile"><small>Costo</small><b>{euro(t.costo.totale)}</b><span>materiale {euro(t.costo.totale - t.costo.corriere)} · corriere {euro(t.costo.corriere)}</span></div>
			<button type="button" class="mg-tile mg-tile--link" onclick={() => { vista = 'materiale'; window.scrollTo({ top: 0 }); }}><small>Bobina usata</small><b>{metri(mat.bobinaMm)}</b><span>{mq(mat.bobinaM2)} · resa {perc(mat.resaPct)} ›</span></button>
			<div class="mg-tile"><small>Pezzi stampati</small><b>{pezzi(mat.pezziDaFare)}</b><span>{pezzi(mat.pezzi)} ordinati + scarto</span></div>
		</div>

		<section class="mg-card">
			<h2>Dove va ogni euro</h2>
			<p class="mg-note">Su {euro(t.calcolato)} incassati (ordini con il costo calcolato).</p>
			<div class="mg-bars">
				{#each voci as x (x.label)}
					<div class="mg-barrow"><span class="mg-barrow__l">{x.label}</span><span class="mg-barrow__track"><i style="width:{quota(x.v)}%"></i></span><span class="mg-barrow__v">{euro(x.v)} <small>{perc(Math.round(quota(x.v) * 10) / 10)}</small></span></div>
				{/each}
				<div class="mg-barrow is-strong"><span class="mg-barrow__l">Margine</span><span class="mg-barrow__track"><i style="width:{quota(t.margine)}%"></i></span><span class="mg-barrow__v">{euro(t.margine)} <small>{perc(t.marginePct)}</small></span></div>
			</div>
		</section>

		<section class="mg-card">
			<h2>Da dove arriva il fatturato</h2>
			<dl class="mg-list">
				<div><dt>Prodotti</dt><dd>{euro(t.ricavo.prodotti)}</dd></div>
				<div><dt>Spedizioni addebitate</dt><dd>{euro(t.ricavo.spedizione)}</dd></div>
				{#if t.ricavo.express}<div><dt>Express</dt><dd>{euro(t.ricavo.express)}</dd></div>{/if}
				{#if t.ricavo.servizi}<div><dt>Altri servizi (righe senza materiale)</dt><dd>{euro(t.ricavo.servizi)}</dd></div>{/if}
			</dl>
		</section>

		{#if peggiori.length}
			<section class="mg-card">
				<h2>Margine più basso</h2>
				<div class="mg-mini">
					{#each peggiori as o (o.key)}
						<a href={dettaglio(o)}><b>{o.number}</b><span>{o.customer}</span><span class="mg-pill {classeMargine(o.marginePct)}">{perc(o.marginePct)}</span><em>{euro(o.margine ?? 0)}</em></a>
					{/each}
				</div>
			</section>
		{/if}

		{#if periodo === 'anno'}
			<section class="mg-card">
				<h2>Mese per mese</h2>
				<p class="mg-note">Barra: fatturato del mese, parte scura: margine. Tocca un mese per aprirlo.</p>
				<div class="mg-months">
					{#each mesi as m (m.mese)}
						<button type="button" disabled={!m.ordini} onclick={() => (periodo = String(m.mese))}>
							<span class="mg-months__l">{MONTHS[m.mese]}</span>
							<span class="mg-months__track"><i style="width:{(m.fatturato / maxMese) * 100}%"><u style="width:{m.fatturato > 0 ? Math.max(0, Math.min(100, (m.margine / m.fatturato) * 100)) : 0}%"></u></i></span>
							<span class="mg-months__v">{m.ordini ? euro(m.margine) : '—'} <small>{m.ordini ? perc(m.marginePct) : ''}</small></span>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{:else if vista === 'materiale'}
		<!-- ================= MATERIALE ================= -->
		<p class="mg-note">Ogni riga è impaginata come nello Studio: bobina da {data.parametri.bobina / 10} cm, crocini e codice a barre, +{Math.round(data.parametri.scarto * 100)}% di pezzi per gli scarti, 5 cm di stacco fra le strisce. Ogni ordine è contato da solo: stampando più ordini sulla stessa bobina si consuma un po' meno. {#if mat.senzaConsumo}<b>{mat.senzaConsumo} {mat.senzaConsumo === 1 ? 'riga' : 'righe'} senza misura non {mat.senzaConsumo === 1 ? 'è contata' : 'sono contate'}.</b>{/if}</p>

		<div class="mg-tiles">
			<div class="mg-tile is-main"><small>Bobina usata</small><b>{metri(mat.bobinaMm)}</b><span>× {data.parametri.bobina / 10} cm = {mq(mat.bobinaM2)}</span></div>
			<div class="mg-tile"><small>Diventa adesivo</small><b>{mq(mat.utileM2)}</b><span>resa {perc(mat.resaPct)} della bobina</span></div>
			<div class="mg-tile"><small>Sfrido</small><b>{mq(mat.sfridoM2)}</b><span>margini, spazi, scarti, stacco</span></div>
			<div class="mg-tile"><small>Pezzi stampati</small><b>{pezzi(mat.pezziDaFare)}</b><span>{pezzi(mat.pezzi)} ordinati</span></div>
			<div class="mg-tile"><small>Strisce</small><b>{pezzi(mat.strisce)}</b><span>{mat.fogli ? `${pezzi(mat.fogli)} fogli` : 'stampate e tagliate'}</span></div>
			<div class="mg-tile"><small>Inchiostro</small><b>{mq(mat.stampaM2)}</b><span>superficie stampata</span></div>
		</div>

		<section class="mg-card">
			<h2>Vinile, per tipo</h2>
			{#if mat.vinili.length === 0}<p class="mg-note">Nessuna riga con la misura.</p>{/if}
			<div class="mg-rows">
				{#each mat.vinili as v (v.id)}
					<div class="mg-mrow">
						<div class="mg-mrow__h"><b>{v.label}</b><span>{v.righe} {v.righe === 1 ? 'riga' : 'righe'} · {pezzi(v.pezzi)} pezzi</span></div>
						<div class="mg-mrow__bar"><i style="width:{(v.m2 / maxV(mat.vinili)) * 100}%"></i></div>
						<div class="mg-mrow__v"><b>{metri(v.bobinaMm)}</b> di bobina <span>= {mq(v.m2)}</span></div>
					</div>
				{/each}
			</div>
		</section>

		<div class="mg-two">
			<section class="mg-card">
				<h2>Lamina</h2>
				{#if mat.lamine.length === 0}<p class="mg-note">Nessuna riga laminata in {periodoLabel}.</p>{/if}
				<div class="mg-rows">
					{#each mat.lamine as v (v.id)}
						<div class="mg-mrow">
							<div class="mg-mrow__h"><b>{v.label}</b><span>{v.righe} {v.righe === 1 ? 'riga' : 'righe'}</span></div>
							<div class="mg-mrow__bar"><i style="width:{(v.m2 / maxV(mat.lamine)) * 100}%"></i></div>
							<div class="mg-mrow__v"><b>{mq(v.m2)}</b> <span>{metri(v.bobinaMm)} di film</span></div>
						</div>
					{/each}
				</div>
			</section>
			<section class="mg-card">
				<h2>Resina</h2>
				{#if mat.resina.righe === 0}<p class="mg-note">Nessun resinato in {periodoLabel}.</p>
				{:else}
					<div class="mg-big">{grammi(mat.resina.g)}</div>
					<p class="mg-note">{pezzi(mat.resina.cm2)} cm² colati su {pezzi(mat.resina.pezzi)} pezzi · {mat.resina.righe} {mat.resina.righe === 1 ? 'riga' : 'righe'}</p>
				{/if}
			</section>
		</div>

		<section class="mg-card">
			<h2>Bobina per prodotto</h2>
			<div class="mg-rows">
				{#each mat.prodotti as v (v.id)}
					<div class="mg-mrow">
						<div class="mg-mrow__h"><b><i class="mg-dot" style="background:{coloreProdotto(v.id)}"></i>{v.label}</b><span>{pezzi(v.pezzi)} pezzi stampati</span></div>
						<div class="mg-mrow__bar"><i style="width:{(v.m2 / maxV(mat.prodotti)) * 100}%"></i></div>
						<div class="mg-mrow__v"><b>{metri(v.bobinaMm)}</b> <span>= {mq(v.m2)}</span></div>
					</div>
				{/each}
			</div>
		</section>
	{:else if vista === 'ordini'}
		<!-- ================= ORDINI ================= -->
		<div class="mg-filters">
			<input class="mg-search" type="search" placeholder="Numero, cliente o descrizione…" bind:value={cerca} />
			<div class="mg-chips" role="group" aria-label="Filtro">
				{#each [['tutti', 'Tutti'], ['manca', `Da completare${t.daCompletare ? ' · ' + t.daCompletare : ''}`], ['stima', 'Stimati'], ['lette', 'Letti dalla descrizione']] as [id, l] (id)}
					<button type="button" class:is-on={filtro === id} onclick={() => (filtro = id as typeof filtro)}>{l}</button>
				{/each}
			</div>
			<div class="mg-filters__row">
				<select class="mg-sel" bind:value={prodotto} aria-label="Prodotto"><option value="tutti">Tutti i prodotti</option>{#each prodottiPresenti as s (s)}<option value={s}>{nomeProdotto(s)}</option>{/each}</select>
				<select class="mg-sel" bind:value={ordina} aria-label="Ordina"><option value="data">Più recenti</option><option value="pct">Margine % più basso</option><option value="margine">Margine € più basso</option><option value="ricavo">Fatturato più alto</option><option value="bobina">Più bobina usata</option></select>
				<span class="mg-count">{elenco.length} ordini</span>
			</div>
		</div>

		<div class="mg-orders">
			<div class="mg-orders__head" aria-hidden="true"><span>Ordine</span><span>Cliente e prodotti</span><span>Bobina</span><span>Fatturato</span><span>Costo</span><span>Margine</span></div>
			{#each elenco as o (o.key)}
				<a class="mg-ord" href={dettaglio(o)}>
					<div class="mg-ord__id"><b>{o.number}</b> <span title={CHANNEL_ICON[o.channel]?.label}>{CHANNEL_ICON[o.channel]?.icon ?? ''}</span><small>{dmy(o.created_at)}</small></div>
					<div class="mg-ord__who">
						<b>{o.customer}</b>
						{#each o.righe as r (r.id)}
							<span class="mg-ord__item"><i class="mg-dot" style="background:{r.costo.tipo === 'servizio' ? '#cbd5e1' : coloreProdotto(r.product_slug)}"></i>{r.qty.toLocaleString('it-IT')} × {r.costo.tipo === 'servizio' ? (r.description || r.product_name) : r.product_name} <small>{misura(r)}{r.costo.lettura ? ' · ' + r.costo.lettura.materialeLabel : ''}{r.costo.consumo?.laminaTipo ? ' · lamina ' + r.costo.consumo.laminaTipo : ''}</small></span>
						{/each}
						<span class="mg-flags">
							{#if o.margine == null}<em class="is-manca">da completare</em>{:else if o.stato === 'stima'}<em class="is-stima">stima</em>{/if}
							{#if o.lette}<em class="is-letto">letto dalla descrizione</em>{/if}
						</span>
					</div>
					<div class="mg-ord__n mg-ord__n--b" data-l="Bobina">{bobinaOrdine(o) ? metri(bobinaOrdine(o)) : '—'}</div>
					<div class="mg-ord__n mg-ord__n--f" data-l="Fatturato">{euro(o.ricavo.totale)}</div>
					<div class="mg-ord__n mg-ord__n--c" data-l="Costo">{o.margine == null ? '—' : euro(o.costo.totale)}</div>
					<div class="mg-ord__m">{#if o.margine == null}<b>—</b>{:else}<b>{euro(o.margine)}</b><span class="mg-pill {classeMargine(o.marginePct)}">{perc(o.marginePct)}</span>{/if}</div>
				</a>
			{:else}
				<div class="mg-card mg-empty"><b>Nessun ordine con questi filtri</b></div>
			{/each}
		</div>
	{:else}
		<!-- ================= PRODOTTI ================= -->
		<p class="mg-note">Solo le righe dei prodotti: corriere, spedizione addebitata ed express stanno sull'ordine.</p>
		<div class="mg-prods">
			{#each prodotti as p (p.slug)}
				<section class="mg-card mg-prod">
					<header><b><i class="mg-dot" style="background:{coloreProdotto(p.slug)}"></i>{nomeProdotto(p.slug)}</b><span class="mg-pill {classeMargine(p.marginePct)}">{perc(p.marginePct)}</span></header>
					<p class="mg-note">{p.ordini} {p.ordini === 1 ? 'ordine' : 'ordini'} · {pezzi(p.pezzi)} pezzi · {mq(p.bobinaM2)} di bobina{#if p.senzaCosto} · <b>{p.senzaCosto} senza misura</b>{/if}</p>
					<dl class="mg-list">
						<div><dt>Fatturato</dt><dd>{euro(p.ricavo)}</dd></div>
						<div><dt>Costo materiale</dt><dd>{euro(p.costo)}</dd></div>
						<div class="is-strong"><dt>Margine</dt><dd>{euro(p.margine)}</dd></div>
					</dl>
					<div class="mg-mrow__bar" title="Margine sul fatturato"><i style="width:{Math.max(0, Math.min(100, p.marginePct ?? 0))}%"></i></div>
				</section>
			{/each}
		</div>
	{/if}
</div>
