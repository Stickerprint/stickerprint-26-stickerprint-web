<script lang="ts">
	import { enhance } from '$app/forms';
	import { PRODUCT_ENGINES } from '$lib/pricing/engine';
	import type { FaqCategory, FaqItem } from '$lib/server/faq';
	let { data, form } = $props();
	let cur = $state(0);
	let editCat = $state<string | 'new' | null>(null);
	let editItem = $state<string | 'new' | null>(null);
	const cats = $derived(data.categories as FaqCategory[]);
	const cat = $derived(cats[cur] ?? null);
	const PRODOTTI = [...PRODUCT_ENGINES, { slug: 'fogli_adesivi', name: 'Fogli di adesivi' }, { slug: 'vetrofanie', name: 'Vetrofanie' }].filter((p, i, a) => a.findIndex((x) => x.slug === p.slug) === i);
	const chiudi = () => async ({ update }: { update: () => Promise<void> }) => { await update(); editCat = null; editItem = null; };
</script>

<svelte:head><title>Domande frequenti | Dashboard Stickerprint</title></svelte:head>

<div>
	<h1>Domande frequenti</h1>
	<p class="lead">Categorie e domande della pagina <a href="/support" target="_blank">Supporto</a>. Una categoria collegata a un prodotto compare anche in fondo alla pagina di quel prodotto.</p>
</div>

{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok}<p class="success">Salvato: è già online.</p>{/if}

{#snippet catForm(c: FaqCategory | null)}
	<form method="POST" action="?/saveCategory" use:enhance={chiudi} class="dform">
		<input type="hidden" name="id" value={c?.id ?? ''} />
		<label>Nome<input name="name" required value={c?.name ?? ''} placeholder="Es. Spedizioni" /></label>
		<label>Slug (facoltativo)<input name="slug" value={c?.slug ?? ''} placeholder="spedizioni" /></label>
		<label>Prodotto collegato<select name="product_slug"><option value="">Nessuno (solo Supporto)</option>{#each PRODOTTI as p (p.slug)}<option value={p.slug} selected={c?.product_slug === p.slug}>{p.name}</option>{/each}</select></label>
		<label>Ordine<input name="sort" type="number" value={c?.sort ?? 0} /></label>
		<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="active" checked={c?.active ?? true} /> Visibile</label>
		<div style="display:flex;gap:8px"><button class="btn btn--blue btn--sm" type="submit">Salva</button><button class="btn btn--ghost btn--sm" type="button" onclick={() => (editCat = null)}>Annulla</button></div>
	</form>
{/snippet}

{#snippet itemForm(it: FaqItem | null)}
	<form method="POST" action="?/saveItem" use:enhance={chiudi} class="dform">
		<input type="hidden" name="id" value={it?.id ?? ''} />
		<input type="hidden" name="category_id" value={cat?.id ?? ''} />
		<label style="grid-column:1/-1">Domanda<input name="q" required value={it?.q ?? ''} /></label>
		<label style="grid-column:1/-1">Risposta<textarea name="a" rows="4" required>{it?.a ?? ''}</textarea></label>
		<label>Ordine<input name="sort" type="number" value={it?.sort ?? 0} /></label>
		<label>Visibile<select name="active"><option value="on" selected={it?.active ?? true}>Sì</option><option value="off" selected={it ? !it.active : false}>No</option></select></label>
		<div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn btn--blue btn--sm" type="submit">Salva</button><button class="btn btn--ghost btn--sm" type="button" onclick={() => (editItem = null)}>Annulla</button></div>
	</form>
{/snippet}

<div class="dcard">
	<h3>Categorie ({cats.length})</h3>
	<div class="faq-cats" style="justify-content:flex-start;margin-top:10px">
		{#each cats as c, i (c.id)}
			<button type="button" class:is-active={cur === i} onclick={() => { cur = i; editItem = null; }}>{c.name}{#if !c.active} (nascosta){/if}{#if c.product_slug} · prodotto{/if}</button>
		{/each}
		<button type="button" class="btn btn--blue btn--xs" onclick={() => (editCat = 'new')}>+ Nuova categoria</button>
	</div>
	{#if editCat === 'new'}<div style="margin-top:14px">{@render catForm(null)}</div>{/if}
	{#if cat && editCat === cat.id}<div style="margin-top:14px">{@render catForm(cat)}</div>{/if}
	{#if cat && editCat !== cat.id}
		<div style="margin-top:12px;display:flex;gap:8px;align-items:center">
			<span style="color:var(--muted);font-size:13px">Categoria: <b>{cat.name}</b>{#if cat.product_slug} · collegata a {PRODOTTI.find((p) => p.slug === cat.product_slug)?.name ?? cat.product_slug}{/if}</span>
			<button class="btn btn--ghost btn--xs" type="button" onclick={() => (editCat = cat.id)}>Modifica categoria</button>
			<form method="POST" action="?/deleteCategory" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm(`Eliminare la categoria "${cat.name}" con tutte le sue domande?`)) e.preventDefault(); }}><input type="hidden" name="id" value={cat.id} /><button class="btn btn--ghost btn--xs" type="submit">Elimina categoria</button></form>
		</div>
	{/if}
</div>

{#if cat}
	<div class="dcard">
		<h3>Domande in "{cat.name}" ({cat.items.length})</h3>
		{#if editItem === 'new'}<div style="margin-bottom:14px">{@render itemForm(null)}</div>{:else}<button class="btn btn--blue btn--sm" type="button" onclick={() => (editItem = 'new')}>+ Nuova domanda</button>{/if}
		{#if cat.items.length}
			<table class="dtable" style="margin-top:14px">
				<thead><tr><th>Domanda</th><th>Risposta</th><th>Ordine</th><th>Stato</th><th></th></tr></thead>
				<tbody>
					{#each cat.items as it (it.id)}
						<tr>
							<td><b>{it.q}</b></td>
							<td style="max-width:520px;color:var(--muted);font-size:13px">{it.a.length > 160 ? it.a.slice(0, 160) + '…' : it.a}</td>
							<td>{it.sort}</td>
							<td>{#if it.active}<span class="pill pill--on">Visibile</span>{:else}<span class="pill pill--off">Nascosta</span>{/if}</td>
							<td style="white-space:nowrap">
								<button class="btn btn--ghost btn--xs" type="button" onclick={() => (editItem = editItem === it.id ? null : it.id)}>Modifica</button>
								<form method="POST" action="?/deleteItem" use:enhance style="display:inline" onsubmit={(e) => { if (!confirm('Eliminare questa domanda?')) e.preventDefault(); }}><input type="hidden" name="id" value={it.id} /><button class="btn btn--ghost btn--xs" type="submit">Elimina</button></form>
							</td>
						</tr>
						{#if editItem === it.id}<tr><td colspan="5">{@render itemForm(it)}</td></tr>{/if}
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}
