<script lang="ts">
	import '$lib/styles/product.css';
	import '$lib/styles/kit.css';
	import '$lib/styles/promo.css';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import FinalCta from '$lib/components/FinalCta.svelte';
	import HowTo from '$lib/components/HowTo.svelte';
	import EnginePreview from '$lib/components/EnginePreview.svelte';
	import { addToCart } from '$lib/cart';
	import { saveCartFile, saveCartPreview } from '$lib/utils/draftStore';
	import { track } from '$lib/tracking';
	import { klaviyo } from '$lib/klaviyo';
	import { onMount } from 'svelte';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	import type { Promo } from '$lib/server/promos';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const promos: Promo[] = data.promos;
	let cur = $state(0);
	const promo = $derived(promos[cur]);
	const price = $derived(promo?.price ?? 0);
	const eur = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: v % 1 ? 2 : 0 }) + ' €';
	const mm = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
	const href = $derived(PRODUCT_ENGINES.find((p) => p.slug === promo?.product_slug)?.href ?? '/adesivi-personalizzati');
	const engineInfo = $derived(PRODUCT_ENGINES.find((p) => p.slug === promo?.product_slug));
	const engine = $derived(promo ? data.engines[promo.product_slug] : null);
	const SHAPES = $derived(engine ? engine.shapes.filter((s) => s.visible) : []);
	/* conto alla rovescia sulla scadenza: giorni, ore, minuti, secondi */
	let now = $state(Date.now());
	onMount(() => { const t = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(t); });
	const left = $derived.by(() => {
		if (!promo?.ends_at) return null;
		const ms = Math.max(0, new Date(promo.ends_at).getTime() - now);
		const s = Math.floor(ms / 1000);
		return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
	});
	const two = (n: number) => String(n).padStart(2, '0');
	/* "come ti facciamo risparmiare tempo": dalla dashboard se compilato, altrimenti le voci standard */
	const PERKS_STD = [{ label: 'Anteprima immediata', saves: '1-2 giorni' }, { label: 'Produzione in 5 giorni', saves: '3-4 giorni' }, { label: 'Corriere espresso tracciato', saves: '1-2 giorni' }];
	const perks = $derived(promo?.perks?.length ? promo.perks : PERKS_STD);
	const normally = $derived(promo?.price_normal ? eur(promo.price_normal) : (promo?.includes?.[0]?.normally ?? ''));
	/* misura dell'offerta: il lato lungo e' quello deciso in dashboard, l'altro segue le proporzioni del file */
	const lato = $derived(Math.max(promo?.w ?? 50, promo?.h ?? 50));
	let over = $state(false);
	let error = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];

	/* popup: file, sagoma, misura calcolata, ultima anteprima */
	type Render = { png: string; w: number; h: number };
	let pop = $state<{ file: File; forma: string; w: number; h: number; ratio: number; last: Render | null; busy: boolean; forced: number } | null>(null);
	let popEngine = $state<EnginePreview | undefined>();
	/* risultato confermato: anteprima al posto del caricamento */
	let done = $state<{ file: File; png: string; w: number; h: number; forma: string } | null>(null);
	let adding = $state(false);
	let added = $state(false);
	const equal = (f: string) => f === 'tondo' || f === 'quadrato';
	function sizeFor(forma: string, ratio: number) {
		if (equal(forma)) return { w: lato, h: lato };
		const r = ratio || 1;
		return r >= 1 ? { w: lato, h: Math.round((lato / r) * 2) / 2 } : { w: Math.round(lato * r * 2) / 2, h: lato };
	}
	function pick(f: File | undefined) {
		error = '';
		if (!f || !promo) return;
		if (!ACCEPT.includes(f.type)) { error = 'Formati accettati: PNG, JPG, SVG, PDF.'; return; }
		if (f.size > 25 * 1024 * 1024) { error = 'Il file supera i 25 MB.'; return; }
		const forma = promo.forma || 'sagomato';
		pop = { file: f, forma, ...sizeFor(forma, 1), ratio: 0, last: null, busy: true, forced: 0 };
	}
	function setShape(forma: string) { if (!pop) return; pop.forma = forma; pop.forced = 0; pop.busy = true; pop.last = null; Object.assign(pop, sizeFor(forma, pop.ratio)); }
	/* sagoma del sito → sagoma del motore: un'istantanea di un'altra sagoma (arrivata in ritardo dopo un cambio) va ignorata */
	const ENGINE_SHAPE: Record<string, string> = { sagomato: 'diecut', tondo: 'circle', quadrato: 'square', ovale: 'ellipse', rettangolare: 'rect' };
	function popRender(r: { png: string | null; name?: string | null; shape?: string | null; w: number; h: number }) {
		if (!pop || !r.png) return;
		if (r.name && r.name !== pop.file.name.replace(/\.[^.]+$/, '')) return;
		if (r.shape && ENGINE_SHAPE[pop.forma] && r.shape !== ENGINE_SHAPE[pop.forma]) return;
		/* al primo rendering il motore propone la misura dalle proporzioni del file: qui la misura la decide l'offerta */
		if (!pop.ratio && r.w > 0 && r.h > 0) { pop.ratio = r.w / r.h; Object.assign(pop, sizeFor(pop.forma, pop.ratio)); }
		if (pop.forced < 3 && (Math.abs(r.w - pop.w) > 0.6 || Math.abs(r.h - pop.h) > 0.6)) {
			pop.forced++;
			popEngine?.post('config', { config: { forma: pop.forma, w: pop.w, h: pop.h, materiale: promo?.materiale, lamina: promo?.finitura ?? 'nessuna', prodotto: engineInfo?.engineProduct ?? 'sticker' } });
			return;
		}
		pop.last = { png: r.png, w: r.w, h: r.h }; pop.busy = false;
	}
	function confirmPop() {
		if (!pop?.last) return;
		done = { file: pop.file, png: pop.last.png, w: pop.last.w, h: pop.last.h, forma: pop.forma };
		pop = null;
	}
	async function addCart() {
		if (!done || !promo || !engine || adding) return;
		adding = true;
		try {
			const gross = price, net = Math.round((gross / engine.vat) * 100) / 100;
			const name = engineInfo?.name ?? promo.product_label;
			const it = addToCart({ product: promo.product_slug, productName: name, engineProduct: engineInfo?.engineProduct ?? 'sticker', forma: done.forma, materiale: promo.materiale, finitura: promo.finitura ?? undefined, w: done.w, h: done.h, qty: promo.qty, net, gross, promoId: promo.id, fileName: done.file.name });
			try { await saveCartFile(it.id, done.file); const blob = await (await fetch(done.png)).blob(); await saveCartPreview(it.id, blob); } catch { /* il file si ricarica al checkout */ }
			track.addToCart({ product: promo.product_slug, productName: name, forma: done.forma, w: done.w, h: done.h, materiale: promo.materiale, finitura: promo.finitura, qty: promo.qty, gross });
			klaviyo.addedToCart({ productId: `${promo.product_slug}_${done.forma}`, productName: `${name} ${done.forma}`, quantity: promo.qty, dimension: `${done.w} x ${done.h} mm`, material: promo.materiale, price: gross });
			added = true;
		} finally { adding = false; }
	}
