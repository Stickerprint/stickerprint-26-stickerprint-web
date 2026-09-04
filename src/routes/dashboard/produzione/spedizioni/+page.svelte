<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORDER_STATUS, COUNTRIES, dmy, money } from '$lib/dashboard/orders';
	let { data, form } = $props();
	const st = (s: string) => ORDER_STATUS[s] ?? { label: s, color: '#6b7280', soft: '#eceef3' };
</script>

<svelte:head><title>In spedizione | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>🚀 In spedizione</h1><p class="lead">Ordini pronti, affidati al corriere e in consegna. Il bottone "Crea spedizione con il corriere" arriva con l'integrazione GLS / FedEx / TNT.</p></div>
</div>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Ordine</th><th>Cliente</th><th>Destinazione</th><th>Spedizione</th><th>Stato</th><th>Tracking</th><th></th></tr></thead>
		<tbody>
			{#each data.groups as g (g.key)}
				{@const ship = g.items[0].shipping ?? {}}
				<tr>
					<td><a class="oid" href="/dashboard/fatturazione/ordini/{g.key}">{g.number}</a><div class="osub">{dmy(g.created_at)} · {g.qty} pz · {money(g.gross)}</div></td>
					<td><b>{g.customer}</b><div class="osub">{g.email}</div></td>
					<td>{COUNTRIES[g.country]?.flag ?? ''} {ship.city ?? ''} {ship.province ? `(${ship.province})` : ''}<div class="osub">{ship.street ?? ''}</div></td>
					<td>{g.shipping_method ?? 'Corriere espresso'}{#if g.express}<div class="osub">⚡ express</div>{/if}</td>
					<td><span class="st" style="background:{st(g.status).soft};color:{st(g.status).color}">{st(g.status).label}</span></td>
					<td>
						<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px;align-items:center">
							<input type="hidden" name="group" value={g.key} />
							<input type="hidden" name="status" value={g.status === 'pronto' ? 'spedito' : g.status} />
							<input name="tracking" class="sel-sm" style="max-width:220px" placeholder="link tracking" value={g.items[0].tracking_url ?? ''} />
							<button class="ibtn" type="submit" title="Salva tracking">💾</button>
						</form>
					</td>
					<td>
						<form method="POST" action="?/status" use:enhance style="display:flex;gap:6px">
							<input type="hidden" name="group" value={g.key} />
							{#if g.status === 'pronto'}<button class="btn btn--ghost btn--xs" type="submit" name="status" value="in_spedizione" disabled title="Con l'integrazione corrieri">📦 Crea spedizione</button><button class="btn btn--green btn--xs" type="submit" name="status" value="spedito">✓ Spedito</button>
							{:else if g.status === 'spedito' || g.status === 'in_spedizione'}<button class="btn btn--ghost btn--xs" type="submit" name="status" value="in_consegna">In consegna</button><button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>
							{:else}<button class="btn btn--green btn--xs" type="submit" name="status" value="consegnato">✓ Consegnato</button>{/if}
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nessun ordine da spedire.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
