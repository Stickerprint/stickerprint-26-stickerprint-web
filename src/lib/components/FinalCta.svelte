<script lang="ts">
	/** Blocco di chiusura (home, pagine prodotto, offerte): scuro, titolo a due righe, bottone giallo a tutta larghezza. Testi in prodotti.ctaFinale */
	import { usaLingua } from '$lib/traduzioni';
	let { shipDate, href = '/adesivi-personalizzati', label }: { shipDate: string; href?: string; label?: string } = $props();
	const { t, path } = usaLingua();
	/* le ancore (#configura) restano come sono, i percorsi interni prendono prefisso e slug della lingua */
	const link = $derived(href.startsWith('/') ? path(href) : href);
	const testo = $derived(label ?? t('prodotti.ctaFinale.bottone'));
</script>

<section class="section container">
	<div class="offer-final">
		<h2>{t('prodotti.ctaFinale.titolo')}<br />{t('prodotti.ctaFinale.titolo2')} <span class="hl hl--green">{t('prodotti.ctaFinale.hl')}</span></h2>
		<p>{t('prodotti.ctaFinale.prima')} <b>{shipDate}</b>. {t('prodotti.ctaFinale.dopo')}</p>
		<p style="margin-top:22px"><a class="btn btn--yellow btn--xl" href={link}>{testo}</a></p>
	</div>
</section>
