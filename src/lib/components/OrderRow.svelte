<script lang="ts">
	import { customerStatus, trackSteps, materialLabel, type Order } from '$lib/account';
	import { usaLingua } from '$lib/traduzioni';
	import { LOCALES, formatAmount } from '$lib/i18n';
	const { t, path, prezzo, numero, data, lang, locale, misure } = usaLingua();
	let { o, onreorder }: { o: Order; onreorder: (o: Order) => void } = $props();
	const initials = $derived(o.product_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 3).toUpperCase());
	const stato = $derived(customerStatus(o, lang));
	/* ordine pagato in dollari (sito USA, senza IVA): si mostra quanto pagato; altrimenti il lordo in euro nella valuta del locale */
	const importo = (r: Order) => r.currency === 'USD' && r.total_paid_currency != null ? formatAmount(r.total_paid_currency, LOCALES.us) : r.vat_rate === 0 ? formatAmount(r.total_gross, { ...locale, currency: 'EUR' }) : prezzo(r.total_gross);
</script>

<div class="orow">
	<div class="orow__thumb">{#if o.preview_url}<img src={o.preview_url} alt="" />{:else}{initials}{/if}</div>
	<div>
		<div class="orow__meta">{t('checkout.ordine.ordine', { numero: o.number, data: data(o.created_at) })}</div>
		<div class="orow__title">{o.product_name}</div>
		<div class="orow__spec">{t('checkout.ordine.pz', { n: numero(o.qty) })}{#if o.materiale}{' · '}{materialLabel(o.materiale, lang)}{/if}{#if o.width_mm && o.height_mm}{' · '}{misure(o.width_mm, o.height_mm)}{/if}</div>
		<div class="orow__badges">
			<span class="st {stato.cls}">{stato.label}</span>
			{#if o.credit_earned > 0}<span class="credit-pill"><img src="/images/coin-sp.png" alt="" />{t('checkout.ordine.credito', { importo: prezzo(o.credit_earned) })}</span>{/if}
			{#if o.tracking_url}<a class="link" style="font-size:12px" href={o.tracking_url} target="_blank" rel="noopener">{t('checkout.ordine.traccia')}</a>{/if}
		</div>
	</div>
	<div class="orow__track">
		{#each trackSteps(o, lang) as s, i (i)}<span class="tk tk--{s.state}" title={s.label}><i></i>{#if s.state === 'current'}<small>{s.label}</small>{/if}</span>{/each}
	</div>
	<div class="orow__right">
		<span class="orow__price">{importo(o)}</span>
		<button type="button" class="btn btn--yellow btn--xs" onclick={() => onreorder(o)}>{t('checkout.ordine.riordina')}</button>
		{#if o.invoice_id}<a class="btn btn--blue btn--xs" href={path(`/account/fatture/${o.invoice_id}`)}>{t('checkout.ordine.fattura')}</a>{/if}
	</div>
</div>
