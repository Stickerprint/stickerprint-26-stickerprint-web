<script lang="ts">
	import { CATS, MONTHS, ORDER_STATUS, CHANNEL_ICON, money, dmy } from '$lib/dashboard/orders';
	import type { OrdineMargine } from './+page.server';
	let { data } = $props();

	const year = $derived(data.year);
	/* si parte dal mese in corso (anno in corso) o da tutto l'anno (anni passati) */
	let month = $state<string | null>(new Date().getFullYear() === data.year ? String(new Date().getMonth()) : null);
	let annoVisto = data.year;
	$effect(() => { const y = data.year; if (y === annoVisto) return; annoVisto = y; month = y === new Date().getFullYear() ? String(new Date().getMonth()) : null; });
	let channel = $state('all');
	let prodotto = $state('all');
	let stato = $state('all');
	let search = $state('');
	let sort = $state<'data' | 'margine' | 'pct' | 'ricavo'>('data');
	let aperti = $state<Set<string>>(new Set());
	const toggle = (k: string) => { const s = new Set(aperti); s.has(k) ? s.delete(k) : s.add(k); aperti = s; };

	const pctFmt = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })} %`);
	const mqFmt = (v: number) => `${v.toLocaleString('it-IT', { maximumFractionDigits: 2 })} m²`;
	const nomeProdotto = (slug: string) => CATS[slug]?.name ?? (slug === 'kit_adesivi' ? 'Kit di adesivi' : slug.replace(/_/g, ' '));
	const classeMargine = (p: number | null) => (p == null ? '' : p < 20 ? 'is-bad' : p < 50 ? 'is-mid' : 'is-good');

	const monthKey = (d: string) => { const x = new Date(d); const y = x.getFullYear(); return y < year ? 'prev' : y > year ? 'next' : String(x.getMonth()); };
	/* riquadri dei mesi: ordini e margine di ogni mese dell'anno scelto */
	const buckets = $derived.by(() => {
		const b: Record<string, { n: number; margine: number }> = { prev: { n: 0, margine: 0 }, next: { n: 0, margine: 0 } };
		for (let m = 0; m < 12; m++) b[m] = { n: 0, margine: 0 };
		for (const o of data.ordini) { const k = monthKey(o.created_at); b[k].n++; b[k].margine += o.margine; }
		return b;
	});
	const meseLabel = $derived(month === null ? `tutto il ${year}` : month === 'prev' ? 'anni precedenti' : month === 'next' ? 'anni successivi' : `${MONTHS[Number(month)]} ${year}`);

	const delPeriodo = $derived(data.ordini.filter((o: OrdineMargine) => month === null || monthKey(o.created_at) === month));
	const list = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const l = delPeriodo.filter((o: OrdineMargine) => {
			if (channel !== 'all' && o.channel !== channel) return false;
			if (prodotto !== 'all' && !o.righe.some((r) => r.product_slug === prodotto)) return false;
			if (stato !== 'all' && o.stato !== stato) return false;
			if (q && !(o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.righe.some((r) => r.number.toLowerCase().includes(q)))) return false;
			return true;
		});
		if (sort === 'margine') l.sort((a, b) => a.margine - b.margine);
		else if (sort === 'pct') l.sort((a, b) => (a.marginePct ?? 999) - (b.marginePct ?? 999));
		else if (sort === 'ricavo') l.sort((a, b) => b.ricavo - a.ricavo);
		return l;
	});

	/* numeri in alto: solo gli ordini del periodo che passano i filtri */
	const kpi = $derived.by(() => {
		const k = { ordini: list.length, ecom: 0, manuali: 0, senzaCosto: 0, stime: 0, ricavo: 0, ricavoConCosto: 0, costo: 0, materiale: 0, stampa: 0, lamina: 0, resina: 0, spedizioni: 0, spedizioniRicavo: 0, mq: 0, pezzi: 0 };
		for (const o of list) {
			o.channel === 'manuale' ? k.manuali++ : k.ecom++;
			k.ricavo += o.ricavo; k.pezzi += o.qty;
			if (o.stato === 'manca') { k.senzaCosto++; continue; }
			if (o.stato === 'stima') k.stime++;
			k.ricavoConCosto += o.ricavo; k.costo += o.costo; k.mq += o.mq; k.spedizioni += o.extra.spedizioneCosto; k.spedizioniRicavo += o.extra.spedizioneRicavo + o.extra.expressRicavo;
			for (const r of o.righe) { k.materiale += r.costo.materiale; k.stampa += r.costo.stampa; k.lamina += r.costo.lamina; k.resina += r.costo.resina; }
		}
		const margine = k.ricavoConCosto - k.costo;
		return { ...k, margine, pct: k.ricavoConCosto > 0 ? Math.round((margine / k.ricavoConCosto) * 1000) / 10 : null, costoMedio: k.ordini - k.senzaCosto > 0 ? k.costo / (k.ordini - k.senzaCosto) : 0 };
	});

	/* per prodotto: dove si guadagna e dove no */
	const perProdotto = $derived.by(() => {
		const m = new Map<string, { slug: string; ordini: Set<string>; pezzi: number; ricavo: number; ricavoConCosto: number; costo: number; mq: number; senzaCosto: number }>();
		for (const o of list) for (const r of o.righe) {
			const p = m.get(r.product_slug) ?? { slug: r.product_slug, ordini: new Set<string>(), pezzi: 0, ricavo: 0, ricavoConCosto: 0, costo: 0, mq: 0, senzaCosto: 0 };
			p.ordini.add(o.key); p.pezzi += r.qty; p.ricavo += r.ricavo;
			if (r.costo.stato === 'manca') p.senzaCosto++; else { p.ricavoConCosto += r.ricavo; p.costo += r.costo.totale; p.mq += r.costo.mq; }
			m.set(r.product_slug, p);
		}
		return [...m.values()].map((p) => ({ ...p, n: p.ordini.size, margine: p.ricavoConCosto - p.costo, pct: p.ricavoConCosto > 0 ? Math.round(((p.ricavoConCosto - p.costo) / p.ricavoConCosto) * 1000) / 10 : null })).sort((a, b) => b.ricavo - a.ricavo);
	});
	const prodottiPresenti = $derived([...new Set(data.ordini.flatMap((o: OrdineMargine) => o.righe.map((r) => r.product_slug)))].sort());
</script>

<svelte:head><title>Analisi margini | Dashboard Stickerprint</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Analisi margini {year}</h1><p class="lead">Ogni ordine, e-commerce e manuale, con quanto costa produrlo (materiale impaginato come nello Studio, più il corriere) e quanto ci resta. Manodopera e imballo non sono ancora dentro.</p></div>
	<div class="year-bar">{#each data.years as y (y)}<a href="?anno={y}" class:is-active={y === data.year}>{y}</a>{/each}</div>
</div>

<div class="month-bar">
	<div class="month-cells">
		{#each [['prev', 'Preced.'], ...MONTHS.map((m, i) => [String(i), m]), ['next', 'Succ.']] as [k, label] (k)}
			<button type="button" class="month-cell" class:has-data={buckets[k].n > 0} class:is-active={month === k} class:is-current={year === new Date().getFullYear() && k === String(new Date().getMonth())} onclick={() => (month = month === k ? null : k)}>
				<span class="mc-label">{label}</span><span class="mc-doc">{buckets[k].n} ord.</span><span class="mc-amt">{money(buckets[k].margine)}</span>
			</button>
		{/each}
	</div>
	<button type="button" class="btn btn--xs {month === null ? 'btn--blue' : 'btn--ghost'}" onclick={() => (month = null)}>Tutto l'anno</button>
</div>

<p class="stats5-rif">Stai guardando <b>{meseLabel}</b>: riquadri, prodotti ed elenco qui sotto sono solo di {meseLabel} e degli ordini che passano i filtri. Importi netti, IVA esclusa.</p>

<div class="mg-kpis">
	<div class="mg-kpi"><small>Fatturato netto</small><b>{money(kpi.ricavo)}</b><i>{kpi.ordini} ordini · {kpi.ecom} e-commerce · {kpi.manuali} manuali{#if kpi.spedizioniRicavo} · di cui spedizioni ed express {money(kpi.spedizioniRicavo)}{/if}</i></div>
	<div class="mg-kpi"><small>Costo di produzione</small><b>{money(kpi.costo)}</b><i>materiale {money(kpi.materiale)} · inchiostro {money(kpi.stampa)}{#if kpi.lamina} · lamina {money(kpi.lamina)}{/if}{#if kpi.resina} · resina {money(kpi.resina)}{/if} · corriere {money(kpi.spedizioni)}</i></div>
	<div class="mg-kpi is-main {classeMargine(kpi.pct)}"><small>Margine</small><b>{money(kpi.margine)}</b><i>{#if kpi.senzaCosto}su {money(kpi.ricavoConCosto)} di ordini con costo calcolato{:else}sul fatturato di {meseLabel}{/if}</i></div>
	<div class="mg-kpi {classeMargine(kpi.pct)}"><small>Margine %</small><b>{pctFmt(kpi.pct)}</b><i>costo medio {money(kpi.costoMedio)} per ordine</i></div>
	<div class="mg-kpi"><small>Bobina consumata</small><b>{mqFmt(kpi.mq)}</b><i>{kpi.pezzi.toLocaleString('it-IT')} pezzi ordinati, +{Math.round(data.parametri.scarto * 100)}% di scarto</i></div>
	<div class="mg-kpi" class:is-warn={kpi.senzaCosto > 0}><small>Da controllare</small><b>{kpi.senzaCosto}<small style="font-size:14px;color:var(--muted)"> senza costo</small></b><i>{kpi.stime} stimati · il motivo è scritto sulla riga</i></div>
</div>

<div class="dcard">
	<h3>Per prodotto · {meseLabel} <small class="mg-muted" style="font-weight:600">(solo le righe prodotto: corriere, spedizione addebitata ed express stanno sull'ordine)</small></h3>
	{#if perProdotto.length === 0}<p class="osub">Nessun ordine in questo periodo.</p>{:else}
	<table class="dtable mg-table">
		<thead><tr><th>Prodotto</th><th>Ordini</th><th>Pezzi</th><th>Bobina</th><th class="num">Fatturato</th><th class="num">Costo</th><th class="num">Margine</th><th class="num">%</th></tr></thead>
		<tbody>
			{#each perProdotto as p (p.slug)}
				<tr>
					<td><span class="mg-dot" style="background:{CATS[p.slug]?.color ?? '#94a3b8'}"></span>{nomeProdotto(p.slug)}{#if p.senzaCosto} <small class="mg-muted">({p.senzaCosto} righe senza costo)</small>{/if}</td>
					<td data-l="Ordini">{p.n}</td><td data-l="Pezzi">{p.pezzi.toLocaleString('it-IT')}</td><td data-l="Bobina">{mqFmt(p.mq)}</td>
					<td class="num" data-l="Fatturato">{money(p.ricavo)}</td><td class="num" data-l="Costo">{money(p.costo)}</td>
					<td class="num" data-l="Margine"><b>{money(p.margine)}</b></td><td class="num" data-l="Margine %"><span class="mg-pct {classeMargine(p.pct)}">{pctFmt(p.pct)}</span></td>
				</tr>
			{/each}
		</tbody>
	</table>
	{/if}
</div>

<div class="toolbar">
	<input class="mg-search" type="search" placeholder="Cerca numero o cliente…" bind:value={search} />
	<select bind:value={channel}><option value="all">Tutti i canali</option><option value="ecommerce">E-commerce</option><option value="manuale">Manuali</option></select>
	<select bind:value={prodotto}><option value="all">Tutti i prodotti</option>{#each prodottiPresenti as s (s)}<option value={s}>{nomeProdotto(s)}</option>{/each}</select>
	<select bind:value={stato}><option value="all">Costo: tutti</option><option value="ok">Calcolato</option><option value="stima">Stimato</option><option value="manca">Senza costo</option></select>
	<select bind:value={sort}><option value="data">Ordina: data</option><option value="margine">Margine più basso</option><option value="pct">% più bassa</option><option value="ricavo">Fatturato più alto</option></select>
	<span class="mg-muted">{list.length} ordini</span>
</div>

<div class="dcard" style="padding:0;overflow:auto">
	<table class="dtable mg-table">
		<thead><tr><th></th><th>Data</th><th>Ordine</th><th>Cliente</th><th>Prodotti</th><th>Bobina</th><th class="num">Fatturato</th><th class="num">Costo</th><th class="num">Margine</th><th class="num">%</th></tr></thead>
		<tbody>
			{#each list as o (o.key)}
				<tr class="mg-row" class:is-open={aperti.has(o.key)}>
					<td><button type="button" class="mg-exp" onclick={() => toggle(o.key)} aria-label="Dettaglio">{aperti.has(o.key) ? '▾' : '▸'}</button></td>
					<td class="mg-nowrap" data-l="Data">{dmy(o.created_at)}</td>
					<td class="mg-nowrap"><a class="link" href="/dashboard/fatturazione/ordini/{o.key}"><b>{o.number}</b></a> <span title={CHANNEL_ICON[o.channel]?.label}>{CHANNEL_ICON[o.channel]?.icon ?? ''}</span><br /><small class="mg-muted" style="color:{ORDER_STATUS[o.status]?.color}">{ORDER_STATUS[o.status]?.label ?? o.status}</small></td>
					<td data-l="Cliente">{o.customer}</td>
					<td class="mg-prod">
						{#each o.righe as r (r.id)}
							<div class="mg-item"><span class="mg-dot" style="background:{CATS[r.product_slug]?.color ?? '#94a3b8'}"></span>{r.qty.toLocaleString('it-IT')} × {r.product_name} <small class="mg-muted">{r.misura}{#if r.materiale} · {r.materiale}{/if}{#if r.finitura && r.finitura !== 'nessuna'} · {r.finitura}{/if}</small>
								{#if r.costo.stato === 'manca'}<span class="mg-flag is-manca" title={r.costo.motivo}>senza costo</span>{:else if r.costo.stato === 'stima'}<span class="mg-flag is-stima" title={r.costo.motivo}>stima</span>{/if}</div>
						{/each}
					</td>
					<td class="mg-nowrap" data-l="Bobina">{o.stato === 'manca' && o.mq === 0 ? '—' : mqFmt(o.mq)}</td>
					<td class="num" data-l="Fatturato">{money(o.ricavo)}</td>
					<td class="num" data-l="Costo">{o.stato === 'manca' ? '—' : money(o.costo)}</td>
					<td class="num" data-l="Margine"><b>{o.stato === 'manca' ? '—' : money(o.margine)}</b></td>
					<td class="num" data-l="Margine %"><span class="mg-pct {classeMargine(o.marginePct)}">{pctFmt(o.marginePct)}</span></td>
				</tr>
				{#if aperti.has(o.key)}
					<tr class="mg-detail"><td></td><td colspan="9">
						{#each o.righe as r (r.id)}
							{@const c = r.costo}
							<div class="mg-dett">
								<div class="mg-dett__head"><b>{r.number}</b> · {r.qty.toLocaleString('it-IT')} × {r.product_name} · {r.misura}{#if c.unitari.materialeLabel !== '—'} · {c.unitari.materialeLabel}{/if}{#if c.laminato} · laminato{/if}{#if c.resinato} · resinato{/if}</div>
								{#if c.stato === 'manca'}
									<p class="mg-why">⚠️ Costo non calcolato: {c.motivo}</p>
								{:else}
									{#if c.motivo}<p class="mg-why">ℹ️ Stima: {c.motivo}</p>{/if}
									{#if c.impaginazione}
										{@const im = c.impaginazione}
										<p class="mg-imp">Impaginazione: {im.pezziDaFare.toLocaleString('it-IT')} pezzi da fare (+{Math.round(data.parametri.scarto * 100)}% scarto)
											{#if im.modo === 'fogli'} · {im.fogli} fogli da {im.perFoglio} · {im.strisce} strisce{:else if im.modo === 'nessuno'} · non impaginabile{:else} · {im.perStriscia} per striscia · {im.strisce} strisce{/if}
											· {(im.bobinaMm / 10).toLocaleString('it-IT', { maximumFractionDigits: 0 })} cm di bobina da {data.parametri.bobina / 10} cm = <b>{mqFmt(c.mq)}</b></p>
									{/if}
									<div class="mg-voci">
										<span>Materiale <b>{money(c.materiale)}</b><small>{mqFmt(c.mq)} × {money(c.unitari.materialeM2)}/m²</small></span>
										<span>Inchiostro <b>{money(c.stampa)}</b><small>{mqFmt(c.mqStampa)} stampati × {money(c.unitari.stampaM2)}/m²</small></span>
										{#if c.laminato}<span>Lamina <b>{money(c.lamina)}</b><small>{mqFmt(c.mq)} × {money(c.unitari.laminaM2)}/m²</small></span>{/if}
										{#if c.resinato}<span>Resina <b>{money(c.resina)}</b><small>{c.unitari.resinaCm2.toLocaleString('it-IT', { maximumFractionDigits: 5 })} €/cm²</small></span>{/if}
										<span class="mg-voci__tot">Costo <b>{money(c.totale)}</b><small>ricavo {money(r.ricavo)} → margine <b class="mg-pct {classeMargine(r.marginePct)}">{money(r.margine)} · {pctFmt(r.marginePct)}</b></small></span>
									</div>
								{/if}
							</div>
						{/each}
						<div class="mg-dett mg-dett--ord">
							<div class="mg-dett__head"><b>Ordine intero</b>{#if o.extra.fattura} · fattura {o.extra.fattura}{/if}</div>
							<div class="mg-voci">
								<span>Corriere <b>{money(o.extra.spedizioneCosto)}</b><small>{o.extra.spedizioneCosto ? `a carico nostro, ${money(data.parametri.spedizione)} + IVA` : 'non a carico nostro'}</small></span>
								<span>Spedizione addebitata <b>{money(o.extra.spedizioneRicavo)}</b><small>{o.extra.fattura ? 'dalla fattura' : 'nessuna fattura trovata'}</small></span>
								{#if o.extra.expressRicavo}<span>Express <b>{money(o.extra.expressRicavo)}</b><small>dalla fattura</small></span>{/if}
								<span class="mg-voci__tot">Totale ordine <b>{o.stato === 'manca' ? '—' : money(o.margine)}</b><small>ricavo {money(o.ricavo)} − costo {o.stato === 'manca' ? '—' : money(o.costo)}</small></span>
							</div>
						</div>
					</td></tr>
				{/if}
			{:else}
				<tr><td colspan="10" class="osub" style="padding:24px">Nessun ordine con questi filtri.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<details class="dcard mg-come">
	<summary><b>Come calcolo il costo</b> · costi unitari presi dai preventivatori</summary>
	<ol>
		<li>Ogni riga si impagina come nello Studio: bobina da {data.parametri.bobina / 10} cm, pezzi a {data.parametri.gap} mm l'uno dall'altro (fogli a {data.parametri.gapFogli} mm), crocini e codice a barre ai bordi, +{Math.round(data.parametri.scarto * 100)}% di pezzi per gli scarti. Resinati ed etichette vanno su fogli circa A4 (resinati: multipli di 10 aghi).</li>
		<li><b>Materiale</b>: centimetri di bobina (strisce più 5 cm di stacco fra una e l'altra) × larghezza bobina × costo d'acquisto del vinile (€/m², senza ricarico).</li>
		<li><b>Inchiostro</b>: area dei pezzi stampati × costo stampa €/m². <b>Lamina</b>: tutta la bobina consumata × costo lamina €/m² (solo se la riga è laminata; mai sul rilievo). <b>Resina</b>: cm² dei pezzi × costo al kg × grammi per cm².</li>
		<li><b>Corriere</b>: {money(data.parametri.spedizione)} + IVA per ogni ordine spedito a carico nostro (tutti quelli del sito, i manuali "a carico del mittente"); zero con corriere a carico del destinatario o consegna diretta.</li>
		<li><b>Ricavo</b>: netto delle righe meno il codice sconto, più la spedizione addebitata al cliente e l'express presi dalla fattura, IVA esclusa. Margine = ricavo − costo.</li>
		<li>Non dentro, per ora: manodopera, imballo, commissioni di pagamento, avvio macchina.</li>
	</ol>
	<table class="dtable mg-table" style="margin-top:8px">
		<thead><tr><th>Listino</th><th>Stampa €/m²</th><th>Lamina €/m²</th><th>Resina €/cm²</th><th>Materiali (costo €/m²)</th></tr></thead>
		<tbody>
			{#each data.listini as l (l.slug)}
				<tr><td><a class="link" href="/dashboard/preventivatori/{l.slug}">{nomeProdotto(l.slug)}</a></td><td>{money(l.stampaM2)}</td><td>{l.laminaM2 == null ? '—' : money(l.laminaM2)}</td><td>{l.resinaCm2 == null ? '—' : l.resinaCm2.toLocaleString('it-IT', { maximumFractionDigits: 5 })}</td><td><small>{l.materiali.map((m) => `${m.label} ${money(m.costM2)}`).join(' · ')}</small></td></tr>
			{/each}
		</tbody>
	</table>
</details>

<style>
	.mg-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
	.mg-kpi { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; display: grid; gap: 2px; align-content: start; }
	.mg-kpi small { font-size: 11.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
	.mg-kpi b { font-family: var(--font-display); font-size: 24px; line-height: 1.1; letter-spacing: -0.02em; }
	.mg-kpi i { font-style: normal; font-size: 11.5px; color: var(--muted); font-weight: 600; }
	.mg-kpi.is-main { background: var(--navy); color: #fff; border-color: var(--navy); }
	.mg-kpi.is-main small, .mg-kpi.is-main i { color: #c7cbea; }
	.mg-kpi.is-good b { color: #15803d; } .mg-kpi.is-mid b { color: #d97706; } .mg-kpi.is-bad b { color: #dc2626; }
	.mg-kpi.is-main.is-good b, .mg-kpi.is-main.is-mid b, .mg-kpi.is-main.is-bad b { color: #fff; }
	.mg-kpi.is-warn { border-color: #fdba74; background: #fff8f1; }
	.mg-table th.num, .mg-table td.num { text-align: right; white-space: nowrap; }
	.mg-nowrap { white-space: nowrap; }
	.mg-muted { color: var(--muted); font-weight: 600; font-size: 12px; }
	.mg-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
	.mg-item { font-size: 13px; line-height: 1.35; padding: 2px 0; }
	.mg-flag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; cursor: help; }
	.mg-flag.is-manca { background: #fbe3e1; color: #b3261e; } .mg-flag.is-stima { background: #fef6db; color: #a16207; }
	.mg-pct { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12.5px; background: #eef0f3; color: #475569; }
	.mg-pct.is-good { background: #dcfce7; color: #15803d; } .mg-pct.is-mid { background: #fef3c7; color: #b45309; } .mg-pct.is-bad { background: #fee2e2; color: #b91c1c; }
	.mg-exp { background: none; border: 0; font-size: 14px; cursor: pointer; color: var(--muted); padding: 2px 4px; }
	.mg-row.is-open td { border-bottom: 0; background: #f8f9fc; }
	.mg-detail td { background: #f8f9fc; padding: 4px 10px 14px; }
	.mg-dett { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; margin-top: 6px; font-size: 13px; }
	.mg-dett__head { margin-bottom: 4px; }
	.mg-dett--ord { background: #f3f5ff; }
	.mg-why { margin: 4px 0; font-size: 12.5px; color: #a16207; }
	.mg-imp { margin: 4px 0 8px; font-size: 12.5px; color: var(--ink-soft); }
	.mg-voci { display: flex; flex-wrap: wrap; gap: 8px 22px; }
	.mg-voci span { display: grid; font-size: 12px; color: var(--muted); font-weight: 600; }
	.mg-voci b { font-family: var(--font-display); font-size: 16px; color: var(--ink); }
	.mg-voci small { font-size: 11px; font-weight: 500; }
	.mg-voci__tot { margin-left: auto; text-align: right; }
	.mg-search { padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; font: inherit; font-size: 14px; min-width: 220px; }
	.toolbar select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; font-size: 13px; background: #fff; }
	.mg-come summary { cursor: pointer; font-size: 14px; }
	.mg-come ol { margin: 12px 0 0 18px; font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); display: grid; gap: 4px; }
	@media (max-width: 1100px) { .mg-kpis { grid-template-columns: repeat(3, 1fr); } }
	@media (max-width: 820px) {
		.mg-kpis { grid-template-columns: repeat(2, 1fr); }
		.mg-voci__tot { margin-left: 0; text-align: left; }
		/* telefono: la tabella diventa schede (dashboard.css) e l'intestazione sparisce, quindi ogni numero porta la sua etichetta */
		.mg-table td[data-l]::before { content: attr(data-l); display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
		.mg-table td.mg-prod { grid-column: 1 / -1; }
		.mg-table td:first-child:has(.mg-exp) { grid-column: 1 / -1; }
		.mg-exp { padding: 4px 8px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
		.mg-exp::after { content: ' dettaglio costi'; font-size: 12px; font-weight: 700; }
		.mg-search { min-width: 0; width: 100%; }
	}
</style>
