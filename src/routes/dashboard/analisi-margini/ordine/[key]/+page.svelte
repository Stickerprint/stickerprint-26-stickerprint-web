<script lang="ts">
	import '$lib/styles/margini.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { CATS, ORDER_STATUS, CHANNEL_ICON, dmy } from '$lib/dashboard/orders';
	import { euro, perc, mq, metri, grammi, pezzi, mm, classeMargine, FONTE_LABEL, MODO_LABEL } from '$lib/margini/formato';
	import type { Disegno } from './+page.server';
	let { data, form } = $props();

	const o = $derived(data.ordine);
	const torna = $derived('/dashboard/analisi-margini' + (page.url.searchParams.get('torna') ?? ''));
	const prodotti = $derived(o.righe.filter((r) => r.costo.tipo === 'prodotto'));
	const servizi = $derived(o.righe.filter((r) => r.costo.tipo === 'servizio'));
	const nomeProdotto = (slug: string) => CATS[slug]?.name ?? (slug === 'kit_adesivi' ? 'Kit di adesivi' : slug.replace(/_/g, ' '));
	const CONSEGNA: Record<string, string> = { ours: 'corriere a carico nostro', customer: 'corriere a carico del cliente', direct: 'consegna diretta' };
	/* una riga si completa a mano quando misura o materiale non vengono dalle colonne dell'ordine */
	const daCompletare = (r: (typeof o.righe)[number]) => !r.costo.lettura || r.costo.lettura.fonti.misura !== 'ordine' || r.costo.lettura.fonti.materiale !== 'ordine';
	const scelte = (slug: string) => data.scelte[slug === 'kit_adesivi' ? 'adesivi_personalizzati' : slug] ?? { forme: [], materiali: [] };
	let salvo = $state<string | null>(null);
</script>

<svelte:head><title>{o.number} · Analisi margini | Dashboard Stickerprint</title></svelte:head>

