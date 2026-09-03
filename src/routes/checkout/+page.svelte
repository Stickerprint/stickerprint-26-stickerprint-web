<script lang="ts">
	import '$lib/styles/checkout.css';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { readCart, removeFromCart, updateCartItem, clearCart, type CartItem } from '$lib/cart';
	import { getCartFile, deleteCartFile } from '$lib/utils/draftStore';
	import { PROVINCES } from '$lib/provinces';
	import { MATERIAL_LABEL, eur, fmtMm } from '$lib/account';

	let { data, form } = $props();
	let items = $state<CartItem[]>([]);
	let thumbs = $state<Record<string, string>>({});
	let hasFile = $state<Record<string, boolean>>({});
	let loaded = $state(false);
	let noteOpen = $state<string | null>(null);

	// form (valori iniziali dal profilo)
	// svelte-ignore state_referenced_locally
	const p = data.profile;
	// svelte-ignore state_referenced_locally
	const addr = data.addresses.find((a) => a.kind === 'shipping') ?? null;
	const [fn, ...ln] = (p?.full_name ?? '').split(' ');
	let sameBilling = $state(true);
	let saveAddress = $state(!addr);
	let express = $state(false);
	let useCredit = $state(false);
	let payment = $state('test');
	let code = $state('');
	let discount = $state<{ code: string; amount: number; description: string | null } | null>(null);
	let codeMsg = $state('');
	let submitting = $state(false);
	let err = $state('');
	let itemsJson = $state('[]');
	let ready = false;
	let formEl = $state<HTMLFormElement | undefined>();

	const VAT = 1.22;
	const subtotalNet = $derived(items.reduce((a, i) => a + i.net, 0));
	const subtotalGross = $derived(items.reduce((a, i) => a + i.gross, 0));
	const discountAmt = $derived(discount ? Math.min(discount.amount, subtotalNet) : 0);
	const expressNet = $derived(express ? data.expressNet : 0);
	const totalNet = $derived(Math.max(0, subtotalNet - discountAmt) + expressNet);
	const totalGross = $derived(Math.round(totalNet * VAT * 100) / 100);
	const creditUsed = $derived(useCredit ? Math.min(data.credit, totalGross) : 0);
	const toPay = $derived(Math.round((totalGross - creditUsed) * 100) / 100);
	const vatAmount = $derived(totalGross - totalNet);
	const allFiles = $derived(items.every((i) => hasFile[i.id] || !!i.filePath));

	onMount(async () => {
		items = readCart();
		for (const it of items) {
			const f = await getCartFile(it.id);
			hasFile[it.id] = !!f;
			if (f && f.type.startsWith('image/')) thumbs[it.id] = URL.createObjectURL(f);
		}
		loaded = true;
	});
	function remove(id: string) {
		items = removeFromCart(id);
		deleteCartFile(id);
	}
	async function applyCode() {
		codeMsg = '';
		const r = await fetch('/api/discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, subtotalNet }) }).then((r) => r.json());
		if (r.ok) { discount = r; codeMsg = `Codice ${r.code} applicato: −${eur(r.amount)}${r.description ? ' · ' + r.description : ''}`; }
		else { discount = null; codeMsg = r.error; }
	}
	async function reupload(id: string, e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const { saveCartFile } = await import('$lib/utils/draftStore');
		await saveCartFile(id, file);
		hasFile[id] = true;
		if (file.type.startsWith('image/')) thumbs[id] = URL.createObjectURL(file);
		items = updateCartItem(id, { fileName: file.name });
	}
	// prima carica i file su Storage, poi invia l'ordine
	async function onSubmit(e: SubmitEvent) {
		if (ready) return;
		e.preventDefault();
		err = '';
		if (!data.user) { err = 'Accedi per completare l’ordine.'; return; }
		if (!allFiles) { err = 'Manca il file di un prodotto.'; return; }
		submitting = true;
		try {
			const lines = [];
			for (const it of items) {
				let filePath = it.filePath ?? null;
				const f = await getCartFile(it.id);
				if (f) {
					const ext = (f.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
					const path = `${data.user.id}/${it.id}.${ext}`;
					const { error } = await data.supabase.storage.from('order-files').upload(path, f, { contentType: f.type || undefined, upsert: true });
					if (error) throw new Error(`File non caricato (${f.name}): ${error.message}`);
					filePath = path;
				}
				lines.push({ id: it.id, product: it.product, forma: it.forma, materiale: it.materiale, finitura: it.finitura, w: it.w, h: it.h, qty: it.qty, filePath, fileName: it.fileName ?? null, note: it.note, reorderOf: it.reorderOf ?? null });
			}
			itemsJson = JSON.stringify(lines);
			ready = true;
			await tick();
			formEl?.requestSubmit();
		} catch (ex) {
			err = ex instanceof Error ? ex.message : 'Errore durante l’invio.';
			submitting = false;
		}
	}
	$effect(() => {
		if (form?.ok && form.numbers) {
			for (const it of readCart()) deleteCartFile(it.id);
			clearCart();
			goto(`/checkout/grazie?n=${encodeURIComponent(form.numbers.join(','))}`);
		}
		if (form?.error) { submitting = false; ready = false; }
	});
</script>

<svelte:head><title>Checkout | Stickerprint</title></svelte:head>

<section class="section container">
	<h1 class="center" style="font-size:clamp(30px,4vw,44px)">Checkout</h1>

	{#if loaded && items.length === 0}
		<div class="co-empty">
			<p class="lead">Il tuo carrello è vuoto.</p>
			<a class="btn btn--green btn--lg" href="/prodotti">Scegli un prodotto</a>
		</div>
	{:else}
		<form class="co" method="POST" action="?/order" bind:this={formEl} onsubmit={onSubmit} use:enhance>
			<input type="hidden" name="items" value={itemsJson} />
			<input type="hidden" name="same_billing" value={sameBilling ? 'on' : 'off'} />

			<!-- SINISTRA: dati -->
			<div class="co__left">
				{#if !data.user}
					<div class="co-login">
						<h2>Accedi per completare l’ordine</h2>
						<p class="lead">Con l’account trovi prove di stampa, fatture e Credito Stickerprint. Il carrello resta salvato.</p>
						<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn btn--green" href="/login?next=/checkout">Accedi</a><a class="btn btn--ghost" href="/signup?next=/checkout">Crea un account</a></div>
					</div>
				{/if}

				<h2>Dati di spedizione</h2>
				<div class="co-grid">
					<label>Nome <i>obbligatorio</i><input name="first_name" required value={addr?.first_name ?? fn ?? ''} /></label>
					<label>Cognome <i>obbligatorio</i><input name="last_name" required value={addr?.last_name ?? ln.join(' ')} /></label>
					<label class="full">Indirizzo email <i>obbligatorio</i><input type="email" value={data.user?.email ?? ''} readonly={!!data.user} /><small>{#if data.user}Stai ordinando come <b>{data.user.email}</b>. Per usare un’altra email, esci dall’account.{/if}</small></label>
					<label class="full">Indirizzo <i>obbligatorio</i><input name="street" required value={addr?.street ?? ''} /></label>
					<label class="full"><span class="sr-only">Dettagli indirizzo</span><input name="street2" placeholder="Appartamento, scala, piano, ecc." /></label>
					<label>Città <i>obbligatorio</i><input name="city" required value={addr?.city ?? ''} /></label>
					<label>CAP <i>obbligatorio</i><input name="zip" required inputmode="numeric" value={addr?.zip ?? ''} /></label>
					<label>Provincia <i>obbligatorio</i>
						<select name="province" required>
							<option value="">Seleziona</option>
							{#each PROVINCES as [sigla, nome] (sigla)}<option value={sigla} selected={addr?.province === sigla}>{nome}</option>{/each}
						</select>
					</label>
					<label>Telefono <i>obbligatorio</i><input name="phone" type="tel" required value={addr?.phone ?? p?.phone ?? ''} /></label>
					<label>Codice fiscale <i>obbligatorio</i><input name="fiscal_code" value={p?.fiscal_code ?? ''} /></label>
					<label>Nome azienda <i>facoltativo</i><input name="company" value={p?.company_name ?? ''} /></label>
					<label>Partita IVA <i>facoltativo</i><input name="vat" value={p?.vat_number ?? ''} /></label>
					<label>Codice univoco (SDI) <i>facoltativo</i><input name="sdi" maxlength="7" value={p?.sdi_code ?? ''} /></label>
				</div>
				<label class="co-check"><input type="checkbox" bind:checked={sameBilling} /> Indirizzo di fatturazione uguale all’indirizzo di spedizione</label>
				{#if !sameBilling}
					<h3 style="margin-top:10px">Indirizzo di fatturazione</h3>
					<div class="co-grid">
						<label>Nome<input name="b_first_name" /></label>
						<label>Cognome<input name="b_last_name" /></label>
						<label class="full">Indirizzo<input name="b_street" /></label>
						<label class="full"><span class="sr-only">Dettagli</span><input name="b_street2" placeholder="Appartamento, scala, piano, ecc." /></label>
						<label>Città<input name="b_city" /></label>
						<label>CAP<input name="b_zip" /></label>
						<label>Provincia<select name="b_province"><option value="">Seleziona</option>{#each PROVINCES as [sigla, nome] (sigla)}<option value={sigla}>{nome}</option>{/each}</select></label>
					</div>
				{/if}
				<label class="co-check"><input type="checkbox" name="save_address" bind:checked={saveAddress} /> Salva questo indirizzo per i prossimi ordini</label>

				<h2 style="margin-top:28px">Metodo di pagamento</h2>
				<div class="co-pay">
					<label class="co-pay__opt is-soon"><input type="radio" name="payment" value="card" disabled /><span><b>Carta di credito</b><small>Disponibile a breve</small></span><img src="/icons/footer/visa.webp" alt="" /></label>
					<label class="co-pay__opt is-soon"><input type="radio" name="payment" value="paypal" disabled /><span><b>PayPal</b><small>Disponibile a breve</small></span><img src="/icons/footer/paypal.webp" alt="" /></label>
					<label class="co-pay__opt"><input type="radio" name="payment" value="test" bind:group={payment} /><span><b>Test (gratuito)</b><small>Crea l’ordine senza pagamento reale</small></span></label>
				</div>
				<p class="co-secure"><b>🔒 Sistema di pagamento sicuro.</b> Il pagamento verrà addebitato solo dopo che avrai approvato la prova di stampa. Ora registriamo solo i tuoi dati in sicurezza.</p>

				{#if err || form?.error}<p class="error" style="margin-top:14px">{err || form?.error}</p>{/if}
				<button class="btn btn--green btn--lg co-submit" type="submit" disabled={submitting || !data.user || !allFiles || items.length === 0}>{submitting ? 'Invio in corso…' : 'Invia il tuo ordine'}</button>
				<p class="note" style="margin-top:8px">Cliccando su Invia il tuo ordine, accetti la <a class="link" href="/privacy">privacy policy</a> e i <a class="link" href="/termini">termini e condizioni</a> di Stickerprint.</p>
			</div>

			<!-- DESTRA: riepilogo -->
			<aside class="co__right">
				<div class="co-box">
					<h2>Il tuo ordine</h2>
					{#each items as it (it.id)}
						<div class="co-item">
							<div class="co-item__thumb">{#if thumbs[it.id]}<img src={thumbs[it.id]} alt="" />{:else}<img src="/images/estimator/round_stickers.webp" alt="" />{/if}</div>
							<div class="co-item__body">
								<div class="co-item__top"><b>{it.qty.toLocaleString('it-IT')} {it.productName} {it.forma}</b><span class="co-item__price">{eur(it.gross)}</span><button type="button" class="co-item__x" aria-label="Rimuovi" onclick={() => remove(it.id)}>✕</button></div>
								<small>Misura: {fmtMm(it.w)} × {fmtMm(it.h)} mm · {MATERIAL_LABEL[it.materiale] ?? it.materiale}{#if it.finitura && it.finitura !== 'nessuna'} · lamina {it.finitura}{/if}</small>
								<small>File: {#if hasFile[it.id] || it.filePath}{it.fileName ?? 'file caricato'}{:else}<span class="err">mancante</span> <label class="link" style="cursor:pointer">carica<input type="file" hidden accept="image/*,.pdf,.svg,.ai,.eps" onchange={(e) => reupload(it.id, e)} /></label>{/if}</small>
								{#if noteOpen === it.id}
									<textarea rows="2" placeholder="Note per questo prodotto" value={it.note ?? ''} onchange={(e) => (items = updateCartItem(it.id, { note: (e.currentTarget as HTMLTextAreaElement).value }))}></textarea>
								{:else}
									<button type="button" class="link-btn" onclick={() => (noteOpen = it.id)}>{it.note ? 'Modifica note' : 'Aggiungi note'}</button>
								{/if}
							</div>
						</div>
					{/each}
					<div class="co-row"><span>Prova di stampa</span><b>Gratis</b></div>
					<div class="co-ship">🚚 Pronti per la spedizione il <b>{express ? data.expressDate : data.shipDate}</b></div>

					<label class="co-code__label" for="code">Hai un codice sconto o un codice referral da utilizzare?</label>
					<div class="co-code"><input id="code" placeholder="Inserisci codice" bind:value={code} /><button type="button" class="btn btn--blue btn--xs" onclick={applyCode} disabled={!code}>Applica</button></div>
					{#if codeMsg}<small class:err={!discount}>{codeMsg}</small>{/if}
					<input type="hidden" name="discount_code" value={discount?.code ?? ''} />

					{#if data.user && data.credit > 0}
						<label class="co-credit"><input type="checkbox" name="use_credit" bind:checked={useCredit} /><img src="/images/coin-sp.png" alt="" /><span>Usa il tuo Credito Stickerprint <b>{eur(data.credit)}</b></span></label>
					{/if}

					<div class="co-totals">
						<div class="co-row"><span>Subtotale</span><span>{eur(subtotalGross)}</span></div>
						{#if discountAmt > 0}<div class="co-row"><span>Sconto {discount?.code}</span><span>−{eur(discountAmt * VAT)}</span></div>{/if}
						{#if express}<div class="co-row"><span>Produzione express</span><span>{eur(expressNet * VAT)}</span></div>{/if}
						<div class="co-row"><span>Spedizione</span><span>Gratuita</span></div>
						{#if creditUsed > 0}<div class="co-row"><span>Credito Stickerprint</span><span>−{eur(creditUsed)}</span></div>{/if}
						<div class="co-row co-row--total"><span>Totale:</span><span>{eur(toPay)}</span></div>
						<small class="center">IVA {eur(vatAmount)} inclusa</small>
					</div>
				</div>

				<div class="co-box co-express">
					<h3>Produzione express</h3>
					<p>Salti la coda di produzione. Spediamo i tuoi adesivi 2 giorni prima rispetto alla data standard.</p>
					<label class="co-check"><input type="checkbox" name="express" bind:checked={express} /> Sì, li voglio prima <b>(+{eur(data.expressNet * VAT)})</b></label>
				</div>
			</aside>
		</form>
	{/if}
</section>
