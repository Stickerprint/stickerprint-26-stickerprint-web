<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATS, categoryFromCode, COUNTRIES, PAYMENT_METHODS_MANUALI, SHIPPING_METHODS, money } from '$lib/dashboard/orders';
	let { data, form } = $props();
	interface Item { code: string; description: string; qty: number; price: number; lamination: string; mockup_url: string | null }
	let items = $state<Item[]>([{ code: '', description: '', qty: 100, price: 0.35, lamination: 'nessuna', mockup_url: null }]);
	let lordi = $state(false);
	let shipSame = $state(true);
	let saving = $state(false);
	let uploadMsg = $state('');
	const today = new Date().toISOString().slice(0, 10);
	const qtyTot = $derived(items.reduce((s, i) => s + Number(i.qty || 0), 0));
	const inserted = $derived(items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0));
	const net = $derived(lordi ? inserted / 1.22 : inserted);
	const iva = $derived(lordi ? inserted - net : inserted * 0.22);
	const tot = $derived(lordi ? inserted : inserted * 1.22);
	const catOf = (code: string) => { const s = categoryFromCode(code); return s ? CATS[s].name : ''; };
	async function mockup(i: number, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadMsg = 'Caricamento…';
		const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
		const path = `staff/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
		const { error } = await data.supabase.storage.from('order-files').upload(path, file, { contentType: file.type });
		if (error) { uploadMsg = `Mockup non caricato: ${error.message}`; return; }
		// il bucket è privato: salviamo un link firmato lungo per la dashboard
		const { data: signed } = await data.supabase.storage.from('order-files').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
		items[i].mockup_url = signed?.signedUrl ?? null;
		uploadMsg = '';
		input.value = '';
	}
</script>

<svelte:head><title>Nuovo ordine manuale | Dashboard</title></svelte:head>

<form method="POST" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; await update(); }; }} style="display:grid;gap:18px">
	<input type="hidden" name="items" value={JSON.stringify(items)} />
	<input type="hidden" name="price_type" value={lordi ? 'lordi' : 'netti'} />
	<input type="hidden" name="ship_same" value={shipSame ? 'on' : 'off'} />
	<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/ordini">Ordini</a> › <b>Nuovo ordine manuale</b></p>
	<div class="toolbar" style="justify-content:space-between">
		<div><h1>Nuovo ordine manuale</h1><p class="lead">Ordine inserito a mano (telefono, email, fiera). Entra subito in produzione.</p></div>
		<div style="display:flex;gap:8px"><a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini">Annulla</a><button class="btn btn--green" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : '💾 Salva e crea ordine'}</button></div>
	</div>
	{#if form?.error}<p class="error">{form.error}</p>{/if}
	{#if uploadMsg}<p class="error">{uploadMsg}</p>{/if}

	<div class="grid3">
		<div class="dcard">
			<h3>👤 Dati cliente</h3>
			<div class="dform dform--1">
				<label>Cliente / ragione sociale<input name="name" required placeholder="Nome e cognome o azienda" /></label>
				<div class="row2"><label>Nome<input name="first_name" /></label><label>Cognome<input name="last_name" /></label></div>
				<label>Indirizzo<input name="address" placeholder="Via, civico" /></label>
				<div class="row3"><label>Comune<input name="city" /></label><label>CAP<input name="cap" /></label><label>Prov.<input name="province" maxlength="2" /></label></div>
				<label>Paese<select name="country">{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k} selected={k === 'IT'}>{v.flag} {v.name}</option>{/each}</select></label>
				<div class="row2"><label>Partita IVA<input name="piva" /></label><label>Codice fiscale<input name="cf" /></label></div>
				<div class="row2"><label>Codice SDI<input name="sdi" maxlength="7" /></label><label>PEC<input name="pec" type="email" /></label></div>
				<div class="row2"><label>Email<input name="email" type="email" /></label><label>Telefono<input name="phone" /></label></div>
				<label>Note interne<textarea name="notes" rows="2"></textarea></label>
			</div>
		</div>
		<div class="dcard">
			<h3>📅 Dati ordine e spedizione</h3>
			<div class="dform dform--1">
				<label style="display:flex;gap:8px;align-items:center;flex-direction:row"><input type="checkbox" bind:checked={shipSame} /> Spedizione uguale all’indirizzo di fatturazione</label>
				{#if !shipSame}
					<label>Destinatario<input name="ship_name" /></label>
					<label>Indirizzo<input name="ship_address" /></label>
					<div class="row3"><label>Comune<input name="ship_city" /></label><label>CAP<input name="ship_cap" /></label><label>Prov.<input name="ship_province" maxlength="2" /></label></div>
					<label>Paese<select name="ship_country">{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k} selected={k === 'IT'}>{v.flag} {v.name}</option>{/each}</select></label>
				{/if}
				<div class="row2"><label>Data ordine<input name="date" type="date" value={today} /></label><label>Spedizione prevista<input name="ship_date" type="date" /></label></div>
				<label>Metodo di spedizione<select name="ship_method">{#each SHIPPING_METHODS as m (m)}<option>{m}</option>{/each}</select></label>
				<label>Pagamento<select name="payment">{#each PAYMENT_METHODS_MANUALI as m (m)}<option>{m}</option>{/each}</select></label>
			</div>
		</div>
		<div class="dcard">
			<h3>🧾 Riepilogo ordine</h3>
			<div class="sumrow"><span>Articoli</span><b>{items.length}</b></div>
			<div class="sumrow"><span>Quantità totale</span><b>{qtyTot.toLocaleString('it-IT')} pz</b></div>
			<div class="sumrow"><span>Totale imponibile</span><b>{money(net)}</b></div>
			<div class="sumrow"><span>IVA 22%{lordi ? ' (scorporata)' : ''}</span><b>{money(iva)}</b></div>
			<div class="sumrow sumrow--tot"><span>Totale</span><b>{money(tot)}</b></div>
			<p class="note" style="margin-top:8px">{lordi ? 'Prezzi lordi: IVA già inclusa, imponibile scorporato.' : 'Prezzi netti: IVA aggiunta al totale.'}</p>
		</div>
	</div>

	<div class="dcard" style="overflow-x:auto">
		<div class="toolbar" style="justify-content:space-between;margin-bottom:10px">
			<h3 style="margin:0">📦 Articoli dell’ordine</h3>
			<label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:700"><input type="checkbox" bind:checked={lordi} /> Inserisci prezzi lordi</label>
		</div>
		<table class="dtable">
			<thead><tr><th>Codice</th><th>Categoria</th><th>Descrizione (misura, materiale, finitura)</th><th>Q.tà</th><th>Prezzo unit.</th><th>Totale</th><th>Laminazione</th><th>Mockup</th><th></th></tr></thead>
			<tbody>
				{#each items as it, i (i)}
					<tr>
						<td><input type="text" maxlength="8" placeholder="es. ADR01" bind:value={it.code} style="max-width:100px;text-transform:uppercase" /></td>
						<td><span class="cat" class:cat--none={!catOf(it.code)}>{catOf(it.code) || 'Codice non riconosciuto'}</span></td>
						<td><input type="text" placeholder="es. 10×10 cm, PP lucido" bind:value={it.description} /></td>
						<td><input type="number" min="1" bind:value={it.qty} style="max-width:90px" /></td>
						<td><input type="number" min="0" step="0.01" bind:value={it.price} style="max-width:100px" /></td>
						<td><b>{money(Number(it.qty || 0) * Number(it.price || 0))}</b></td>
						<td><select bind:value={it.lamination}><option value="nessuna">Nessuna</option><option value="lucida">Lucida</option><option value="opaca">Opaca</option></select></td>
						<td>
							{#if it.mockup_url}<div style="display:flex;align-items:center;gap:6px"><img src={it.mockup_url} alt="" style="width:36px;height:36px;border-radius:8px;object-fit:cover" /><button type="button" class="link-btn" onclick={() => (it.mockup_url = null)}>✕</button></div>
							{:else}<label class="btn btn--ghost btn--xs" style="cursor:pointer">📎 Logo/mockup<input type="file" accept="image/*,.pdf" hidden onchange={(e) => mockup(i, e)} /></label>{/if}
						</td>
						<td><button type="button" class="ibtn" title="Rimuovi" onclick={() => (items = items.filter((_, k) => k !== i))}>🗑️</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => (items = [...items, { code: '', description: '', qty: 100, price: 0.35, lamination: 'nessuna', mockup_url: null }])}>+ Aggiungi articolo</button>
		<p class="note" style="margin-top:10px">Codici: <b>ADR</b> resinati · <b>STK</b> personalizzati · <b>STKR</b> rilievo · <b>STKF</b> fogli di adesivi · <b>EAT</b> etichette · <b>VET</b> vetrofanie · <b>CMP</b> campioni. Il codice decide la categoria di produzione.</p>
	</div>
</form>
