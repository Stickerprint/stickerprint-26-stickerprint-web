<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { CATS, COUNTRIES, SHIPPING_METHODS, money } from '$lib/dashboard/orders';
	import { computeTerms, type PaymentMethod } from '$lib/dashboard/payments';
	import { categoryOf, draftTotals, emptyItem, splitAmounts, termsForMethod, type OrderDraft, type ProductCode } from '$lib/dashboard/orderDraft';

	export interface PickContact { id: string; kind: 'contact' | 'profile'; name: string; first_name: string; last_name: string; email: string; phone: string; street: string; city: string; zip: string; province: string; country: string; vat: string; fiscal_code: string; sdi: string; pec: string }
	let { draft, methods, codes, contacts, supabase, mode, form, title, oncancel }: { draft: OrderDraft; methods: PaymentMethod[]; codes: ProductCode[]; contacts: PickContact[]; supabase: SupabaseClient; mode: 'create' | 'edit'; form: Record<string, unknown> | null | undefined; title: string; oncancel?: () => void } = $props();

	// svelte-ignore state_referenced_locally
	let d = $state<OrderDraft>(structuredClone($state.snapshot(draft)));
	let saving = $state(false);
	let uploadMsg = $state('');
	let pick = $state('');
	let pickOpen = $state(false);
	let autoAmounts = $state(true);
	const tot = $derived(draftTotals(d));
	const lordi = $derived(d.price_type === 'lordi');
	const byId = $derived(new Map(methods.map((m) => [m.id, m])));
	const catOf = (code: string) => { const s = categoryOf(code, codes); return s ? CATS[s]?.name ?? s : ''; };
	const picks = $derived(pick.trim().length < 2 ? [] : contacts.filter((c) => `${c.name} ${c.email} ${c.vat}`.toLowerCase().includes(pick.trim().toLowerCase())).slice(0, 12));

	// prima scadenza: metodo di default
	$effect(() => { if (!d.terms.length && methods.length) d.terms = termsForMethod(methods[0], untrack(() => tot.tot), untrack(() => d.date)); });
	// finché non si tocca un importo, le rate seguono il totale in parti uguali
	$effect(() => {
		const total = tot.tot; const n = d.terms.length;
		if (!autoAmounts || !n) return;
		untrack(() => { const next = splitAmounts(d.terms, total); d.terms.forEach((t, i) => { if (t.amount !== next[i].amount) t.amount = next[i].amount; }); });
	});
	// contatto appena salvato in anagrafica
	$effect(() => { const id = form?.contactId as string | undefined; if (id) d.contact_id = id; });

	function choose(c: PickContact) {
		d.customer = { name: c.name, first_name: c.first_name, last_name: c.last_name, address: c.street, city: c.city, cap: c.zip, province: c.province, country: c.country || 'IT', piva: c.vat, cf: c.fiscal_code, sdi: c.sdi, pec: c.pec, email: c.email, phone: c.phone };
		d.contact_id = c.kind === 'contact' ? c.id : null;
		pick = ''; pickOpen = false;
	}
	function applyCode(i: number) {
		const it = d.items[i]; const c = (it.code ?? '').trim().toUpperCase();
		const p = codes.find((x) => x.code.toUpperCase() === c);
		if (!p) return;
		if (!it.description && p.description) it.description = p.description;
		if (p.unit_net != null) it.price = Number(p.unit_net);
	}
	function setMethod(i: number, id: string) {
		const m = byId.get(id); if (!m) return;
		if (m.installments > 1 && d.terms.length === 1) { d.terms = termsForMethod(m, tot.tot, d.date); return; }
		const t = d.terms[i]; t.method_id = m.id; t.method = m.name; t.xml_code = m.xml_code; t.due = m.custom ? d.date : computeTerms(m, tot.tot, d.date)[0].due;
	}
	function addTerm() {
		const last = d.terms[d.terms.length - 1]; const m = last ? byId.get(last.method_id) : methods[0];
		const due = last ? new Date(new Date(last.due).getTime() + 30 * 864e5).toISOString().slice(0, 10) : d.date;
		d.terms = [...d.terms, { method_id: m?.id ?? '', method: m?.name ?? '', xml_code: m?.xml_code ?? 'MP05', due, amount: 0 }];
	}
	async function mockup(i: number, e: Event) {
		const input = e.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
		uploadMsg = 'Caricamento…';
		const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
		const path = `staff/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
		const { error } = await supabase.storage.from('order-files').upload(path, file, { contentType: file.type });
		if (error) { uploadMsg = `Mockup non caricato: ${error.message}`; return; }
		const { data: signed } = await supabase.storage.from('order-files').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
		d.items[i].mockup_url = signed?.signedUrl ?? null; uploadMsg = ''; input.value = '';
	}
</script>

<form method="POST" action="?/save" class="editor" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; await update({ reset: false }); }; }}>
	<input type="hidden" name="payload" value={JSON.stringify(d)} />
	<datalist id="codes-list">{#each codes as c (c.id)}<option value={c.code}>{c.name}{c.description ? ' · ' + c.description : ''}</option>{/each}</datalist>
	<div class="toolbar" style="justify-content:space-between">
		<div><h1>{title}</h1><p class="lead">{mode === 'create' ? 'Ordine inserito a mano (telefono, email, fiera). Entra subito in produzione.' : 'Modifica tutto l’ordine: cliente, articoli, spedizione e scadenze.'}</p></div>
		<div style="display:flex;gap:8px">{#if oncancel}<button type="button" class="btn btn--ghost btn--xs" onclick={oncancel}>Annulla</button>{:else}<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/ordini">Annulla</a>{/if}</div>
	</div>
	{#if form?.error}<p class="error">{String(form.error)}</p>{/if}
	{#if form?.contactMsg}<p class="success">{String(form.contactMsg)}</p>{/if}
	{#if uploadMsg}<p class="error">{uploadMsg}</p>{/if}

	<div class="grid3" style="grid-template-columns:1.2fr 1fr">
		<div class="dcard">
			<h3>👤 Cliente <button class="btn btn--ghost btn--xs" type="submit" formaction="?/contact" title="Salva o aggiorna questo cliente in Anagrafica">{d.contact_id ? '🔄 Aggiorna anagrafica' : '＋ Salva in anagrafica'}</button></h3>
			<div class="dform dform--1">
				<div class="pick">
					<input type="text" placeholder="🔍 Cerca in anagrafica (nome, email, P.IVA)…" bind:value={pick} onfocus={() => (pickOpen = true)} oninput={() => (pickOpen = true)} style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:14px" />
					{#if pickOpen && picks.length}<div class="pick__list">{#each picks as c (c.kind + c.id)}<button type="button" onclick={() => choose(c)}><b>{c.name}</b> <span class="osub" style="display:inline">{c.email}{c.vat ? ' · P.IVA ' + c.vat : ''}{c.kind === 'profile' ? ' · registrato' : ''}</span></button>{/each}</div>{/if}
				</div>
				<label>Cliente / ragione sociale<input bind:value={d.customer.name} required placeholder="Nome e cognome o azienda" /></label>
				<div class="row2"><label>Nome<input bind:value={d.customer.first_name} /></label><label>Cognome<input bind:value={d.customer.last_name} /></label></div>
				<label>Indirizzo<input bind:value={d.customer.address} placeholder="Via, civico" /></label>
				<div class="row3"><label>Comune<input bind:value={d.customer.city} /></label><label>CAP<input bind:value={d.customer.cap} /></label><label>Prov.<input bind:value={d.customer.province} maxlength="2" /></label></div>
				<label>Paese<select bind:value={d.customer.country}>{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k}>{v.flag} {v.name}</option>{/each}</select></label>
				<div class="row2"><label>Partita IVA<input bind:value={d.customer.piva} /></label><label>Codice fiscale<input bind:value={d.customer.cf} /></label></div>
				<div class="row2"><label>Codice SDI<input bind:value={d.customer.sdi} maxlength="7" /></label><label>PEC<input bind:value={d.customer.pec} type="email" /></label></div>
				<div class="row2"><label>Email<input bind:value={d.customer.email} type="email" /></label><label>Telefono<input bind:value={d.customer.phone} /></label></div>
			</div>
		</div>
		<div class="dcard">
			<h3>📅 Ordine e spedizione</h3>
			<div class="dform dform--1">
				<div class="row2"><label>Data ordine<input type="date" bind:value={d.date} /></label><label>Spedizione prevista<input type="date" bind:value={d.ship_date} /></label></div>
				<label>Metodo di spedizione<select bind:value={d.ship_method}>{#each SHIPPING_METHODS as m (m)}<option>{m}</option>{/each}</select></label>
				<label style="display:flex;gap:8px;align-items:center;flex-direction:row"><input type="checkbox" bind:checked={d.ship_same} /> Spedizione uguale all’indirizzo di fatturazione</label>
				{#if !d.ship_same}
					<label>Destinatario<input bind:value={d.shipping.name} /></label>
					<label>Indirizzo<input bind:value={d.shipping.address} /></label>
					<div class="row3"><label>Comune<input bind:value={d.shipping.city} /></label><label>CAP<input bind:value={d.shipping.cap} /></label><label>Prov.<input bind:value={d.shipping.province} maxlength="2" /></label></div>
					<label>Paese<select bind:value={d.shipping.country}>{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k}>{v.flag} {v.name}</option>{/each}</select></label>
				{/if}
				<label>Note interne<textarea bind:value={d.notes} rows="3"></textarea></label>
			</div>
		</div>
	</div>

	<div class="dcard" style="overflow-x:auto">
		<h3>📦 Articoli <label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:700"><input type="checkbox" checked={lordi} onchange={(e) => (d.price_type = (e.currentTarget as HTMLInputElement).checked ? 'lordi' : 'netti')} /> Inserisci prezzi lordi (IVA inclusa)</label></h3>
		<table class="dtable">
			<thead><tr><th>Codice</th><th>Categoria</th><th>Descrizione (misura, materiale, finitura)</th><th>Q.tà</th><th>Prezzo unit.</th><th>Totale</th><th>Laminazione</th><th>Mockup</th><th></th></tr></thead>
			<tbody>
				{#each d.items as it, i (i)}
					<tr>
						<td><input type="text" list="codes-list" maxlength="12" placeholder="es. ADR01" bind:value={it.code} onchange={() => applyCode(i)} style="max-width:110px;text-transform:uppercase" />{#if it.number}<div class="osub">{it.number}</div>{/if}</td>
						<td><span class="cat" class:cat--none={!catOf(it.code)}>{catOf(it.code) || 'Codice non riconosciuto'}</span></td>
						<td><input type="text" placeholder="es. 10×10 cm, PP lucido" bind:value={it.description} /></td>
						<td><input type="number" min="1" bind:value={it.qty} style="max-width:90px" /></td>
						<td><input type="number" min="0" step="0.0001" bind:value={it.price} style="max-width:110px" /></td>
						<td><b>{money(Number(it.qty || 0) * Number(it.price || 0))}</b></td>
						<td><select bind:value={it.lamination}><option value="nessuna">Nessuna</option><option value="lucida">Lucida</option><option value="opaca">Opaca</option></select></td>
						<td>
							{#if it.mockup_url || it.preview_url}<div style="display:flex;align-items:center;gap:6px"><img src={it.mockup_url ?? it.preview_url} alt="" style="width:44px;height:44px;border-radius:8px;object-fit:cover;background:#f4f5fa" />{#if it.mockup_url}<button type="button" class="link-btn" onclick={() => (it.mockup_url = null)}>✕</button>{/if}</div>
							{:else}<label class="btn btn--ghost btn--xs" style="cursor:pointer">📎 Mockup<input type="file" accept="image/*,.pdf" hidden onchange={(e) => mockup(i, e)} /></label>{/if}
						</td>
						<td><button type="button" class="ibtn" title="Rimuovi" onclick={() => (d.items = d.items.filter((_, k) => k !== i))}>🗑️</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => (d.items = [...d.items, emptyItem()])}>+ Aggiungi articolo</button>
		<p class="note" style="margin-top:10px">Codici: <b>ADR</b> resinati · <b>STK</b> personalizzati · <b>STKR</b> rilievo · <b>STKF</b> fogli · <b>EAT</b> etichette · <b>VET</b> vetrofanie · <b>CMP</b> campioni. I codici completi (Setup → Codici prodotto) portano descrizione e prezzo.</p>
	</div>

	<div class="dcard">
		<h3>🧾 Riepilogo <span class="note">Compare nella conferma d'ordine in PDF</span></h3>
		<div class="riepilogo">
			<div>
				<div class="h4" style="margin-top:0">Scadenze di pagamento</div>
				<div class="terms">
					{#each d.terms as t, i (i)}
						<div class="term-row">
							<label>Metodo di pagamento<select value={t.method_id} onchange={(e) => setMethod(i, (e.currentTarget as HTMLSelectElement).value)}>{#each methods as m (m.id)}<option value={m.id}>{m.name}</option>{/each}</select></label>
							<label>Scadenza<input type="date" bind:value={t.due} /></label>
							<label>Importo €<input type="number" step="0.01" min="0" bind:value={t.amount} oninput={() => (autoAmounts = false)} /></label>
							<button type="button" class="ibtn" title="Togli rata" disabled={d.terms.length === 1} onclick={() => (d.terms = d.terms.filter((_, k) => k !== i))}>🗑️</button>
						</div>
					{/each}
				</div>
				<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={addTerm}>＋ Suddividi pagamento</button>
				{#if !autoAmounts}<span class="note" style="margin-left:10px">Rate: {money(d.terms.reduce((s, t) => s + Number(t.amount || 0), 0))} su {money(tot.tot)} <button type="button" class="link-btn" onclick={() => (autoAmounts = true)}>ripartisci in parti uguali</button></span>{/if}
			</div>
			<div class="tot-box">
				<div class="sumrow"><span>Articoli · quantità</span><b>{d.items.length} · {tot.qty.toLocaleString('it-IT')} pz</b></div>
				<div class="sumrow"><span>Imponibile</span><b>{money(tot.net)}</b></div>
				<div class="sumrow"><span>IVA 22%{lordi ? ' (scorporata)' : ''}</span><b>{money(tot.iva)}</b></div>
				<div class="sumrow sumrow--tot"><span>Totale IVA inclusa</span><b>{money(tot.tot)}</b></div>
			</div>
		</div>
	</div>

	<div class="editor-actions">
		{#if saving}<span class="note">Salvataggio…</span>{/if}
		<button class="btn btn--blue" type="submit" formaction="?/confirm" disabled={saving || !d.customer.email} title={d.customer.email ? '' : 'Inserisci l’email del cliente'}>✉️ Invia conferma per email</button>
		<button class="btn btn--green" type="submit" formaction="?/save" disabled={saving}>💾 Salva ordine</button>
	</div>
</form>
