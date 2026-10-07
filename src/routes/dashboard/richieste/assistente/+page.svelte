<script lang="ts">
	let { data } = $props();
	let aperta = $state<string | null>(null);
	let filtro = $state<'tutte' | 'passate'>('tutte');
	const CANALE: Record<string, string> = { instagram: '📸 Instagram', whatsapp: '💬 WhatsApp', facebook: '📘 Facebook', sito: '🌐 Sito' };
	const list = $derived(data.conversazioni.filter((c) => filtro === 'tutte' || c.handed_off));
	const quando = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	const oggi = $derived(data.conversazioni.filter((c) => new Date(c.last_at).toDateString() === new Date().toDateString()).length);
</script>

<svelte:head><title>Assistente automatico | Dashboard</title></svelte:head>

<div class="toolbar" style="justify-content:space-between">
	<div><h1>Assistente automatico</h1><p class="lead">Le conversazioni che il bot gestisce da solo su Instagram, WhatsApp e sito. Quelle "passate a Mattia" le trovi anche in Richieste di aiuto, con la trascrizione.</p></div>
	<div class="year-bar"><a href="?" class:is-active={filtro === 'tutte'} onclick={(e) => { e.preventDefault(); filtro = 'tutte'; }}>Tutte ({data.conversazioni.length})</a><a href="?" class:is-active={filtro === 'passate'} onclick={(e) => { e.preventDefault(); filtro = 'passate'; }}>Passate a Mattia ({data.conversazioni.filter((c) => c.handed_off).length})</a></div>
</div>
<p class="stats5-rif">Oggi <b>{oggi}</b> conversazioni attive · il bot risponde da solo, tu vedi solo quelle che ti passa.</p>

<div class="dcard" style="padding:0;overflow-x:auto">
	<table class="dtable">
		<thead><tr><th>Canale</th><th>Cliente</th><th>Ultimo messaggio</th><th>Scambi</th><th>Esito</th><th>Quando</th></tr></thead>
		<tbody>
			{#each list as c (c.id)}
				{@const ultimo = c.chat.at(-1)}
				<tr style="cursor:pointer" onclick={() => (aperta = aperta === c.id ? null : c.id)}>
					<td>{CANALE[c.channel] ?? c.channel}</td>
					<td><b>{c.name ?? c.external_id}</b>{#if c.name}<div class="osub">{c.external_id}</div>{/if}</td>
					<td style="max-width:420px"><span class="osub" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{ultimo ? `${ultimo.da === 'bot' ? '🤖 ' : ''}${ultimo.testo}` : ''}</span></td>
					<td>{c.chat.length}</td>
					<td>{#if c.handed_off}<span class="tag2" style="background:#fff3cd;color:#92400e">passata a Mattia{c.ticket_number ? ` · ${c.ticket_number}` : ''}</span>{:else}<span class="osub">gestita dal bot</span>{/if}</td>
					<td style="white-space:nowrap">{quando(c.last_at)}</td>
				</tr>
				{#if aperta === c.id}
					<tr><td colspan="6" style="background:#f7f8fc;padding:14px 18px">
						<div class="bot-chat">
							{#each c.chat as r, i (i)}
								<div class="bot-msg" class:bot-msg--bot={r.da === 'bot'}>
									<div class="bot-msg__t">{r.testo}</div>
									<div class="osub">{r.da === 'bot' ? '🤖 bot' : '👤 cliente'} · {quando(r.ora)}{#if r.strumenti?.length} · {r.strumenti.map((s) => s.nome).join(', ')}{/if}</div>
								</div>
							{/each}
						</div>
					</td></tr>
				{/if}
			{:else}
				<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nessuna conversazione ancora: il bot entra in azione quando Instagram e WhatsApp sono collegati.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.bot-chat { display: flex; flex-direction: column; gap: 8px; max-width: 760px; }
	.bot-msg { align-self: flex-end; background: #d9fdd3; border-radius: 12px; padding: 8px 12px; max-width: 85%; }
	.bot-msg--bot { align-self: flex-start; background: #fff; border: 1px solid var(--line); }
	.bot-msg__t { white-space: pre-wrap; font-size: 14px; }
</style>
