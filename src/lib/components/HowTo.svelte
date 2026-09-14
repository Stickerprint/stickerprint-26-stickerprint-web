<script lang="ts">
	/** "Te li portiamo fino alla porta": i quattro passi, in home e nelle offerte */
	let { shipDate, dark = false }: { shipDate: string; dark?: boolean } = $props();
</script>

<section class="section container center howto-wrap" class:is-dark={dark}>
	<h2>Te li portiamo <span class="hl hl--blue">fino alla porta.</span></h2>
	<div class="howto" style="text-align:left">
		<div class="howto__step"><div class="howto__n">1</div><b>Carica il tuo file</b><p>PNG, PDF, JPG, SVG. Va bene anche se non è pronto per la stampa: lo sistemiamo noi.</p></div>
		<div class="howto__step"><div class="howto__n">2</div><b>Anteprima immediata</b><p>Vedi subito sagoma e linea di taglio, prima di pagare. Nessun salto nel buio.</p></div>
		<div class="howto__step"><div class="howto__n">3</div><b>Approvi, stampiamo</b><p>Un controllo umano sul file, poi in produzione. Pronti per la spedizione entro <b>{shipDate}</b>.</p></div>
		<div class="howto__step"><div class="howto__n">4</div><b>Ricevi gli adesivi</b><p>Corriere espresso tracciato. E quando arrivano, ci lasci una recensione come gli altri.</p></div>
	</div>
</section>
