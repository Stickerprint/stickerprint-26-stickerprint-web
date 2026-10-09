<script lang="ts">
	import { enhance } from '$app/forms';
	import { ACTIVE_STATUSES, ORDER_STATUS, CATS } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
	const giorno = (d: string) => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
	const corto = (d: string) => new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00'));
	/* quando parte: in ritardo (doveva già partire), oggi, o il giorno di riferimento */
	const parte = (shipBy: string | null) => !shipBy ? { t: 'data da fissare', c: 'is-none' } : shipBy < data.today ? { t: `in ritardo · doveva partire ${corto(shipBy)}`, c: 'is-late' } : shipBy === data.today ? { t: 'parte oggi', c: 'is-today' } : { t: `parte ${corto(shipBy)}`, c: '' };
</script>

<svelte:head><title>Da fare oggi | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between;align-items:flex-start">
	<div><h1>📋 Da fare oggi</h1><p class="lead">Gli ordini da preparare oggi, {giorno(data.today)}: quelli che partono <b>{giorno(data.target)}</b> (un giorno di margine), più quelli in ritardo o che partono oggi e non sono ancora pronti. Divisi per prodotto e plastifica. Quando un ordine è pronto, cambia lo stato in "In spedizione" e lo trovi in Spedizioni.</p></div>
	<div class="df-tot"><b>{data.totale}</b><span>{data.totale === 1 ? 'articolo' : 'articoli'}</span></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}
{#if form?.ok && form.message}<p class="success">{form.message}</p>{/if}

{#each data.blocchi as b (b.key)}
	{@const cat = CATS[b.key.split(':')[0]]}
	<section class="df-block" style="--c:{cat?.color ?? '#6b7280'};--soft:{cat?.soft ?? '#eceef3'}">
		<h2><span class="df-dot"></span>{b.title} <small>{b.items.length} {b.items.length === 1 ? 'articolo' : 'articoli'} · {b.pezzi.toLocaleString('it-IT')} pz</small></h2>
		<div class="df-grid">
			{#each b.items as a (a.id)}
				{@const p = parte(a.shipBy)}
				<article class="df-card" class:is-late={p.c === 'is-late'}>
					<a class="df-thumb" href="/dashboard/fatturazione/ordini/{a.group}" title="Apri la scheda ordine">
						{#if a.thumb}<img src={a.thumb} alt="" loading="lazy" />{:else}<span class="df-thumb__ph">{cat?.code ?? '?'}</span>{/if}
					</a>
					<div class="df-body">
						<div class="df-head">
							<a class="oid" href="/dashboard/fatturazione/ordini/{a.group}">{a.number}</a>
							{#if a.express}<span class="tag2" style="background:#fde68a;color:#92400e">⚡ express</span>{/if}
							{#if a.manual}<span class="osub">✏️</span>{/if}
							<span class="df-when {p.c}">{p.t}</span>
						</div>
						<div class="df-size">{a.size}</div>
						<div class="df-mat">{a.material}</div>
						<div class="osub">{a.qty.toLocaleString('it-IT')} pz{a.forma ? ` · ${a.forma}` : ''} · {a.customer}</div>
						{#if a.notes}<div class="df-notes" title={a.notes}>📝 {a.notes}</div>{/if}
						<div class="df-actions">
							{#if a.studio}<a class="btn btn--blue btn--xs" href={a.studio} target="_blank" rel="noopener">🎨 Passa in studio</a>{/if}
							<form method="POST" action="?/stato" use:enhance class="stform"><input type="hidden" name="group" value={a.group} />
								<select name="status" class="st stsel" style="background:{st(a.status).soft};color:{st(a.status).color}" value={a.status} onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()} title="Cambia stato">
									{#each (ACTIVE_STATUSES.includes(a.status) ? ACTIVE_STATUSES : [a.status, ...ACTIVE_STATUSES]) as k (k)}<option value={k}>{st(k).label}</option>{/each}
								</select>
							</form>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>
{:else}
	<div class="dcard" style="text-align:center;padding:40px;color:var(--muted)">Niente da preparare per {giorno(data.target)}: nessun ordine in produzione con quella data di partenza. 🎉</div>
{/each}

<style>
	.df-tot { display: flex; flex-direction: column; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 8px 18px; min-width: 90px; }
	.df-tot b { font-size: 26px; line-height: 1; } .df-tot span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
	.df-block { margin-top: 18px; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px 16px; border-left: 6px solid var(--c); }
	.df-block h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font-size: 20px; }
	.df-block h2 small { font-size: 13px; font-weight: 600; color: var(--muted); }
	.df-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--c); }
	.df-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
	.df-card { display: grid; grid-template-columns: 140px 1fr; gap: 12px; border: 1px solid var(--line); border-radius: 14px; padding: 10px; background: #fafbff; }
	.df-card.is-late { border-color: #f87171; background: #fff5f5; }
	.df-thumb { display: block; width: 140px; height: 140px; border-radius: 10px; background: #fff; border: 1px solid var(--line); overflow: hidden; display: flex; align-items: center; justify-content: center; }
	.df-thumb img { width: 100%; height: 100%; object-fit: contain; }
	.df-thumb__ph { font-weight: 800; color: var(--muted); font-size: 18px; }
	.df-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
	.df-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.df-when { font-size: 11px; font-weight: 700; color: var(--muted); margin-left: auto; }
	.df-when.is-late { color: #b91c1c; } .df-when.is-today { color: #b45309; } .df-when.is-none { color: #6b7280; font-style: italic; }
	.df-size { font-size: 26px; font-weight: 900; line-height: 1.1; letter-spacing: -.01em; }
	.df-mat { font-size: 18px; font-weight: 800; color: var(--c); }
	.df-notes { font-size: 12px; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.df-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 6px; }
	@media (max-width: 700px) { .df-grid { grid-template-columns: 1fr; } .df-card { grid-template-columns: 110px 1fr; } .df-thumb { width: 110px; height: 110px; } .df-size { font-size: 22px; } }
</style>
