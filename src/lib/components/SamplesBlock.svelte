<script lang="ts">
	/* Kit campioni: lo stesso blocco della home, usato anche nelle pagine prodotto.
	   Elenco e prezzo dal kit nella lingua (kitFor), il resto dal catalogo prodotti.campioni */
	import { usaLingua } from '$lib/traduzioni';
	import { kitFor } from '$lib/prodotti-testi';
	const { t, path, lang, prezzo } = usaLingua();
	const kit = kitFor(lang);
	/* 10 € IVA inclusa (SAMPLES_GROSS del checkout): in dollari al listino, senza decimali */
	const prezzoKit = prezzo(10, 0);
</script>

<section class="section--tight container">
	<div class="samples">
		<div class="samples__pile"><img src={kit.img} alt={t('prodotti.campioni.alt')} width="1417" height="1724" loading="lazy" /></div>
		<div class="samples__body">
			<span class="tag tag--yellow">{t('prodotti.campioni.tag')}</span>
			<h2 style="margin-top:14px">{t('prodotti.campioni.titolo')} <span class="hl hl--yellow">{t('prodotti.campioni.hl')}</span></h2>
			<ul class="samples__list">
				{#each kit.checks as c (c)}<li><span class="ck">✓</span>{c}</li>{/each}
			</ul>
		</div>
		<div class="samples__cta">
			<a class="btn btn--yellow btn--lg" href={path('/campioni')}>{t('prodotti.campioni.ordina')}</a>
			<div class="samples__price hl hl--yellow"><b>{prezzoKit}</b><span>{@html t('prodotti.campioni.recuperi')}</span></div>
		</div>
	</div>
</section>
