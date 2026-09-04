<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { COUNTRIES, money, dmy } from '$lib/dashboard/orders';
	import { paymentIcon, paymentLabel } from '$lib/dashboard/payments';
	let { data, form } = $props();
	const inv = $derived(data.inv);
	let editing = $state(false);
	let saving = $state(false);
	interface Line { description: string; qty: number; unit_net: number; ddt?: string | null; ddt_date?: string | null }
	interface Term { method: string; due: string; amount: number; xml_code: string }
	let e = $state({ issued_at: '', email: '', billing: {} as Record<string, string>, lines: [] as Line[], terms: [] as Term[], notes: '' });
	function startEdit() {
		e = { issued_at: inv.issued_at, email: inv.email ?? '', billing: { company: '', first_name: '', last_name: '', street: '', zip: '', city: '', province: '', country: 'IT', vat: '', fiscal_code: '', sdi: '', pec: '', ...(inv.billing ?? {}) }, lines: (inv.lines ?? []).map((l: Line) => ({ description: l.description, qty: Number(l.qty), unit_net: Number(l.unit_net), ddt: l.ddt ?? null, ddt_date: l.ddt_date ?? null })), terms: (inv.payment_terms ?? []).map((t: Term) => ({ method: t.method, due: t.due, amount: Number(t.amount), xml_code: t.xml_code ?? 'MP05' })), notes: inv.notes ?? '' };
		if (Number(inv.express_net) > 0) e.lines.push({ description: 'Produzione express (+30%)', qty: 1, unit_net: Number(inv.express_net) });
		editing = true;
	}
	const r2 = (v: number) => Math.round(v * 100) / 100;
	const sub = $derived(r2(e.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_net || 0), 0)));
	const vat = $derived(r2(sub * 0.22));
	const gross = $derived(r2(sub + vat));
	const ddtNumbers = $derived((inv.ddt_numbers?.length ? inv.ddt_numbers : inv.ddt_number ? [inv.ddt_number] : []) as string[]);
	const b = $derived(inv.billing ?? {});
	const who = $derived(b.company || `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim());
	const imponibile = $derived(Number(inv.subtotal_net) - Number(inv.discount_net) + Number(inv.express_net));
	function setMethod(i: number, name: string) { const m = data.methods.find((x) => x.name === name); e.terms[i].method = name; if (m) e.terms[i].xml_code = m.xml_code; }
	$effect(() => { if (form?.saved) { editing = false; invalidateAll(); } });
</script>

<svelte:head><title>Fattura {inv.number} | Dashboard</title></svelte:head>

<p class="lead" style="margin:0"><a class="link" href="/dashboard/fatturazione/fatture">← Torna alle fatture</a></p>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div>
		<h1>Fattura {inv.number}</h1>
		<p class="lead">{dmy(inv.issued_at)} · {who}{#if b.vat} · P.IVA {b.vat}{/if}</p>
		{#if data.locked}<p class="readonly-note">🔒 XML generato il {dmy(inv.xml_generated_at)}: la fattura è solo consultabile.</p>{/if}
		<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
			{#if !data.locked && !editing}<button type="button" class="btn btn--yellow btn--xs" onclick={startEdit}>✏️ Modifica</button>{/if}
			{#if data.pdf}<a class="btn btn--ghost btn--xs" href={data.pdf} target="_blank" rel="noopener">⬇ PDF</a>{/if}
			{#if !data.locked}<a class="btn btn--ghost btn--xs" href="/dashboard/fatturazione/fatture/xml?ids={inv.id}" target="_blank" rel="noopener" onclick={() => setTimeout(invalidateAll, 1500)}>📤 Genera XML</a>{/if}
		</div>
	</div>
	{#if !data.locked && !editing}<form method="POST" action="?/delete" use:enhance onsubmit={(ev) => { if (!confirm(`Eliminare la fattura ${inv.number}? I DDT collegati tornano da fatturare.`)) ev.preventDefault(); }}><button class="link-btn" type="submit" style="color:#b3261e">🗑️ Elimina fattura</button></form>{/if}
</div>

{#if editing}
	<form method="POST" action="?/save" class="editor" use:enhance={() => { saving = true; return async ({ update }) => { saving = false; await update({ reset: false }); }; }}>
		<input type="hidden" name="payload" value={JSON.stringify(e)} />
		<div class="grid3" style="grid-template-columns:1.2fr 1fr">
			<div class="dcard">
				<h3>👤 Intestatario</h3>
				<div class="dform dform--1">
					<label>Ragione sociale / azienda<input bind:value={e.billing.company} /></label>
					<div class="row2"><label>Nome<input bind:value={e.billing.first_name} /></label><label>Cognome<input bind:value={e.billing.last_name} /></label></div>
					<label>Indirizzo<input bind:value={e.billing.street} /></label>
					<div class="row3"><label>Comune<input bind:value={e.billing.city} /></label><label>CAP<input bind:value={e.billing.zip} /></label><label>Prov.<input bind:value={e.billing.province} maxlength="2" /></label></div>
					<label>Paese<select bind:value={e.billing.country}>{#each Object.entries(COUNTRIES) as [k, v] (k)}<option value={k}>{v.flag} {v.name}</option>{/each}</select></label>
					<div class="row2"><label>Partita IVA<input bind:value={e.billing.vat} /></label><label>Codice fiscale<input bind:value={e.billing.fiscal_code} /></label></div>
					<div class="row2"><label>Codice SDI<input bind:value={e.billing.sdi} maxlength="7" /></label><label>PEC<input bind:value={e.billing.pec} type="email" /></label></div>
					<label>Email<input bind:value={e.email} type="email" /></label>
				</div>
			</div>
			<div class="dcard">
				<h3>📄 Documento</h3>
				<div class="dform dform--1">
					<label>Data fattura<input type="date" bind:value={e.issued_at} /></label>
					<div class="sumrow"><span>Numero</span><b>{inv.number}</b></div>
					{#if ddtNumbers.length}<div class="sumrow"><span>DDT collegati</span><b>{ddtNumbers.join(', ')}</b></div>{/if}
					{#if inv.order_numbers?.length}<div class="sumrow"><span>Ordini</span><b>{inv.order_numbers.join(', ')}</b></div>{/if}
					<label>Note in fattura<textarea bind:value={e.notes} rows="3"></textarea></label>
				</div>
			</div>
		</div>
		<div class="dcard" style="overflow-x:auto">
			<h3>📦 Righe</h3>
			<table class="dtable">
				<thead><tr><th>Descrizione</th><th>DDT</th><th>Q.tà</th><th>Prezzo unit.</th><th style="text-align:right">Imponibile</th><th></th></tr></thead>
				<tbody>
					{#each e.lines as l, i (i)}
						<tr>
							<td><input type="text" bind:value={l.description} /></td>
							<td><span class="osub">{l.ddt ?? '—'}</span></td>
							<td><input type="number" min="1" bind:value={l.qty} style="max-width:100px" /></td>
							<td><input type="number" min="0" step="0.0001" bind:value={l.unit_net} style="max-width:120px" /></td>
							<td style="text-align:right"><b>{money(Number(l.qty || 0) * Number(l.unit_net || 0))}</b></td>
							<td><button type="button" class="ibtn" onclick={() => (e.lines = e.lines.filter((_, k) => k !== i))}>🗑️</button></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => (e.lines = [...e.lines, { description: '', qty: 1, unit_net: 0 }])}>+ Aggiungi riga</button>
		</div>
		<div class="dcard">
			<h3>🧾 Riepilogo</h3>
			<div class="riepilogo">
				<div>
					<div class="h4" style="margin-top:0">Scadenze di pagamento</div>
					<div class="terms">
						{#each e.terms as t, i (i)}
							<div class="term-row">
								<label>Metodo di pagamento<select value={t.method} onchange={(ev) => setMethod(i, (ev.currentTarget as HTMLSelectElement).value)}>{#if !data.methods.some((m) => m.name === t.method)}<option value={t.method}>{paymentLabel(t.method)}</option>{/if}{#each data.methods as m (m.id)}<option value={m.name}>{m.name}</option>{/each}</select></label>
								<label>Scadenza<input type="date" bind:value={t.due} /></label>
								<label>Importo €<input type="number" step="0.01" bind:value={t.amount} /></label>
								<button type="button" class="ibtn" onclick={() => (e.terms = e.terms.filter((_, k) => k !== i))}>🗑️</button>
							</div>
						{/each}
					</div>
					<button type="button" class="btn btn--ghost btn--xs" style="margin-top:10px" onclick={() => (e.terms = [...e.terms, { method: data.methods[0]?.name ?? 'Bonifico', due: e.issued_at, amount: r2(gross - e.terms.reduce((s, t) => s + Number(t.amount || 0), 0)), xml_code: data.methods[0]?.xml_code ?? 'MP05' }])}>＋ Suddividi pagamento</button>
					<span class="note" style="margin-left:10px">Rate: {money(e.terms.reduce((s, t) => s + Number(t.amount || 0), 0))} su {money(gross)}</span>
				</div>
				<div class="tot-box">
					<div class="sumrow"><span>Imponibile</span><b>{money(sub)}</b></div>
					<div class="sumrow"><span>IVA 22%</span><b>{money(vat)}</b></div>
					<div class="sumrow sumrow--tot"><span>Totale IVA inclusa</span><b>{money(gross)}</b></div>
				</div>
			</div>
		</div>
		<div class="editor-actions">
			<button type="button" class="btn btn--ghost btn--xs" onclick={() => (editing = false)}>Annulla</button>
			<button class="btn btn--green" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : '💾 Salva fattura e rigenera PDF'}</button>
		</div>
	</form>
{:else}
	<div class="grid3" style="grid-template-columns:1fr 1fr">
		<div class="dcard">
			<h3>👤 Intestatario</h3>
			<p class="small"><b>{who}</b><br />{[b.street, b.street2].filter(Boolean).join(', ')}<br />{[b.zip, b.city, b.province ? `(${b.province})` : ''].filter(Boolean).join(' ')}<br />{COUNTRIES[b.country]?.name ?? b.country ?? 'Italia'}<br />{#if b.vat}P.IVA {b.vat}<br />{/if}{#if b.fiscal_code}C.F. {b.fiscal_code}<br />{/if}{#if b.sdi}SDI {b.sdi}<br />{/if}{#if b.pec}PEC {b.pec}<br />{/if}{inv.email ?? ''}</p>
		</div>
		<div class="dcard">
			<h3>📄 Documento</h3>
			<div class="sumrow"><span>Numero · data</span><b>{inv.number} · {dmy(inv.issued_at)}</b></div>
			<div class="sumrow"><span>DDT collegati</span><b>{#if data.ddts.length}{#each data.ddts as d (d.id)}<a class="link" href="/dashboard/fatturazione/ddt/{d.id}/pdf" target="_blank">{d.number}</a> del {dmy(d.issued_at)}{' '}{/each}{:else if ddtNumbers.length}{ddtNumbers.join(', ')}{:else}—{/if}</b></div>
			{#if inv.order_numbers?.length}<div class="sumrow"><span>Ordini</span><b>{#if inv.checkout_group}<a class="link" href="/dashboard/fatturazione/ordini/{inv.checkout_group}">{inv.order_numbers.join(', ')}</a>{:else}{inv.order_numbers.join(', ')}{/if}</b></div>{/if}
			<div class="sumrow"><span>Pagamento</span><b>{#if paymentIcon(inv.payment_method)}<img src={paymentIcon(inv.payment_method)} alt="" style="height:16px;vertical-align:middle;margin-right:6px" />{/if}{paymentLabel(inv.payment_method)}{#if inv.paid_at} · pagata{/if}</b></div>
			{#if inv.sent_at}<div class="sumrow"><span>Inviata al cliente</span><b>{dmy(inv.sent_at)}</b></div>{/if}
			{#if inv.notes}<h4 class="h4">Note</h4><p class="small">{inv.notes}</p>{/if}
		</div>
	</div>
	<div class="dcard" style="overflow-x:auto">
		<h3>📦 Righe</h3>
		<table class="dtable">
			<thead><tr><th>Descrizione</th><th>DDT</th><th>Q.tà</th><th>Prezzo unit.</th><th style="text-align:right">Imponibile</th></tr></thead>
			<tbody>
				{#each inv.lines ?? [] as l, i (i)}<tr><td>{l.description}</td><td class="osub">{l.ddt ?? '—'}</td><td>{Number(l.qty).toLocaleString('it-IT')}</td><td>{money(Number(l.unit_net))}</td><td style="text-align:right"><b>{money(Number(l.total_net))}</b></td></tr>{/each}
				{#if Number(inv.express_net) > 0}<tr><td>Produzione express (+30%)</td><td></td><td>1</td><td>{money(Number(inv.express_net))}</td><td style="text-align:right"><b>{money(Number(inv.express_net))}</b></td></tr>{/if}
			</tbody>
		</table>
	</div>
	<div class="dcard">
		<h3>🧾 Riepilogo</h3>
		<div class="riepilogo">
			<div>
				<div class="h4" style="margin-top:0">Scadenze di pagamento</div>
				{#if inv.payment_terms?.length}
					<table class="dtable"><thead><tr><th>Metodo di pagamento</th><th>Scadenza</th><th style="text-align:right">Importo</th></tr></thead><tbody>{#each inv.payment_terms as t, i (i)}<tr><td>{paymentLabel(t.method)}</td><td>{dmy(t.due)}</td><td style="text-align:right"><b>{money(Number(t.amount))}</b></td></tr>{/each}</tbody></table>
				{:else}<p class="small">{paymentLabel(inv.payment_method)}</p>{/if}
			</div>
			<div class="tot-box">
				<div class="sumrow"><span>Imponibile</span><b>{money(imponibile)}</b></div>
				<div class="sumrow"><span>IVA 22%</span><b>{money(Number(inv.vat_amount))}</b></div>
				<div class="sumrow sumrow--tot"><span>Totale IVA inclusa</span><b>{money(Number(inv.amount_gross))}</b></div>
			</div>
		</div>
	</div>
{/if}