{#snippet striscia(d: Disegno, titolo: string)}
	<figure class="mg-strip">
		<svg viewBox="-4 -4 {d.w + 8} {d.h + 8}" role="img" aria-label="{titolo}: {mm(d.w / 10)} × {mm(d.h / 10)} cm, {d.pezzi.length} pezzi">
			<rect class="mg-strip__page" x="0" y="0" width={d.w} height={d.h} rx="2" />
			{#each d.fogli as f, i (i)}<rect class="mg-strip__sheet" x={f.x} y={f.y} width={f.w} height={f.h} rx="2" />{/each}
			{#each d.pezzi as p, i (i)}
				{#if d.forma === 'tondo' || d.forma === 'ovale'}<ellipse class="mg-strip__pc" cx={p.x + p.w / 2} cy={p.y + p.h / 2} rx={p.w / 2} ry={p.h / 2} />
				{:else}<rect class="mg-strip__pc" x={p.x} y={p.y} width={p.w} height={p.h} rx={d.forma === 'sagomato' ? Math.min(p.w, p.h) * 0.22 : d.forma === 'quadrato' ? Math.min(p.w, p.h) * 0.1 : 0.6} />{/if}
			{/each}
		</svg>
		<figcaption>{titolo}: {mm(Math.round(d.w) / 10)} × {mm(Math.round(d.h) / 10)} cm · {d.pezzi.length} {d.pezzi.length === 1 ? 'pezzo' : 'pezzi'}{d.fogli.length ? ` su ${d.fogli.length} ${d.fogli.length === 1 ? 'foglio' : 'fogli'}` : ''}</figcaption>
	</figure>
{/snippet}

<div class="mg-page mg-detail">
	<a class="mg-back" href={torna}>‹ Analisi margini</a>

	<header class="mg-dhead">
		<div>
			<h1>{o.number} <span title={CHANNEL_ICON[o.channel]?.label}>{CHANNEL_ICON[o.channel]?.icon ?? ''}</span></h1>
			<p>{o.customer} · {dmy(o.created_at)} · <span style="color:{ORDER_STATUS[o.status]?.color}">{ORDER_STATUS[o.status]?.label ?? o.status}</span>{#if o.fattura} · fattura {o.fattura}{/if}</p>
		</div>
		<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini/{encodeURIComponent(o.key)}">Apri l'ordine ›</a>
	</header>

	{#if form?.error}<p class="error">{form.error}</p>{/if}
	{#if form?.ok}<p class="success">{form.message}</p>{/if}

	<section class="mg-hero {classeMargine(o.marginePct)}">
		<small>Margine dell'ordine</small>
		{#if o.margine == null}
			<div class="mg-hero__row"><b>—</b></div>
			<p>Una riga non ha la misura: completala qui sotto e il margine si calcola.</p>
		{:else}
			<div class="mg-hero__row"><b>{euro(o.margine)}</b><span class="mg-pill {classeMargine(o.marginePct)}">{perc(o.marginePct)}</span></div>
			<p>{euro(o.ricavo.totale)} di ricavo − {euro(o.costo.totale)} di costi{#if o.stato === 'stima'} · <b>stima</b>: vedi le note sulle righe{/if}</p>
		{/if}
	</section>

	<div class="mg-two">
		<section class="mg-card">
			<h2>Ricavo</h2>
			<dl class="mg-list">
				<div><dt>Prodotti (meno sconto)</dt><dd>{euro(o.ricavo.prodotti)}</dd></div>
				{#if o.ricavo.servizi}<div><dt>Servizi</dt><dd>{euro(o.ricavo.servizi)}</dd></div>{/if}
				<div><dt>Spedizione addebitata</dt><dd>{euro(o.ricavo.spedizione)}</dd></div>
				{#if o.ricavo.express}<div><dt>Express</dt><dd>{euro(o.ricavo.express)}</dd></div>{/if}
				<div class="is-strong"><dt>Totale</dt><dd>{euro(o.ricavo.totale)}</dd></div>
			</dl>
		</section>
		<section class="mg-card">
			<h2>Costo</h2>
			<dl class="mg-list">
				<div><dt>Vinile</dt><dd>{euro(o.costo.vinile)}</dd></div>
				<div><dt>Inchiostro</dt><dd>{euro(o.costo.stampa)}</dd></div>
				{#if o.costo.lamina}<div><dt>Lamina</dt><dd>{euro(o.costo.lamina)}</dd></div>{/if}
				{#if o.costo.resina}<div><dt>Resina</dt><dd>{euro(o.costo.resina)}</dd></div>{/if}
				<div><dt>Corriere <small>{CONSEGNA[o.consegna]}</small></dt><dd>{euro(o.costo.corriere)}</dd></div>
				<div class="is-strong"><dt>Totale</dt><dd>{euro(o.costo.totale)}</dd></div>
			</dl>
		</section>
	</div>

	{#each prodotti as r (r.id)}
		{@const c = r.costo}
		{@const l = c.lettura}
		{@const k = c.consumo}
		{@const dis = data.disegni[r.id]}
		<section class="mg-card mg-riga">
			<header class="mg-riga__head">
				<div><b><i class="mg-dot" style="background:{CATS[r.product_slug]?.color ?? '#94a3b8'}"></i>{r.qty.toLocaleString('it-IT')} × {r.product_name}</b><small>{r.number}{r.product_code ? ` · codice ${r.product_code}` : ''} · {nomeProdotto(r.product_slug)}</small></div>
				<div class="mg-riga__m">{#if r.margine != null}<b>{euro(r.margine)}</b><span class="mg-pill {classeMargine(r.marginePct)}">{perc(r.marginePct)}</span>{:else}<span class="mg-flag is-manca">da completare</span>{/if}</div>
			</header>
			{#if r.description}<p class="mg-desc">“{r.description}”</p>{/if}

			{#if l}
				<div class="mg-read">
					<span><small>Misura</small><b>{mm(l.w)}×{mm(l.h)} mm</b><i class="is-{l.fonti.misura}">{FONTE_LABEL[l.fonti.misura]}</i></span>
					<span><small>Sagoma</small><b class="mg-cap">{l.forma}</b><i class="is-{l.fonti.forma}">{FONTE_LABEL[l.fonti.forma]}</i></span>
					<span><small>Materiale</small><b>{l.materialeLabel}</b><i class="is-{l.fonti.materiale}">{FONTE_LABEL[l.fonti.materiale]}</i></span>
					<span><small>Lamina</small><b class="mg-cap">{k?.laminaTipo ?? 'nessuna'}</b><i class="is-{l.fonti.lamina}">{FONTE_LABEL[l.fonti.lamina]}</i></span>
				</div>
			{/if}
			{#if c.motivo}<p class="mg-why">{c.stato === 'manca' ? '⚠️' : 'ℹ️'} {c.motivo}</p>{/if}

			{#if k}
				<h3>Materiale usato</h3>
				<dl class="mg-cons">
					<div class="is-main"><dt>Vinile {k.vinileLabel}</dt><dd><b>{metri(k.bobinaMm)}</b> di bobina da {k.bobinaLarghezzaMm / 10} cm <span>= {mq(k.bobinaM2)}</span></dd></div>
					{#if k.laminaTipo}<div><dt>Lamina {k.laminaTipo}</dt><dd><b>{mq(k.laminaM2)}</b> <span>{metri(k.bobinaMm)} di film</span></dd></div>{/if}
					{#if k.resinaG}<div><dt>Resina</dt><dd><b>{grammi(k.resinaG)}</b> <span>{pezzi(k.resinaCm2)} cm² colati</span></dd></div>{/if}
					<div><dt>Inchiostro</dt><dd><b>{mq(k.stampaM2)}</b> <span>superficie stampata</span></dd></div>
					<div><dt>Pezzi</dt><dd><b>{pezzi(k.pezziDaFare)}</b> stampati <span>{pezzi(k.pezzi)} ordinati + scarto{k.cavallotti ? ` · ${pezzi(k.cavallotti)} cavallotti` : ''}</span></dd></div>
					<div><dt>Impaginazione</dt><dd><b>{k.strisce || '—'}</b> {k.strisce === 1 ? 'striscia' : 'strisce'} <span>{MODO_LABEL[k.modo]}{k.fogli && k.perFoglio ? ` · ${pezzi(k.fogli)} fogli da ${k.perFoglio}` : ''}{k.perStriscia ? ` · fino a ${pezzi(k.perStriscia)} pezzi per striscia` : ''}</span></dd></div>
					<div><dt>Resa</dt><dd><b>{perc(k.resaPct)}</b> della bobina diventa adesivo venduto <span>sfrido {mq(k.sfridoM2)}</span></dd></div>
				</dl>

				{#if dis?.prima}
					<div class="mg-strips">
						{@render striscia(dis.prima, dis.strisce > 1 ? 'Prima striscia' : 'Striscia')}
						{#if dis.ultima}{@render striscia(dis.ultima, `Ultima striscia (${dis.strisce} in tutto)`)}{/if}
						{#if dis.cavallotti}{@render striscia(dis.cavallotti, 'Cavallotti')}{/if}
					</div>
				{/if}

				<h3>Costo della riga</h3>
				<dl class="mg-list">
					<div><dt>Vinile</dt><dd>{euro(c.costi.vinile)}</dd></div>
					<div><dt>Inchiostro</dt><dd>{euro(c.costi.stampa)}</dd></div>
					{#if c.costi.lamina}<div><dt>Lamina</dt><dd>{euro(c.costi.lamina)}</dd></div>{/if}
					{#if c.costi.resina}<div><dt>Resina</dt><dd>{euro(c.costi.resina)}</dd></div>{/if}
					<div class="is-strong"><dt>Costo · ricavo {euro(r.ricavo)}</dt><dd>{euro(c.costi.totale)}</dd></div>
				</dl>
				<p class="mg-note">Prezzi dei materiali dal <a class="link" href="/dashboard/preventivatori/{r.product_slug === 'kit_adesivi' ? 'adesivi_personalizzati' : r.product_slug}">preventivatore {nomeProdotto(r.product_slug === 'kit_adesivi' ? 'adesivi_personalizzati' : r.product_slug)}</a>.</p>
			{/if}

			{#if daCompletare(r) && data.scelte[r.product_slug === 'kit_adesivi' ? 'adesivi_personalizzati' : r.product_slug]}
				<details class="mg-fix" open={!l || (!!form?.error && form?.id === r.id)}>
					<summary>{l ? 'Correggi misura e materiale' : 'Completa misura e materiale'}</summary>
					<form method="POST" action="?/completa" use:enhance={() => { salvo = r.id; return async ({ update }) => { await update({ reset: false }); salvo = null; }; }}>
						<input type="hidden" name="id" value={r.id} />
						<label>Larghezza (mm)<input name="w" type="number" inputmode="decimal" min="1" step="0.1" required value={l?.w ?? ''} /></label>
						<label>Altezza (mm)<input name="h" type="number" inputmode="decimal" min="1" step="0.1" required value={l?.h ?? ''} /></label>
						<label>Sagoma<select name="forma">{#each scelte(r.product_slug).forme as f (f.id)}<option value={f.id} selected={f.id === l?.forma}>{f.label}</option>{/each}</select></label>
						<label>Materiale<select name="materiale">{#each scelte(r.product_slug).materiali as m (m.id)}<option value={m.id} selected={m.id === l?.materiale}>{m.label}</option>{/each}</select></label>
						<button class="btn btn--blue btn--xs" type="submit" disabled={salvo === r.id}>{salvo === r.id ? 'Salvo…' : 'Salva nella riga'}</button>
					</form>
					<p class="mg-note">Si salva nella riga dell'ordine: lo ritrovano anche produzione e Studio. La laminazione si cambia dall'ordine.</p>
				</details>
			{/if}
		</section>
	{/each}

	{#if servizi.length}
		<section class="mg-card">
			<h2>Righe senza materiale</h2>
			<dl class="mg-list">
				{#each servizi as r (r.id)}<div><dt>{r.qty} × {r.description || r.product_name}{r.costo.spedizione ? ' · spedizione' : ''}</dt><dd>{euro(r.ricavo)}</dd></div>{/each}
			</dl>
		</section>
	{/if}

	<p class="mg-note">Consumi calcolati impaginando la riga come lo Studio: bobina da {data.parametri.bobina / 10} cm, crocini e codice a barre, +{Math.round(data.parametri.scarto * 100)}% di pezzi per gli scarti, 5 cm di stacco fra le strisce. Corriere {euro(data.parametri.spedizione)} + IVA quando la spedizione è a carico nostro.</p>
</div>
