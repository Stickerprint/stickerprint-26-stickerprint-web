<script lang="ts">
	import '$lib/styles/promo.css';
	import { goto } from '$app/navigation';
	import ReviewsCarousel from '$lib/components/ReviewsCarousel.svelte';
	import { saveDraft } from '$lib/utils/draftStore';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	import type { Promo } from '$lib/server/promos';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const promos: Promo[] = data.promos;
	let cur = $state(0);
	const promo = $derived(promos[cur]);
	let sizeIdx = $state(0);
	const size = $derived(promo?.sizes[sizeIdx] ?? promo?.sizes[0] ?? null);
	const price = $derived(size ? size.price : (promo?.price ?? 0));
	const eur = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: v % 1 ? 2 : 0 }) + ' €';
	const href = $derived(PRODUCT_ENGINES.find((p) => p.slug === promo?.product_slug)?.href ?? '/adesivi-personalizzati');
	const avg = $derived((data.stats?.average ?? 4.9).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
	// conto alla rovescia sulla scadenza dell'offerta
	const giorni = $derived.by(() => {
		if (!promo?.ends_at) return null;
		const ms = new Date(promo.ends_at).getTime() - Date.now();
		if (ms <= 0) return 0;
		return Math.ceil(ms / 86_400_000);
	});
	let over = $state(false);
	let saving = $state(false);
	let error = $state('');
	const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'];

	/* il file va al preventivatore del prodotto con sagoma, materiale, misura e quantità dell'offerta */
	async function pick(f: File | undefined) {
		error = '';
		if (!f || !promo) return;
		if (!ACCEPT.includes(f.type)) { error = 'Formati accettati: PNG, JPG, SVG, PDF.'; return; }
		if (f.size > 25 * 1024 * 1024) { error = 'Il file supera i 25 MB.'; return; }
		saving = true;
		try {
			await saveDraft({ product: promo.product_slug, forma: promo.forma, materiale: promo.materiale, file: f, preview: null, widthMm: size?.w ?? 50, heightMm: size?.h ?? size?.w ?? 50, qty: promo.qty, lockSize: !!size, promo: { id: promo.id, price, qty: promo.qty, w: size?.w ?? 50, h: size?.h ?? size?.w ?? 50 }, savedAt: Date.now() });
			await goto(`${href}?forma=${promo.forma}&materiale=${promo.materiale}#configura`);
		} finally { saving = false; }
	}
</script>

<svelte:head>
	<title>Offerte: adesivi personalizzati a prezzo promo | Stickerprint</title>
	<meta name="description" content="Offerte a tempo sugli adesivi personalizzati: quantità fissa, prezzo bloccato, anteprima immediata e spedizione in 5 giorni." />
</svelte:head>

{#if promo}
	<section class="offer">
		<span class="offer__spark" style="left:6%;top:14%">✦</span><span class="offer__spark" style="right:8%;top:22%;font-size:26px">✦</span><span class="offer__spark" style="left:12%;bottom:18%;font-size:22px">✦</span><span class="offer__spark" style="right:5%;bottom:26%">✦</span>
		<div class="container offer__inner">
			<h1><mark>{promo.qty.toLocaleString('it-IT')}</mark> {promo.product_label}<br />a <mark>{eur(price)}</mark></h1>
			{#if giorni !== null}
				<p class="offer__ends">{#if giorni === 0}<b>Ultimo giorno</b>{:else if giorni === 1}Scade <b>domani</b>{:else}Scade tra <b>{giorni} giorni</b>{/if}</p>
			{/if}
			{#if promo.subtitle}<p class="offer__sub">{promo.subtitle}</p>{/if}
			<div class="offer__stars"><span class="stars">★★★★★</span> {avg} su 5 · recensioni verificate</div>
			{#if promo.chips.length}<div class="offer__chips">{#each promo.chips as c (c)}<span>{c}</span>{/each}</div>{/if}

			{#if promo.includes.length || promo.perks.length}
				<div class="offer__box">
					{#if promo.includes.length}
						<h4>Cosa ricevi</h4>
						{#each promo.includes as i (i.label)}<div class="offer__row"><span>{i.label}</span><b>{i.normally ? `Normalmente ${i.normally}` : ''}</b></div>{/each}
					{/if}
					{#if promo.perks.length}
						<h4>Come ti facciamo risparmiare tempo</h4>
						{#each promo.perks as p (p.label)}<div class="offer__row"><span>{p.label}</span><b>{p.saves ? `Risparmi ${p.saves}` : ''}</b></div>{/each}
					{/if}
					{#if promo.save_text}<div class="offer__row is-save"><span>Risparmi</span><b>{promo.save_text}</b></div>{/if}
					<div class="offer__row is-pay"><span>Paghi</span><b>{eur(price)}</b></div>
				</div>
			{/if}

			{#if promo.sizes.length > 1}
				<div class="offer__sizes" role="tablist" aria-label="Misura">
					{#each promo.sizes as s, i (s.label)}
						<button type="button" class="offer__size" class:is-on={i === sizeIdx} role="tab" aria-selected={i === sizeIdx} onclick={() => (sizeIdx = i)}>{s.label}<span>{eur(s.price)}</span></button>
					{/each}
				</div>
			{/if}

			<div class="offer__drop">
				<label class="dropzone dropzone--compact" class:is-over={over}
					ondragenter={(e) => { e.preventDefault(); over = true; }}
					ondragover={(e) => { e.preventDefault(); over = true; }}
					ondragleave={() => (over = false)}
					ondrop={(e) => { e.preventDefault(); over = false; pick(e.dataTransfer?.files[0]); }}>
					<input type="file" accept={ACCEPT.join(',')} onchange={(e) => pick((e.currentTarget as HTMLInputElement).files?.[0])} />
					<div>
						<div class="dropzone__icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg></div>
						<div class="dropzone__title">{saving ? 'Un attimo…' : 'Trascina qui il tuo file'}</div>
						<div class="dropzone__sub">oppure clicca per sceglierlo · PNG, JPG, SVG, PDF · anteprima immediata</div>
					</div>
				</label>
				{#if error}<p class="error" style="margin-top:10px">{error}</p>{/if}
			</div>
			<div class="offer__cta"><a class="btn btn--green btn--xl" href="{href}?forma={promo.forma}&materiale={promo.materiale}">{promo.cta}</a></div>

			{#if promos.length > 1}
				<div class="offer__more">
					{#each promos as p, i (p.id)}
						<button type="button" class="offer__card" class:is-on={i === cur} onclick={() => { cur = i; sizeIdx = 0; }}>
							<b>{p.qty.toLocaleString('it-IT')} × {eur(p.price)}</b>
							<small>{p.product_label}{#if p.price_normal} · invece di {eur(p.price_normal)}{/if}</small>
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
	<div class="panel panel--navy social-proof center">
		<h2>Consigliati da <span class="hl hl--green">persone come te.</span></h2>
		<p class="lead" style="margin-top:22px">Il <strong>100%</strong> di chi ha lasciato una recensione ha detto che ordinerebbe di nuovo.</p>
		<div class="stats">
			<div class="stat stat--blue"><b>3K+</b><span>Ordini spediti</span></div>
			<div class="stat stat--yellow"><b>{avg} ★</b><span>Valutazione media</span></div>
			<div class="stat stat--pink"><b>5 gg</b><span>Media di produzione</span></div>
		</div>
		<ReviewsCarousel reviews={data.reviews} />
	</div>
</section>

<!-- COME FUNZIONA -->
<section class="section container center">
	<h2>Te li portiamo <span class="hl hl--blue">fino alla porta.</span></h2>
	<div class="howto" style="text-align:left">
		<div class="howto__step"><div class="howto__n">1</div><b>Carica il tuo file</b><p>PNG, PDF, JPG, SVG. Va bene anche se non è pronto per la stampa: lo sistemiamo noi.</p></div>
		<div class="howto__step"><div class="howto__n">2</div><b>Anteprima immediata</b><p>Vedi subito sagoma e linea di taglio, prima di pagare. Nessun salto nel buio.</p></div>
		<div class="howto__step"><div class="howto__n">3</div><b>Approvi, stampiamo</b><p>Un controllo umano sul file, poi in produzione. Pronti in media in 5 giorni.</p></div>
		<div class="howto__step"><div class="howto__n">4</div><b>Ricevi gli adesivi</b><p>Corriere espresso tracciato. E quando arrivano, ci lasci una recensione come gli altri.</p></div>
	</div>
</section>

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
<section class="section container">
	<div class="offer-final">
		<h2>Non essere l'attività della tua città<br /><span class="hl hl--green">senza adesivi.</span></h2>
		<p>Ordina oggi: pronti per la spedizione <b>{data.shipDate}</b>. E inizia a far girare il tuo brand.</p>
		<p style="margin-top:22px"><a class="btn btn--yellow btn--xl" href={promo ? `${href}?forma=${promo.forma}&materiale=${promo.materiale}` : '/adesivi-personalizzati'}>Voglio i miei adesivi</a></p>
	</div>
</section>
