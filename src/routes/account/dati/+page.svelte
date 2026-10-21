<script lang="ts">
	import { enhance } from '$app/forms';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path } = usaLingua();
	let { data, form } = $props();
	const p = $derived(data.profile);
	let showAdd = $state(false);
</script>

<svelte:head><title>{t('account.dati.titolo')}</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">{t('account.layout.areaPersonale')}</p><h1>{t('account.dati.h1')}</h1><p class="lead">{t('account.dati.lead')}</p></div></div>

{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="acard">
	<h3>{t('account.dati.tuoiDati')}</h3>
	<p class="sub" style="margin-bottom:12px">{t('account.dati.emailAccesso')} <b>{p?.email}</b> · <a class="link" href={path('/account/password')}>{t('account.dati.cambiaPassword')}</a></p>
	{#if form?.ok === 'profile'}<p class="success">{t('account.dati.salvati')}</p>{/if}
	<form class="aform" method="POST" action="?/profile" use:enhance>
		<label>{t('account.dati.nome')}<input name="full_name" value={p?.full_name ?? ''} /></label>
		<label>{t('account.dati.telefono')}<input name="phone" value={p?.phone ?? ''} /></label>
		<label>{t('account.dati.azienda')}<input name="company_name" value={p?.company_name ?? ''} /></label>
		<label>{t('account.dati.piva')}<input name="vat_number" value={p?.vat_number ?? ''} /></label>
		<label>{t('account.dati.cf')}<input name="fiscal_code" value={p?.fiscal_code ?? ''} /></label>
		<label>{t('account.dati.sdi')}<input name="sdi_code" value={p?.sdi_code ?? ''} maxlength="7" /></label>
		<label>{t('account.dati.pec')}<input name="pec" type="email" value={p?.pec ?? ''} /></label>
		<div><button class="btn btn--green" type="submit">{t('account.dati.salvaDati')}</button></div>
	</form>
</div>

<div class="acard">
	<div class="acc__head" style="margin-bottom:10px"><div><h3>{t('account.dati.indirizzi')}</h3><p class="sub">{t('account.dati.indirizziSub')}</p></div><button type="button" class="btn btn--ghost btn--xs" onclick={() => (showAdd = !showAdd)}>{showAdd ? t('account.dati.annulla') : t('account.dati.aggiungi')}</button></div>
	{#if form?.ok === 'address'}<p class="success">{t('account.dati.aggiunto')}</p>{/if}
	{#if showAdd}
		<form class="aform" method="POST" action="?/address" use:enhance={() => async ({ update }) => { await update(); showAdd = false; }} style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--line)">
			<label>{t('account.dati.tipo')}<select name="kind"><option value="shipping">{t('account.dati.spedizione')}</option><option value="billing">{t('account.dati.fatturazione')}</option></select></label>
			<label>{t('account.dati.etichetta')}<input name="label" /></label>
			<label>{t('account.dati.nomeBreve')}<input name="first_name" required /></label>
			<label>{t('account.dati.cognome')}<input name="last_name" required /></label>
			<label class="full">{t('account.dati.aziendaBreve')}<input name="company" /></label>
			<label class="full">{t('account.dati.via')}<input name="street" required /></label>
			<label>{t('account.dati.citta')}<input name="city" required /></label>
			<label>{t('account.dati.cap')}<input name="zip" required /></label>
			<label>{t('account.dati.provincia')}<input name="province" required maxlength="2" /></label>
			<label>{t('account.dati.paese')}<input name="country" value="IT" /></label>
			<label>{t('account.dati.telefono')}<input name="phone" /></label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_default" /> {t('account.dati.predefinito')}</label>
			<div class="full"><button class="btn btn--green" type="submit">{t('account.dati.salvaIndirizzo')}</button></div>
		</form>
	{/if}
	{#if data.addresses.length === 0}
		<p class="empty">{t('account.dati.nessuno')}</p>
	{:else}
		{#each data.addresses as a (a.id)}
			<div class="orow orow--act">
				<div>
					<div class="orow__meta">{a.kind === 'billing' ? t('account.dati.fatturazione') : t('account.dati.spedizione')}{#if a.is_default} · {t('account.dati.predefinitoTag')}{/if}{#if a.label} · {a.label}{/if}</div>
					<div class="orow__title">{a.first_name} {a.last_name}{#if a.company} · {a.company}{/if}</div>
					<div class="orow__spec">{a.street}, {a.zip} {a.city} ({a.province}) {a.country}{#if a.phone} · {a.phone}{/if}</div>
				</div>
				<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={a.id} /><button class="link-btn" type="submit" onclick={(e) => { if (!confirm(t('account.dati.confermaElimina'))) e.preventDefault(); }}>{t('account.dati.elimina')}</button></form>
			</div>
		{/each}
	{/if}
</div>
