<script lang="ts">
	/* Campi dei dati di fatturazione che il cliente compila sulla conferma d'ordine e sul preventivo (Mattia, 25/11/2026).
	   Solo i campi: il <form> e il bottone li mette la pagina. La regola su cosa serve sta in $lib/dati-fattura. */
	import { usaLingua } from '$lib/traduzioni';
	import type { CampoMancante, DatiFattura } from '$lib/dati-fattura';
	let { valori = {}, errori = [] }: { valori?: DatiFattura; errori?: CampoMancante[] } = $props();
	const { t, locale } = usaLingua();
	const v = (k: keyof DatiFattura) => String(valori?.[k] ?? '').trim();
	/* si parte da "azienda" se c'e' gia' una partita IVA o se non si sa ancora niente; da "privato" se c'e' solo il codice fiscale */
	let tipo = $state<'azienda' | 'privato'>(v('vat') || !v('fiscal_code') ? 'azienda' : 'privato');
	let paese = $state((v('country') || 'IT').toUpperCase());
	const estero = $derived(paese !== 'IT');
	/* ragione sociale: negli ordini manuali il campo "company" contiene il nome del cliente anche quando e' un privato */
	const PAESI = ['IT', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB', 'NO', 'SM', 'US'];
	const nomi = $derived.by(() => { try { const n = new Intl.DisplayNames([locale.intl], { type: 'region' }); return PAESI.map((c) => [c, n.of(c) ?? c] as const); } catch { return PAESI.map((c) => [c, c] as const); } });
	const ko = (c: CampoMancante) => errori.includes(c);
</script>

<div class="df">
	<div class="df__tipo" role="radiogroup" aria-label={t('account.datiFattura.titolo')}>
		<label class:is-on={tipo === 'azienda'}><input type="radio" name="tipo" value="azienda" bind:group={tipo} /> {t('account.datiFattura.azienda')}</label>
		<label class:is-on={tipo === 'privato'}><input type="radio" name="tipo" value="privato" bind:group={tipo} /> {t('account.datiFattura.privato')}</label>
	</div>
	{#if tipo === 'azienda'}
		<label class="df__f df__f--2" class:is-ko={ko('nome')}><span>{t('account.datiFattura.ragioneSociale')}</span><input name="company" value={v('company')} required autocomplete="organization" /></label>
		<label class="df__f" class:is-ko={ko('fiscale')}><span>{t('account.datiFattura.piva')}</span><input name="vat" value={v('vat')} required={!estero} inputmode={estero ? 'text' : 'numeric'} autocomplete="off" /></label>
		{#if !estero}<label class="df__f"><span>{t('account.datiFattura.cfFacoltativo')}</span><input name="fiscal_code" value={v('fiscal_code')} autocomplete="off" /></label>{/if}
		{#if !estero}
			<label class="df__f"><span>{t('account.datiFattura.sdi')}</span><input name="sdi" value={v('sdi')} maxlength="7" autocomplete="off" /></label>
			<label class="df__f"><span>{t('account.datiFattura.pec')}</span><input name="pec" type="email" value={v('pec')} autocomplete="off" /></label>
			<small class="df__nota df__f--2">{t('account.datiFattura.sdiNota')}</small>
		{/if}
	{:else}
		<label class="df__f" class:is-ko={ko('nome')}><span>{t('account.datiFattura.nome')}</span><input name="first_name" value={v('first_name')} required autocomplete="given-name" /></label>
		<label class="df__f" class:is-ko={ko('nome')}><span>{t('account.datiFattura.cognome')}</span><input name="last_name" value={v('last_name')} required autocomplete="family-name" /></label>
		{#if !estero}<label class="df__f df__f--2" class:is-ko={ko('fiscale')}><span>{t('account.datiFattura.cf')}</span><input name="fiscal_code" value={v('fiscal_code')} required maxlength="16" autocomplete="off" style="text-transform:uppercase" /></label>{/if}
	{/if}
	<label class="df__f df__f--2" class:is-ko={ko('indirizzo')}><span>{t('account.datiFattura.indirizzo')}</span><input name="street" value={v('street')} required autocomplete="street-address" /></label>
	<label class="df__f" class:is-ko={ko('cap')}><span>{t('account.datiFattura.cap')}</span><input name="zip" value={v('zip')} required={!estero} inputmode={estero ? 'text' : 'numeric'} maxlength={estero ? 12 : 5} autocomplete="postal-code" /></label>
	<label class="df__f" class:is-ko={ko('citta')}><span>{t('account.datiFattura.citta')}</span><input name="city" value={v('city')} required autocomplete="address-level2" /></label>
	<label class="df__f" class:is-ko={ko('provincia')}><span>{t('account.datiFattura.provincia')}</span><input name="province" value={v('province')} required={!estero} maxlength={estero ? 3 : 2} autocomplete="address-level1" style="text-transform:uppercase" /></label>
	<label class="df__f"><span>{t('account.datiFattura.paese')}</span><select name="country" bind:value={paese} autocomplete="country">{#each nomi as [c, n] (c)}<option value={c}>{n}</option>{/each}</select></label>
</div>

<style>
	.df { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; text-align: left; }
	.df__tipo { grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; }
	.df__tipo label { display: flex; align-items: center; gap: 6px; padding: 9px 14px; border: 1.5px solid var(--line); border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer; background: #fff; color: var(--ink); }
	.df__tipo label.is-on { border-color: var(--blue); background: #f4f9ff; }
	/* dentro il modulo di conferma del preventivo (.qp__accept input) i campi si allargano: i pallini no */
	.df__tipo input { flex: none; width: auto; min-width: 0; padding: 0; margin: 0; }
	.df__f input, .df__f select { min-width: 0; flex: none; }
	.df__f { display: grid; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--ink); min-width: 0; }
	.df__f--2 { grid-column: 1 / -1; }
	.df__f input, .df__f select { width: 100%; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 12px; font: inherit; font-size: 15px; font-weight: 400; background: #fff; color: var(--ink); }
	.df__f.is-ko input { border-color: #dc2626; background: #fff5f5; }
	.df__nota { color: var(--muted); font-size: 12.5px; font-weight: 400; }
	@media (max-width: 560px) { .df { grid-template-columns: 1fr; } }
</style>
