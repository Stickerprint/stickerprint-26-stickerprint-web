<script lang="ts">
	/* "Perché Stickerprint?": confronto a tre colonne sul modello del visual.
	   Fondo bianco, colonna centrale in evidenza, spunte verdi contro trattini grigi. */
	let { href = '/adesivi-personalizzati' }: { href?: string } = $props();

	const rows = [
		{ icon: 'gem', label: 'Cosa ricevi?', us: 'Adesivi personalizzati di alta qualità', them: 'Adesivi economici sempre in promo' },
		{ icon: 'file', label: 'Anteprima del file', us: 'Immediata, ancora prima di pagare', them: 'A pagamento o assente' },
		{ icon: 'people', label: 'Esperienza', us: '19 anni di esperienza nella stampa', them: 'Non sempre dichiarata' },
		{ icon: 'clock', label: 'Produzione', us: '5 giorni lavorativi', them: '7–15 giorni lavorativi' },
		{ icon: 'layers', label: 'Materiali', us: 'Materiali premium selezionati', them: 'Materiali economici per contenere il prezzo' },
		{ icon: 'shield', label: 'Durata della stampa', us: 'Stampa resistente che non sbiadisce', them: 'Qualità e durata variabili' }
	];

	const icons: Record<string, string> = {
		gem: '<path d="M3 9l4-5h10l4 5-9 12z"/><path d="M3 9h18M9 4l3 5 3-5M9 9l3 12 3-12"/>',
		file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
		people: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20a6 6 0 0 1 12 0M14.5 20a4.5 4.5 0 0 1 7 0"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
		layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
		shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
	};
</script>

<section class="section container cmp2">
	<h2 class="cmp2__title">Perché <span class="cmp2__brand">Stickerprint?</span></h2>
	<p class="cmp2__sub">Noi investiamo nei materiali, non nelle promozioni.</p>

	<div class="cmp2__grid">
		<div class="cmp2__col cmp2__col--labels">
			<div class="cmp2__head">Il confronto</div>
			{#each rows as r (r.label)}
				<div class="cmp2__cell cmp2__label">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html icons[r.icon]}</svg>
					<span>{r.label}</span>
				</div>
			{/each}
		</div>

		<div class="cmp2__col cmp2__col--us">
			<div class="cmp2__head cmp2__head--us"><span class="cmp2__logo">Sticker<b>print</b></span></div>
			{#each rows as r (r.label)}
				<div class="cmp2__cell cmp2__us">
					<span class="cmp2__ok" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4 8-9"/></svg></span>
					<span><b class="cmp2__mlabel">{r.label.replace("?", "")}:</b> {r.us}</span>
				</div>
			{/each}
		</div>

		<div class="cmp2__col cmp2__col--them">
			<div class="cmp2__head">Siti sempre in promo</div>
			{#each rows as r (r.label)}
				<div class="cmp2__cell cmp2__them">
					<span class="cmp2__no" aria-hidden="true"></span>
					<span><b class="cmp2__mlabel">{r.label.replace("?", "")}:</b> {r.them}</span>
				</div>
			{/each}
		</div>
	</div>

	<p class="cmp2__close"><b>Se cerchi competenza tecnica e adesivi di alta qualità, sei nel posto giusto.</b><br />Se cerchi l'ennesima promo che scade domenica e ricomincia lunedì, purtroppo non possiamo aiutarti :(</p>
	<p class="cmp2__cta"><a class="btn btn--green btn--lg" {href}>Crea i tuoi adesivi →</a></p>
</section>

<style>
	.cmp2 { text-align: center; }
	.cmp2__title { font-family: var(--font-display); font-weight: 800; font-size: clamp(34px, 4.6vw, 60px); letter-spacing: -0.02em; line-height: 1.05; text-transform: uppercase; color: var(--ink); margin: 0; }
	.cmp2__brand { color: var(--blue); }
	.cmp2__sub { margin: 12px auto 0; font-size: clamp(17px, 1.4vw, 21px); color: var(--ink-soft); font-weight: 600; }

	.cmp2__grid { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 16px; align-items: start; margin-top: 34px; text-align: left; }
	.cmp2__col { display: grid; gap: 8px; }
	.cmp2__head { font-family: var(--font-display); font-weight: 800; font-size: 19px; letter-spacing: 0.01em; text-transform: uppercase; color: var(--ink); padding: 20px 22px; border-radius: 16px; background: #f1f2f7; }
	.cmp2__cell { display: flex; align-items: center; gap: 14px; min-height: 66px; padding: 12px 18px; border-radius: 14px; background: #f7f7fb; font-size: 16px; line-height: 1.35; }

	/* colonna etichette */
	.cmp2__label { font-family: var(--font-display); font-weight: 800; font-size: 15px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink); }
	.cmp2__label svg { width: 26px; height: 26px; flex: 0 0 26px; color: var(--ink); }

	/* colonna Stickerprint in evidenza */
	.cmp2__col--us { padding: 6px; border: 3px solid var(--blue); border-radius: 22px; background: #fff; box-shadow: 0 20px 50px rgba(14, 139, 255, .16); margin-top: -10px; }
	.cmp2__head--us { background: var(--navy); color: #fff; text-align: center; text-transform: none; font-size: 30px; padding: 22px; border-radius: 16px 16px 8px 8px; }
	.cmp2__logo b { color: var(--yellow); font-weight: 800; }
	.cmp2__us { background: #fff; border-bottom: 1px solid var(--line); border-radius: 0; font-weight: 600; color: var(--ink); }
	.cmp2__us:last-child { border-bottom: 0; }
	.cmp2__ok { display: inline-grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; background: #2fb457; }
	.cmp2__ok svg { width: 18px; height: 18px; }

	/* colonna competitor */
	.cmp2__them { color: var(--muted); }
	.cmp2__no { position: relative; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%; background: #c9cbd8; }
	.cmp2__no::after { content: ""; position: absolute; left: 9px; right: 9px; top: 13px; height: 4px; border-radius: 2px; background: #fff; }
	.cmp2__mlabel { display: none; }

	.cmp2__close { margin: 30px auto 0; font-size: 17px; line-height: 1.5; color: var(--ink-soft); max-width: 70ch; }
	.cmp2__close b { color: var(--ink); font-size: 21px; }
	.cmp2__cta { margin-top: 22px; }

	@media (max-width: 900px) {
		.cmp2__grid { grid-template-columns: 1fr; gap: 14px; }
		.cmp2__col--labels { display: none; }
		.cmp2__col--us { margin-top: 0; }
		.cmp2__mlabel { display: inline; color: var(--ink-soft); font-weight: 800; }
		.cmp2__cell { min-height: 0; }
		.cmp2__close b { font-size: 18px; }
	}
</style>
