<script lang="ts">
	/** Blocco di chiusura (home, pagine prodotto, offerte): scuro, titolo a due righe, bottone giallo a tutta larghezza */
	let { shipDate, href = '/adesivi-personalizzati', label = 'Voglio i miei adesivi' }: { shipDate: string; href?: string; label?: string } = $props();
</script>

<section class="section container">
	<div class="offer-final">
		<h2>Fatti riconoscere, ovunque.<br />Il tuo brand merita adesivi <span class="hl hl--green">impossibili da ignorare.</span></h2>
		<p>Ordina oggi: pronti per la spedizione <b>{shipDate}</b>. E inizia a far girare il tuo brand.</p>
		<p style="margin-top:22px"><a class="btn btn--yellow btn--xl" {href}>{label}</a></p>
	</div>
</section>
