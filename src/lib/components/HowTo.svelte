<script lang="ts">
	/** "Te li portiamo fino alla porta": i quattro passi, in home, nelle offerte e nelle pagine prodotto. Testi nel catalogo prodotti.comeFunziona */
	import { usaLingua } from '$lib/traduzioni';
	let { shipDate, dark = false }: { shipDate: string; dark?: boolean } = $props();
	const { t } = usaLingua();
	const k = 'prodotti.comeFunziona';
</script>

<section class="section container center howto-wrap" class:is-dark={dark}>
	<h2>{t(`${k}.titolo`)} <span class="hl hl--blue">{t(`${k}.hl`)}</span></h2>
	<div class="howto" style="text-align:left">
		<div class="howto__step"><div class="howto__n">1</div><b>{t(`${k}.uno.titolo`)}</b><p>{t(`${k}.uno.testo`)}</p></div>
		<div class="howto__step"><div class="howto__n">2</div><b>{t(`${k}.due.titolo`)}</b><p>{t(`${k}.due.testo`)}</p></div>
		<div class="howto__step"><div class="howto__n">3</div><b>{t(`${k}.tre.titolo`)}</b><p>{t(`${k}.tre.testo`)} {t(`${k}.tre.spedizione`)} <b>{shipDate}</b>.</p></div>
		<div class="howto__step"><div class="howto__n">4</div><b>{t(`${k}.quattro.titolo`)}</b><p>{t(`${k}.quattro.testo`)}</p></div>
	</div>
</section>