</script>

<svelte:head>
	<title>Offerte: adesivi personalizzati a prezzo promo | Stickerprint</title>
	<meta name="description" content="Offerte a tempo sugli adesivi personalizzati: quantità fissa, prezzo bloccato, prova automatica immediata e pronti per la spedizione in pochi giorni." />
</svelte:head>

<div class="promo-page">
{#if promo}
	<section class="offer">
		<span class="offer__spark" style="left:6%;top:14%">✦</span><span class="offer__spark" style="right:8%;top:22%;font-size:26px">✦</span><span class="offer__spark" style="left:12%;bottom:18%;font-size:22px">✦</span><span class="offer__spark" style="right:5%;bottom:26%">✦</span>
		<div class="container offer__inner">
			<div class="offer__head">
			<h1><mark>{promo.qty.toLocaleString('it-IT')}</mark> {promo.product_label}<br />a <mark>{eur(price)}</mark></h1>
			{#if left}
				<div class="offer__count" aria-live="off"><span class="offer__count-lbl">Scade tra</span>
					<div class="offer__count-box">
						<span><b>{left.d}</b><small>{left.d === 1 ? 'giorno' : 'giorni'}</small></span><i>:</i>
						<span><b>{two(left.h)}</b><small>ore</small></span><i>:</i>
						<span><b>{two(left.m)}</b><small>min</small></span><i>:</i>
						<span><b>{two(left.s)}</b><small>sec</small></span>
					</div>
				</div>
			{/if}
			<p class="offer__sub"><b>Solo questa settimana:</b> {promo.qty.toLocaleString('it-IT')} {promo.product_label} a {eur(price)}.<br />Anteprima immediata compresa.</p>
			<div class="offer__stars"><Stars value={data.stats?.average ?? 4.9} count={data.stats?.total ?? null} size={22} countLabel="recensioni verificate" /></div>
			<div class="offer__chips"><span class="is-size">{mm(promo.w)}×{mm(promo.h)} mm</span>{#each promo.chips as c (c)}<span>{c}</span>{/each}</div>
			</div>

			<div class="offer__grid">
				<div class="offer__box">
					<h4>Cosa ricevi</h4>
					<div class="offer__row"><span>{promo.qty.toLocaleString('it-IT')} {promo.product_label}</span><b>{normally ? `Normalmente ${normally}` : ''}</b></div>
					<div class="offer__row"><span>Anteprima automatica del file</span><b>Sempre inclusa</b></div>
					<h4>Come ti facciamo risparmiare tempo rispetto ai competitor</h4>
					{#each perks as p (p.label)}<div class="offer__row"><span>{p.label}</span><b>{p.saves ? `Risparmi ${p.saves}` : ''}</b></div>{/each}
					<div class="offer__row is-date"><span>Consegna stimata</span><b>{data.deliveryDate}</b></div>
					{#if promo.save_text}<div class="offer__row is-save"><span>Risparmi</span><b>{promo.save_text}</b></div>{/if}
					<div class="offer__row is-pay"><span>Paghi</span><b>{eur(price)}</b></div>
				</div>

				<div class="offer__right">
					{#if done}
						<!-- anteprima confermata, su fondo blu -->
						<div class="offer__proof">
							<img src={done.png} alt="Anteprima del tuo adesivo" />
							<div class="offer__proof-meta">
								<b>{promo.qty.toLocaleString('it-IT')} {promo.product_label} · {mm(done.w)}×{mm(done.h)} mm</b>
								<span>Sagoma {done.forma} · {done.file.name}</span>
								<button type="button" class="link-btn" onclick={() => { done = null; }}>Cambia file o sagoma</button>
							</div>
						</div>
						<button type="button" class="btn btn--green btn--xl offer__add" disabled={adding} onclick={addCart}>{adding ? 'Un attimo…' : `Aggiungi al carrello · ${eur(price)}`}</button>
					{:else}
						<label class="dropzone dropzone--compact offer__dz" class:is-over={over}
							ondragenter={(e) => { e.preventDefault(); over = true; }}
							ondragover={(e) => { e.preventDefault(); over = true; }}
							ondragleave={() => (over = false)}
							ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}>
							<input bind:this={fileInput} type="file" accept={ACCEPT.join(',')} onchange={(e) => { pick((e.currentTarget as HTMLInputElement).files?.[0]); (e.currentTarget as HTMLInputElement).value = ''; }} />
							<div>
								<div class="dropzone__icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></div>
								<div class="dropzone__title">Trascina qui il tuo file</div>
								<div class="dropzone__sub">oppure clicca per sceglierlo · PNG, JPG, SVG, PDF · anteprima immediata</div>
							</div>
						</label>
						{#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}
						<button type="button" class="btn btn--green btn--xl offer__add" onclick={() => fileInput?.click()}>{promo.cta}</button>
					{/if}
				</div>
			</div>

			{#if promos.length > 1}
				<div class="offer__more">
					{#each promos as p, i (p.id)}
						<button type="button" class="offer__card" class:is-on={i === cur} onclick={() => { cur = i; done = null; pop = null; }}>
							<b>{p.qty.toLocaleString('it-IT')} × {eur(p.price)}</b>
							<small>{p.product_label} · {mm(p.w)}×{mm(p.h)} mm{#if p.price_normal} · invece di {eur(p.price_normal)}{/if}</small>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</section>
{:else}
	<section class="section container center">
		<h1>Nessuna offerta attiva <span class="hl hl--yellow">in questo momento.</span></h1>
		<p class="lead" style="margin-top:16px">Torna a trovarci, oppure vai ai preventivatori: i prezzi migliori li vedi subito.</p>
		<p style="margin-top:22px"><a class="btn btn--blue btn--lg" href="/adesivi-personalizzati">Vai agli adesivi personalizzati</a></p>
	</section>
{/if}

<!-- RECENSIONI -->
<section class="section container">
	<div class="panel offer__reviews center">
		<h2>Consigliati da <span class="hl hl--green">persone come te.</span></h2>
		<p class="lead">Il <strong>100%</strong> di chi ha lasciato una recensione ha detto che ordinerebbe di nuovo.</p>
		<div class="stats">
			<div class="stat stat--blue"><b>3K+</b><span>Ordini spediti</span></div>
			<div class="stat stat--yellow"><b>{(data.stats?.average ?? 4.9).toLocaleString('it-IT', { minimumFractionDigits: 1 })} ★</b><span>Valutazione media</span></div>
			<div class="stat stat--pink"><b>5 gg</b><span>Media di produzione</span></div>
		</div>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- COME FUNZIONA -->
<HowTo shipDate={data.shipDate} dark />

<!-- DOMANDE -->
<section class="section container center">
	<h2>Le domande <span class="hl hl--yellow">più frequenti.</span></h2>
	<div class="faq3" style="text-align:left">
		<details><summary>Serve un file pronto per la stampa?</summary><p>No. Carica quello che hai: l'anteprima automatica trova sagoma e problemi da sola, e prima di stampare un umano controlla tutto e ti avvisa.</p></details>
		<details><summary>Quanto ci mettono ad arrivare?</summary><p>In media 5 giorni di produzione più il corriere espresso. La data di spedizione prevista la vedi già nel preventivatore, prima di ordinare.</p></details>
		<details><summary>E se qualcosa arriva sbagliato?</summary><p>Lo ristampiamo. Scrivici dalla pagina Resi con foto e numero d'ordine: succede raramente e, quando succede, ce ne occupiamo noi.</p></details>
	</div>
</section>

<!-- CHIUSURA -->
<FinalCta shipDate={data.shipDate} href={promo ? `${href}?forma=${promo.forma}&materiale=${promo.materiale}` : '/adesivi-personalizzati'} />
</div>

{#if added && promo && done}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="added-bg" onclick={(e) => { if (e.target === e.currentTarget) added = false; }} onkeydown={(e) => { if (e.key === 'Escape') added = false; }}>
		<div class="added" role="dialog" aria-modal="true" aria-label="Prodotto aggiunto al carrello">
			<span class="added__ck">✓</span>
			<h3>Prodotto aggiunto al carrello</h3>
			<p>{promo.qty.toLocaleString('it-IT')} × {promo.product_label} · {mm(done.w)} × {mm(done.h)} mm · {eur(price)}</p>
			<div class="added__cta">
				<a class="btn btn--green btn--lg" href="/checkout">Vai al checkout →</a>
				<a class="btn btn--ghost btn--lg" href="/prodotti">Continua gli acquisti</a>
			</div>
		</div>
	</div>
{/if}

<!-- POPUP: solo la sagoma (e i comandi del motore: bordo, sfondo, zoom); la misura la decide l'offerta -->
{#if pop && promo && engine}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Scegli la sagoma">
		<div class="modal kit__modal">
			<button type="button" class="modal__close" aria-label="Chiudi" onclick={() => (pop = null)}>✕</button>
			<h3>Scegli la sagoma <small>{pop.file.name}</small></h3>
			<div class="kit__shapes">{#each SHAPES as sh (sh.id)}<button type="button" class="kit__shape" class:is-on={pop.forma === sh.id} onclick={() => setShape(sh.id)}><img src={sh.img} alt="" /><b>{sh.label}</b></button>{/each}</div>
			<div class="kit__modal-engine">
				<EnginePreview bind:this={popEngine} file={pop.file} forma={pop.forma} materiale={promo.materiale} finitura={promo.finitura ?? 'nessuna'} prodotto={engineInfo?.engineProduct ?? 'sticker'} w={pop.w} h={pop.h} panel stage={300} onrender={popRender} />
			</div>
			<div class="offer__promo-size"><span>Misura in promo</span><b>{mm(pop.w)}×{mm(pop.h)} mm</b><small>il lato lungo è {mm(lato)} mm, l'altro segue le proporzioni del tuo file</small></div>
			<div class="kit__modal-actions">
				<button type="button" class="btn btn--sm" onclick={() => (pop = null)}>Annulla</button>
				<button type="button" class="btn btn--green" disabled={pop.busy || !pop.last} onclick={confirmPop}>{pop.busy ? 'Preparo l’anteprima…' : 'Conferma la sagoma'}</button>
			</div>
		</div>
	</div>
{/if}
