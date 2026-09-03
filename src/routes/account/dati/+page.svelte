<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const p = $derived(data.profile);
	let showAdd = $state(false);
</script>

<svelte:head><title>Dati e indirizzi | Stickerprint</title></svelte:head>

<div class="acc__head"><div><p class="eyebrow">Area personale</p><h1>Dati e indirizzi</h1><p class="lead">Dati di fatturazione e indirizzi di spedizione, pronti per il prossimo ordine.</p></div></div>

{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="acard">
	<h3>I tuoi dati</h3>
	<p class="sub" style="margin-bottom:12px">Email di accesso: <b>{p?.email}</b> · <a class="link" href="/account/password">cambia password</a></p>
	{#if form?.ok === 'profile'}<p class="success">Dati salvati.</p>{/if}
	<form class="aform" method="POST" action="?/profile" use:enhance>
		<label>Nome e cognome<input name="full_name" value={p?.full_name ?? ''} /></label>
		<label>Telefono<input name="phone" value={p?.phone ?? ''} /></label>
		<label>Azienda (per fattura)<input name="company_name" value={p?.company_name ?? ''} /></label>
		<label>Partita IVA<input name="vat_number" value={p?.vat_number ?? ''} /></label>
		<label>Codice fiscale<input name="fiscal_code" value={p?.fiscal_code ?? ''} /></label>
		<label>Codice SDI<input name="sdi_code" value={p?.sdi_code ?? ''} maxlength="7" /></label>
		<label>PEC<input name="pec" type="email" value={p?.pec ?? ''} /></label>
		<div><button class="btn btn--green" type="submit">Salva i dati</button></div>
	</form>
</div>

<div class="acard">
	<div class="acc__head" style="margin-bottom:10px"><div><h3>Indirizzi</h3><p class="sub">Spedizione e fatturazione.</p></div><button type="button" class="btn btn--ghost btn--xs" onclick={() => (showAdd = !showAdd)}>{showAdd ? 'Annulla' : '+ Aggiungi indirizzo'}</button></div>
	{#if form?.ok === 'address'}<p class="success">Indirizzo aggiunto.</p>{/if}
	{#if showAdd}
		<form class="aform" method="POST" action="?/address" use:enhance={() => async ({ update }) => { await update(); showAdd = false; }} style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--line)">
			<label>Tipo<select name="kind"><option value="shipping">Spedizione</option><option value="billing">Fatturazione</option></select></label>
			<label>Etichetta (es. Casa, Ufficio)<input name="label" /></label>
			<label>Nome<input name="first_name" required /></label>
			<label>Cognome<input name="last_name" required /></label>
			<label class="full">Azienda<input name="company" /></label>
			<label class="full">Via e numero<input name="street" required /></label>
			<label>Città<input name="city" required /></label>
			<label>CAP<input name="zip" required /></label>
			<label>Provincia (sigla)<input name="province" required maxlength="2" /></label>
			<label>Paese<input name="country" value="IT" /></label>
			<label>Telefono<input name="phone" /></label>
			<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_default" /> Predefinito</label>
			<div class="full"><button class="btn btn--green" type="submit">Salva indirizzo</button></div>
		</form>
	{/if}
	{#if data.addresses.length === 0}
		<p class="empty">Nessun indirizzo salvato.</p>
	{:else}
		{#each data.addresses as a (a.id)}
			<div class="orow" style="grid-template-columns:1fr auto">
				<div>
					<div class="orow__meta">{a.kind === 'billing' ? 'Fatturazione' : 'Spedizione'}{#if a.is_default} · predefinito{/if}{#if a.label} · {a.label}{/if}</div>
					<div class="orow__title">{a.first_name} {a.last_name}{#if a.company} · {a.company}{/if}</div>
					<div class="orow__spec">{a.street}, {a.zip} {a.city} ({a.province}) {a.country}{#if a.phone} · {a.phone}{/if}</div>
				</div>
				<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={a.id} /><button class="link-btn" type="submit" onclick={(e) => { if (!confirm('Eliminare questo indirizzo?')) e.preventDefault(); }}>Elimina</button></form>
			</div>
		{/each}
	{/if}
</div>
