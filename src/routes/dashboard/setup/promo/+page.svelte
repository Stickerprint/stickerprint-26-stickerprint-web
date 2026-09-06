<script lang="ts">
	import { enhance } from '$app/forms';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	import type { Promo } from '$lib/server/promos';
	import { PROMO_ENGINES } from '$lib/pricing/promoEngines';
	let { data, form } = $props();
	let editing = $state<string | 'new' | null>(null);
	const vuota: Promo = { id: '', active: true, sort: 0, qty: 250, product_slug: 'adesivi_personalizzati', product_label: 'adesivi personalizzati', price: 79, price_normal: null, subtitle: '', ends_at: null, forma: 'sagomato', materiale: 'bianco', finitura: 'lucida', chips: [], includes: [], perks: [], save_text: '', sizes: [], cta: 'Carica il file per continuare', w: 50, h: 50 };
	let prodSel = $state('adesivi_personalizzati');
	const opz = $derived(data.opzioni[prodSel] ?? { materials: [], finishes: [] });
	const lines = (l: object[], a: string, b: string) => l.map((i) => { const r = i as Record<string, unknown>; return `${r[a] ?? ''} | ${r[b] ?? ''}`; }).join('\n');
	const dateInput = (d: string | null) => (d ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(d)) : '');
	const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }) : '—');
	const eur = (v: number | null) => (v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' €');
</script>

<svelte:head><title>Offerte | Dashboard Stickerprint</title></svelte:head>

<div>
	<h1>Offerte (pagina Promo)</h1>
	<p class="lead">Quello che scrivi qui compare subito su <a href="/offerte" target="_blank">stickerprint.it/offerte</a>. La prima offerta attiva è quella in evidenza; le altre compaiono come riquadri sotto.</p>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Salvato: l'offerta è già online.</p>{/if}

{#snippet editor(p: Promo)}
	<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { await update(); editing = null; }} class="dform">
		<input type="hidden" name="id" value={p.id} />
		<label>Pezzi<input name="qty" type="number" min="1" required value={p.qty} /></label>
		<label>Prezzo offerta (€, IVA inclusa)<input name="price" type="number" step="0.01" min="0.01" required value={p.price} /></label>
		<label>Prezzo di listino (€)<input name="price_normal" type="number" step="0.01" min="0" value={p.price_normal ?? ''} /></label>
		<label>Scade il<input name="ends_at" type="date" value={dateInput(p.ends_at)} /></label>
		<label>Prodotto (motore <b>{PROMO_ENGINES[prodSel] ?? '—'}</b>)<select name="product_slug" bind:value={prodSel}>{#each PRODUCT_ENGINES as e (e.slug)}<option value={e.slug}>{e.name}</option>{/each}</select></label>
		<label>Nome nel titolo<input name="product_label" value={p.product_label} placeholder="adesivi personalizzati" /></label>
		<label>Sagoma<select name="forma">{#each ['sagomato', 'tondo', 'quadrato', 'ovale', 'rettangolo'] as s (s)}<option value={s} selected={s === p.forma}>{s}</option>{/each}</select></label>
		<label>Materiale (fisso, lo vede il cliente)<select name="materiale">{#each opz.materials as m (m.id)}<option value={m.id} selected={m.id === p.materiale}>{m.label}</option>{/each}</select></label>
		<label>Finitura (fissa)<select name="finitura"><option value="">Nessuna / non prevista</option>{#each opz.finishes as f (f.id)}<option value={f.id} selected={f.id === p.finitura}>{f.label}</option>{/each}</select></label>
		<label>Larghezza (mm)<input name="w_mm" type="number" step="0.5" min="5" value={p.w} /></label>
		<label>Altezza (mm)<input name="h_mm" type="number" step="0.5" min="5" value={p.h} /></label>
		<label style="grid-column:1/-1">Sottotitolo<input name="subtitle" value={p.subtitle ?? ''} placeholder="Per un periodo limitato: 250 adesivi a soli 79 €" /></label>
		<label>Etichette colorate (una per riga)<textarea name="chips" rows="3">{p.chips.join('\n')}</textarea></label>
		<label>Cosa ricevi (riga: voce | normalmente)<textarea name="includes" rows="4">{lines(p.includes, 'label', 'normally')}</textarea></label>
		<label>Come risparmi tempo (riga: voce | risparmio)<textarea name="perks" rows="4">{lines(p.perks, 'label', 'saves')}</textarea></label>
		<label>Riga "Risparmi"<input name="save_text" value={p.save_text ?? ''} placeholder="8-10 giorni e 92 €" /></label>
		<label>Testo del bottone<input name="cta" value={p.cta} /></label>
		<label>Ordine (0 = prima)<input name="sort" type="number" value={p.sort} /></label>
		<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="active" checked={p.active} /> Attiva</label>
		<div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn btn--blue btn--sm" type="submit">Salva</button><button class="btn btn--ghost btn--sm" type="button" onclick={() => (editing = null)}>Annulla</button></div>
	</form>
{/snippet}

<div class="dcard">
	{#if editing === 'new'}
		<h3>Nuova offerta</h3>
		{@render editor(vuota)}
	{:else}
		<button class="btn btn--blue btn--sm" type="button" onclick={() => { prodSel = 'adesivi_personalizzati'; editing = 'new'; }}>+ Nuova offerta</button>
	{/if}
</div>

<div class="dcard" style="overflow-x:auto">
	<h3>Offerte ({data.promos.length})</h3>
	{#if data.promos.length === 0}
		<p style="color:var(--muted)">Nessuna offerta. Se la tabella manca, esegui la migrazione 0025_promos.sql.</p>
	{:else}
		<table class="dtable">
			<thead><tr><th>Offerta</th><th>Prezzo</th><th>Scade</th><th>Misura · materiale</th><th>Stato</th><th></th></tr></thead>
			<tbody>
				{#each data.promos as p (p.id)}
					<tr>
						<td><b>{p.qty} {p.product_label}</b>{#if p.subtitle}<br /><small style="color:var(--muted)">{p.subtitle}</small>{/if}</td>
						<td>{eur(p.price)}{#if p.price_normal}<br /><small style="color:var(--muted)">listino {eur(p.price_normal)}</small>{/if}</td>
						<td>{fmtDate(p.ends_at)}</td>
						<td>{p.w} × {p.h} mm · {p.materiale}{#if p.finitura} · {p.finitura}{/if}<br /><small style="color:var(--muted)">motore {PROMO_ENGINES[p.product_slug] ?? '—'}</small></td>
						<td>{#if p.active}<span class="pill pill--on">Attiva</span>{:else}<span class="pill pill--off">Spenta</span>{/if}</td>
						<td style="white-space:nowrap">
							<button class="btn btn--ghost btn--xs" type="button" onclick={() => { if (editing === p.id) editing = null; else { prodSel = p.product_slug; editing = p.id; } }}>Modifica</button>
							<form method="POST" action="?/toggle" use:enhance style="display:inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} /><button class="btn btn--ghost btn--xs" type="submit">{p.active ? 'Spegni' : 'Attiva'}</button></form>
							<form method="POST" action="?/delete" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm('Eliminare questa offerta?')) e.preventDefault(); }}><input type="hidden" name="id" value={p.id} /><button class="btn btn--ghost btn--xs" type="submit">Elimina</button></form>
						</td>
					</tr>
					{#if editing === p.id}
						<tr><td colspan="6">{@render editor(p)}</td></tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</div>
