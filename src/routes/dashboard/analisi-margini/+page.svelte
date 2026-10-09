<script lang="ts">
	import '$lib/styles/margini.css';
	import { page } from '$app/state';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Colonne from '$lib/components/margini/Colonne.svelte';
	import { calcolaRating, grado, SCALA, type Rating } from '$lib/margini/rating';
	import { CATS, MONTHS, CHANNEL_ICON, dmy } from '$lib/dashboard/orders';
	import { totali, materiali, perProdotto, perMese } from '$lib/margini/aggrega';
	import { euro, perc, mq, metri, grammi, pezzi, mm, classeMargine } from '$lib/margini/formato';
	import type { OrdineMargine } from '$lib/margini/tipi';
	import { conDato, spesaPeriodo, type SpesaAds } from '$lib/margini/ads';
	let { data, form } = $props();

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
	/* l'indirizzo si aggiorna solo dopo la prima navigazione: prima il router di SvelteKit non e' pronto
	   (succede entrando dal menu, senza parametri) */
	let routerPronto = $state(false);
	afterNavigate(() => { routerPronto = true; });
	$effect(() => {
		const q = query;
		if (routerPronto && page.url.search !== q) replaceState(new URL(q, page.url), page.state);
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

	/* "Dove va ogni euro": ogni voce in percentuale del fatturato con il costo calcolato */
	const voci = $derived([
		{ label: 'Vinile', v: t.costo.vinile }, { label: 'Inchiostro', v: t.costo.stampa }, { label: 'Lamina', v: t.costo.lamina },
		{ label: 'Resina', v: t.costo.resina }, { label: 'Corriere', v: t.costo.corriere }
	].filter((x) => x.v > 0));
	/* pubblicità: arriva dopo gli ordini; null finché le piattaforme non rispondono */
	let ads = $state<SpesaAds | null>(null);
	let adsCarico = $state(true);
	$effect(() => {
		const p = data.ads; let vivo = true;
		adsCarico = true; ads = null;
		Promise.resolve(p).then((v) => { if (vivo) { ads = v; adsCarico = false; } });
		return () => { vivo = false; };
	});
	/* la pubblicità porta clienti al sito: con il filtro "Manuali" non si toglie dal margine */
	const conAds = $derived(canale !== 'manuale');
	const adsCanali = $derived((ads?.canali ?? []).map((c) => ({ ...c, spesa: spesaPeriodo(c, periodo) })));
	const adsTot = $derived(conDato(ads).reduce((s, c) => s + spesaPeriodo(c, periodo), 0));
	const adsMese = (m: number) => conDato(ads).reduce((s, c) => s + (c.mesi[m] ?? 0), 0);
	const adsSottratta = $derived(conAds && ads ? adsTot : 0);
	const netto = $derived(t.margine - adsSottratta);
	const nettoPct = $derived(t.calcolato > 0 ? Math.round((netto / t.calcolato) * 1000) / 10 : null);
	const sito = $derived(totali(data.ordini.filter((o: OrdineMargine) => o.channel !== 'manuale' && (periodo === 'anno' || new Date(o.created_at).getMonth() === Number(periodo)))));
	/* mese per mese: il margine di ogni mese meno la pubblicità di quel mese */
	const mesiNetti = $derived(mesi.map((x) => {
		const margine = Math.round((x.margine - (conAds && ads ? adsMese(x.mese) : 0)) * 100) / 100;
		return { ...x, margine, conDati: x.ordini > 0 || margine !== 0, marginePct: x.calcolato > 0 ? Math.round((margine / x.calcolato) * 1000) / 10 : null };
	}));

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

	/* numeri sopra le colonne: corti, il valore preciso sta nel titolo */
	/* nomi corti sotto le colonne strette (il nome intero sta nel titolo) */
	const CORTO: Record<string, string> = { Inchiostro: 'Stampa', Pubblicità: 'Ads' };
	const compatto = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €` : `${Math.round(v)} €`);
	const colonneEuro = $derived([
		...[...voci, ...(adsSottratta > 0 ? [{ label: 'Pubblicità', v: adsSottratta }] : [])].map((x) => ({ id: x.label, label: CORTO[x.label] ?? x.label, v: t.calcolato > 0 ? (x.v / t.calcolato) * 100 : 0, sopra: compatto(x.v), sotto: t.calcolato > 0 ? perc(Math.round((x.v / t.calcolato) * 1000) / 10) : '—', titolo: `${x.label}: ${euro(x.v)}` })),
		{ id: 'margine', label: 'Margine', v: nettoPct ?? 0, sopra: compatto(netto), sotto: perc(nettoPct), forte: true, titolo: `Margine: ${euro(netto)}` }
	]);
	const colonneAds = $derived(adsCanali.map((c) => {
		const ok = c.stato === 'ok' || c.stato === 'storico';
		return { id: c.canale, label: c.canale === 'meta' ? 'Meta' : c.canale === 'google' ? 'Google' : 'TikTok', v: ok ? c.spesa : 0, vuota: !ok, sopra: ok ? compatto(c.spesa) : 'n.c.', sotto: ok ? (sito.fatturato > 0 ? `${perc(Math.round((c.spesa / sito.fatturato) * 1000) / 10)} sito` : '') : c.stato === 'errore' ? 'errore' : 'non collegato', titolo: ok ? `${c.nome}: ${euro(c.spesa)}` : (c.motivo ?? '') };
	}));
	const colonneMesi = $derived(mesiNetti.map((m) => ({
		id: String(m.mese), label: MONTHS[m.mese], v: m.fatturato, v2: m.conDati ? m.margine : null,
		sopra: m.conDati ? compatto(m.margine) : '', sotto: m.ordini ? perc(m.marginePct) : '',
		attiva: periodo === String(m.mese),
		titolo: m.ordini ? `${MESI[m.mese]}: fatturato ${euro(m.fatturato)}, margine ${euro(m.margine)}` : m.conDati ? `${MESI[m.mese]}: nessun ordine, solo pubblicità (${euro(-m.margine)})` : `${MESI[m.mese]}: nessun ordine`,
		onclick: m.ordini ? () => (periodo = String(m.mese)) : undefined
	})));

	/* ---------------- rating ---------------- */
	const pad2 = (n: number) => String(n).padStart(2, '0');
	/* mese del rating: quello scelto; con "Anno" l'ultimo mese che ne ha uno (o il mese in corso) */
	const meseRating = $derived.by(() => {
		if (periodo !== 'anno') return `${data.year}-${pad2(Number(periodo) + 1)}`;
		const salvati = Object.keys(data.rating.perMese).sort();
		if (salvati.length) return salvati[salvati.length - 1];
		return data.year === Number(data.oggi.mese.slice(0, 4)) ? data.oggi.mese : `${data.year}-12`;
	});
	const meseRatingIdx = $derived(Number(meseRating.slice(5, 7)) - 1);
	const salvato = $derived(data.rating.perMese[meseRating] ?? null);
	const giorniDel = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0).getDate();
	/* senza rating salvato: anteprima calcolata qui con le stesse regole (il commento arriva con l'aggiornamento) */
	const anteprima = $derived.by((): Rating | null => {
		if (salvato || meseRating > data.oggi.mese) return null;
		const delMese = (i: number) => data.ordini.filter((o: OrdineMargine) => new Date(o.created_at).getMonth() === i);
		const cur = delMese(meseRatingIdx);
		if (!cur.length) return null;
		const tc = totali(cur), sc = totali(cur.filter((o: OrdineMargine) => o.channel !== 'manuale'));
		const adsM = ads && conDato(ads).length ? adsMese(meseRatingIdx) : null;
		const prev = meseRatingIdx > 0 ? delMese(meseRatingIdx - 1) : [];
		const tp = totali(prev);
		const adsP = ads && conDato(ads).length ? adsMese(meseRatingIdx - 1) : 0;
		return calcolaRating({
			mese: meseRating, giorniMese: giorniDel(meseRating), giorniTrascorsi: meseRating < data.oggi.mese ? giorniDel(meseRating) : data.oggi.giorno,
			ordini: tc.ordini, ordiniSito: tc.sito, daCompletare: tc.daCompletare, fatturato: tc.fatturato, calcolato: tc.calcolato, costoProduzione: tc.costo.totale, ads: adsM, fatturatoSito: sc.fatturato,
			prima: prev.length ? { calcolato: tp.calcolato, fatturato: tp.fatturato, giorni: giorniDel(`${data.year}-${pad2(meseRatingIdx)}`), margineNettoPct: tp.calcolato > 0 ? Math.round(((tp.calcolato - tp.costo.totale - adsP) / tp.calcolato) * 1000) / 10 : null } : null
		});
	});
	const rt = $derived(salvato ? salvato.dati.rating : anteprima);
	const g = $derived(rt ? grado(rt.lettera) : null);
	const meseRatingLabel = $derived(`${MESI[meseRatingIdx]} ${meseRating.slice(0, 4)}`);
	const dataIt = (d: string) => new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
	const prossimoLunedi = $derived.by(() => { const d = new Date(data.oggi.iso + 'T12:00:00'); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return dataIt(d.toISOString()); });
	const mesiRating = $derived(Array.from({ length: 12 }, (_, i) => { const k = `${data.year}-${pad2(i + 1)}`; const r = data.rating.perMese[k]; return { k, i, lettera: r?.lettera ?? null, definitivo: !!r?.definitivo }; }));
	let generando = $state(false);
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
		<div class="mg-riep">
			<div class="mg-riep__hero">
				<section class="mg-hero {classeMargine(nettoPct)}">
					<small>Margine{conAds && ads ? ' dopo la pubblicità' : ''} · {periodoLabel}</small>
					<div class="mg-hero__row"><b>{euro(netto)}</b><span class="mg-pill {classeMargine(nettoPct)}">{perc(nettoPct)}</span></div>
					<p>su {euro(t.calcolato)} di fatturato netto: {euro(t.costo.totale)} di produzione e corriere{#if conAds}{#if ads}, {euro(adsTot)} di pubblicità{:else if adsCarico}, pubblicità in arrivo…{/if}{/if}</p>
					{#if t.daCompletare}<button type="button" class="mg-hero__warn" onclick={() => vaiOrdini('manca')}>⚠️ {t.daCompletare} {t.daCompletare === 1 ? 'ordine' : 'ordini'} senza misura, fuori dal margine ({euro(t.fatturato - t.calcolato)}) › completali</button>{/if}
				</section>
				<div class="mg-tiles">
					<div class="mg-tile"><small>Fatturato netto</small><b>{euro(t.fatturato)}</b><span>{t.ordini} ordini · {t.sito} sito · {t.manuali} manuali</span></div>
					<div class="mg-tile"><small>Costi</small><b>{euro(t.costo.totale + adsSottratta)}</b><span>materiale {euro(t.costo.totale - t.costo.corriere)} · corriere {euro(t.costo.corriere)}{#if adsSottratta} · pubblicità {euro(adsSottratta)}{/if}</span></div>
					<button type="button" class="mg-tile mg-tile--link" onclick={() => { vista = 'materiale'; window.scrollTo({ top: 0 }); }}><small>Bobina usata</small><b>{metri(mat.bobinaMm)}</b><span>{mq(mat.bobinaM2)} · resa {perc(mat.resaPct)} ›</span></button>
					<div class="mg-tile"><small>Pezzi stampati</small><b>{pezzi(mat.pezziDaFare)}</b><span>{pezzi(mat.pezzi)} ordinati + scarto</span></div>
				</div>
			</div>

			<!-- RATING: a destra sul computer, subito dopo il margine sul telefono -->
			<aside class="mg-rt" style={g ? `--rc:${g.colore};--rb:${g.sfondo}` : ''} aria-label="Rating di {meseRatingLabel}">
				<header class="mg-rt__head">
					<small>Rating · {meseRatingLabel}</small>
					{#if salvato}<span class="mg-rt__stato" class:is-def={salvato.definitivo}>{salvato.definitivo ? 'Definitivo' : 'Provvisorio'}</span>{:else if rt}<span class="mg-rt__stato">Anteprima</span>{/if}
				</header>
				{#if rt && g}
					<div class="mg-rt__lettera" aria-label="Rating {rt.lettera}">{rt.lettera}</div>
					<p class="mg-rt__giudizio"><b>{rt.giudizio}</b> · {rt.punteggio.toLocaleString('it-IT')} punti su 100</p>
					<div class="mg-rt__scala" aria-hidden="true">{#each SCALA as x (x.lettera)}<span class:is-on={x.lettera === rt.lettera} style="--c:{x.colore};--b:{x.sfondo}">{x.lettera}</span>{/each}</div>
					<p class="mg-rt__when">
						{#if salvato?.definitivo}Mese chiuso: lettera definitiva, dati fino al {new Date(salvato.dati_fino_al).toLocaleDateString('it-IT')}.
						{:else if salvato}Aggiornato {dataIt(salvato.generato_il)} con i dati fino al {new Date(salvato.dati_fino_al).toLocaleDateString('it-IT')}. Prossimo aggiornamento {prossimoLunedi}; a fine mese diventa definitivo.
						{:else}Calcolata adesso con le stesse regole: il report scritto arriva con il primo aggiornamento del lunedì.{/if}
					</p>
					<dl class="mg-rt__comp">
						{#each rt.componenti as c (c.id)}
							<div title={c.nota ?? undefined}>
								<dt>{c.nome}<small>{c.valore}</small></dt>
								<dd><span class="mg-rt__track"><i style="width:{(c.punti / c.max) * 100}%"></i></span><b>{c.punti.toLocaleString('it-IT')}/{c.max}</b></dd>
							</div>
						{/each}
					</dl>
					<p class="mg-rt__aff is-{rt.affidabilita}">Affidabilità {rt.affidabilita}: {rt.motivoAffidabilita}</p>

					{#if salvato}
						<div class="mg-rt__report">
							<h3>Pro</h3>
							<ul class="is-pro">{#each salvato.pro as x, i (i)}<li>{x}</li>{/each}</ul>
							<h3>Contro</h3>
							<ul class="is-contro">{#each salvato.contro as x, i (i)}<li>{x}</li>{/each}</ul>
							<h3>Considerazioni finali</h3>
							<p>{salvato.considerazioni}</p>
							<p class="mg-rt__firma">{salvato.autore === 'assistente' ? `Scritto dall'assistente (${salvato.modello}) sui numeri del mese: la lettera la decidono le regole.` : `Scritto dalle regole${salvato.dati.avviso ? ` (${salvato.dati.avviso})` : ''}.`}</p>
						</div>
					{/if}
				{:else}
					<p class="mg-note">Nessun ordine in {meseRatingLabel}: niente da valutare.</p>
				{/if}

				{#if form?.ratingErrore}<p class="mg-why">⚠️ {form.ratingErrore}</p>{/if}
				{#if form?.ratingOk}<p class="mg-rt__ok">{form.ratingOk}</p>{/if}
				{#if rt && !salvato?.definitivo && meseRating <= data.oggi.mese}
					<form method="POST" action="?/rating" use:enhance={() => { generando = true; return async ({ update }) => { await update({ reset: false }); generando = false; }; }}>
						<input type="hidden" name="mese" value={meseRating} />
						<button class="btn btn--ghost btn--xs mg-rt__btn" type="submit" disabled={generando}>{generando ? 'Scrivo il report… (fino a un minuto)' : meseRating < data.oggi.mese ? 'Chiudi il mese: rating definitivo' : salvato ? 'Aggiorna adesso' : 'Scrivi il report adesso'}</button>
					</form>
				{/if}

				<div class="mg-rt__mesi" aria-label="Rating dei mesi del {data.year}">
					{#each mesiRating as m (m.k)}
						<button type="button" class:is-on={m.k === meseRating} class:is-def={m.definitivo} style={m.lettera ? `--c:${grado(m.lettera).colore};--b:${grado(m.lettera).sfondo}` : ''} disabled={!m.lettera && !mesi[m.i].ordini} onclick={() => (periodo = String(m.i))} title={m.lettera ? `${MESI[m.i]}: ${m.lettera}${m.definitivo ? ' definitivo' : ' provvisorio'}` : MESI[m.i]}>
							<small>{MONTHS[m.i]}</small><b>{m.lettera ?? '·'}</b>
						</button>
					{/each}
				</div>
				<p class="mg-rt__nota">Il rating guarda tutta l'azienda, sito e manuali. Margine con materiale, corriere e pubblicità: manodopera, imballo e commissioni non sono ancora dentro.</p>
			</aside>

			<div class="mg-riep__resto">
				<div class="mg-duo">
					<section class="mg-card">
						<h2>Dove va ogni euro</h2>
						<p class="mg-note">In % di {euro(t.calcolato)} incassati (ordini con il costo calcolato). Stampa = inchiostro, Ads = pubblicità.</p>
						<Colonne colonne={colonneEuro} etichetta="Ripartizione del fatturato fra costi e margine" />
					</section>

					<section class="mg-card mg-ads">
						<header class="mg-ads__head">
							<h2>Pubblicità</h2>
							{#if ads}<b class="mg-ads__tot">{euro(adsTot)}</b>{/if}
						</header>
						{#if adsCarico}
							<p class="mg-note">Leggo la spesa da Meta, Google e TikTok…</p>
							<div class="mg-ads__wait" aria-hidden="true"><i></i><i></i><i></i></div>
						{:else if !ads}
							<p class="mg-why">⚠️ Spesa pubblicitaria non disponibile in questo momento: ricarica la pagina tra poco.</p>
						{:else}
							<Colonne colonne={colonneAds} altezza={110} etichetta="Spesa pubblicitaria per canale" />
							{#each adsCanali.filter((c) => c.motivo) as c (c.canale)}<details class="mg-ads__why is-{c.stato}"><summary><b>{c.canale === 'meta' ? 'Meta' : c.canale === 'google' ? 'Google' : 'TikTok'}</b>: {c.stato === 'storico' ? 'dallo storico notturno' : c.stato === 'non_collegato' ? 'non collegato' : 'errore'} · perché?</summary>{c.motivo}</details>{/each}
							{#if adsTot > 0}
								<dl class="mg-list">
									<div><dt>Per ordine del sito <small>{sito.ordini} ordini dal sito</small></dt><dd>{sito.ordini ? euro(adsTot / sito.ordini) : '—'}</dd></div>
									<div><dt>Fatturato sito per 1 € speso</dt><dd>{euro(sito.fatturato / adsTot)}</dd></div>
									<div><dt>Sul fatturato totale</dt><dd>{t.fatturato > 0 ? perc(Math.round((adsTot / t.fatturato) * 1000) / 10) : '—'}</dd></div>
								</dl>
							{/if}
							<p class="mg-note">{#if conAds}Tolta dal margine.{:else}Con il filtro <b>Manuali</b> non si toglie dal margine.{/if} IVA esclusa. <a class="link" href="/dashboard/marketing">Campagne ›</a></p>
						{/if}
					</section>
				</div>

				<section class="mg-card">
					<h2>Mese per mese · {data.year}</h2>
					<p class="mg-note">Colonna chiara: fatturato del mese. Colonna scura: margine{conAds && ads ? ' dopo la pubblicità' : ''}; sotto lo zero, in rosso, se negativo. Tocca un mese per aprirlo.</p>
					<Colonne colonne={colonneMesi} altezza={170} fitta etichetta="Fatturato e margine mese per mese" />
				</section>
			</div>
		</div>
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
