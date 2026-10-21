<script lang="ts">
	/**
	 * Barra "ti mancano X per la spedizione gratuita": nel carrello e sotto i preventivatori.
	 * La soglia e' quella del locale (`locale.freeShipping`, nella valuta del locale: 50 € IT, 69 € UE, 99 $ USA);
	 * `gross` arriva in euro (totale prodotti IVA inclusa) e si converte nella valuta prima del confronto.
	 */
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount, toCurrency } from '$lib/i18n';
	let { gross, compact = false, prefix = '' }: { gross: number; compact?: boolean; prefix?: string } = $props();
	const { t, locale } = usaLingua();
	const soglia = $derived(locale.freeShipping);
	const grossLocale = $derived(toCurrency(gross, locale.currency));
	/** quanto manca alla spedizione gratuita, nella valuta del locale (0 se raggiunta) */
	const missing = $derived(Math.max(0, Math.round((soglia - grossLocale) * 100) / 100));
	const pct = $derived(Math.max(4, Math.min(100, (grossLocale / soglia) * 100)));
</script>

<div class="fship" class:fship--ok={missing === 0} class:fship--compact={compact} role="status">
	<div class="fship__txt">
		{#if missing === 0}
			<span class="fship__ico">🚚</span><b>{t('configuratore.spedizione.raggiunta')}</b>
		{:else}
			<!-- testo dal catalogo (il prefisso arriva dai componenti, mai da input utente) -->
			<span class="fship__ico">🚚</span><span>{@html t('configuratore.spedizione.mancano', { prefix, importo: formatAmount(missing, locale, 2) })}</span>
		{/if}
	</div>
	<div class="fship__bar"><i style="width:{pct}%"></i></div>
	{#if !compact}<small>{t('configuratore.spedizione.nota', { soglia: formatAmount(soglia, locale, 0) })}</small>{/if}
</div>

<style>
	.fship { display: grid; gap: 7px; padding: 12px 14px; border-radius: 14px; background: var(--sky, #eaf4ff); border: 1.5px solid rgba(0,120,255,.12); }
	.fship--ok { background: #e6f8ee; border-color: rgba(16,150,80,.18); }
	.fship__txt { display: flex; align-items: center; gap: 8px; font: 500 14px/1.3 Montserrat, system-ui; color: var(--navy, #0b0b3b); }
	.fship__ico { font-size: 18px; }
	.fship__bar { height: 9px; border-radius: 999px; background: rgba(11,11,59,.1); overflow: hidden; }
	.fship__bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #f7941d, #f9c94a); transition: width .4s ease; }
	.fship--ok .fship__bar i { background: linear-gradient(90deg, #1fa463, #4cd68a); }
	.fship small { font-size: 12px; color: #5b6478; }
	.fship--compact { padding: 10px 12px; }
	.fship--compact .fship__txt { font-size: 13px; }
</style>
