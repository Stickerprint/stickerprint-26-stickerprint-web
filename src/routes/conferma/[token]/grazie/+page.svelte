<script lang="ts">
	import '$lib/styles/quote.css';
	import { usaLingua } from '$lib/traduzioni';
	import { formatAmount } from '$lib/i18n';
	const { t, path, data: dataL, locale } = usaLingua();
	const money = (v: number) => formatAmount(v, { ...locale, currency: 'EUR' });
	let { data } = $props();
	const it = (d: string | null) => (d ? dataL(d.slice(0, 10) + 'T12:00:00') : '');
	const n = $derived(String(data.number).replace(/[<>&]/g, ''));
	/* cosa dire: pagamento arrivato (tutto o in parte), preventivo confermato senza niente da pagare, oppure c'e' ancora un anticipo */
	const testo = $derived(
		data.pagato ? (data.due > 0 ? t('account.grazie.pagatoResta', { n, importo: money(data.due) }) : t('account.grazie.pagato', { n }))
		: data.due > 0 ? t('account.grazie.daPagare', { n, importo: money(data.due) })
		: data.dalPreventivo ? t('account.grazie.confermato', { n })
		: t('account.grazie.registrato', { n })
	);
</script>

<svelte:head><title>{t('account.grazie.titolo', { n: data.number })}</title><meta name="robots" content="noindex" /></svelte:head>

<section class="qp">
	<div class="qp__wrap" style="max-width:760px">
		<header class="qp__head">
			<p class="qp__kicker">{t('account.conferma.kicker', { n: data.number, data: it(data.created_at) })}</p>
			<h1>{t('account.preventivo.grazie', { nome: data.first_name })} <span class="hl">{t('account.preventivo.grazieEvidenza')}</span> ✅</h1>
			<p class="qp__lead">{@html testo}</p>
			{#if data.email && !data.pagato && data.due === 0}<p class="qp__lead" style="margin-top:8px">{t('account.grazie.email')}</p>{/if}
			{#if data.spedizione}<p class="qp__ship" style="margin-top:14px"><span class="qp__rocket" aria-hidden="true">🚀</span><span>{t('account.doc.spedizioneStimata')}<b>{it(data.spedizione)}</b></span></p>{/if}
		</header>
		<div class="qp__cta">
			<div class="qp__more">
				{#if data.due > 0}<a class="btn btn--green" href={path(`/conferma/${data.token}`)}>{t('account.grazie.vaiPagamento')}</a>
				{:else}<a class="btn btn--blue" href={path(`/conferma/${data.token}`)}>{t('account.grazie.vediOrdine')}</a>{/if}
				<a class="btn btn--ghost" href={path(`/conferma/${data.token}/pdf`)}>{t('account.doc.scaricaPdf')}</a>
			</div>
			<p class="note">{t('account.grazie.nota')}</p>
		</div>
	</div>
</section>
