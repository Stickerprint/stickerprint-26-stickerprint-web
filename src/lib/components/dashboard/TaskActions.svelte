<script lang="ts">
	/** Pulsanti di una lavorazione: Inizia / Segnala problema / Completa / Sblocca. I form usano le azioni condivise (?/inizia, ?/completa, ...) */
	import { enhance } from '$app/forms';
	import { fmtWhen, type Task } from '$lib/dashboard/produzione';
	let { task, compact = false }: { task: Task; compact?: boolean } = $props();
	let blocking = $state(false);
	let busy = $state(false);
	const wait = $derived(task.wait_minutes > 0 && task.minutes === 0);
	const readyAt = $derived(wait && task.started_at ? new Date(new Date(task.started_at).getTime() + task.wait_minutes * 60000) : null);
	const submit = () => { busy = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); busy = false; blocking = false; }; };
</script>

{#if task.status !== 'completato' && task.status !== 'da_fare'}
	<div class="pr-actions" class:pr-actions--compact={compact}>
		{#if task.status === 'bloccato'}
			<form method="POST" action="?/sblocca" use:enhance={submit}><input type="hidden" name="task" value={task.id} /><button class="btn btn--xs" type="submit" disabled={busy}>🔓 Sblocca</button></form>
		{:else}
			{#if task.status === 'pronto' && !wait}
				<form method="POST" action="?/inizia" use:enhance={submit}><input type="hidden" name="task" value={task.id} /><button class="btn btn--xs" type="submit" disabled={busy}>▶ Inizia</button></form>
			{/if}
			<form method="POST" action="?/completa" use:enhance={submit}><input type="hidden" name="task" value={task.id} />
				<button class="btn btn--green btn--xs" type="submit" disabled={busy} title={readyAt && readyAt > new Date() ? `Maturazione completa ${fmtWhen(readyAt)}` : ''}>✓ Completa{#if readyAt && readyAt > new Date()} <small>(pronta {fmtWhen(readyAt)})</small>{/if}</button>
			</form>
			{#if !blocking}
				<button class="btn btn--ghost btn--xs" type="button" onclick={() => (blocking = true)}>⚠ Segnala problema</button>
			{:else}
				<form method="POST" action="?/blocca" use:enhance={submit} class="pr-block">
					<input type="hidden" name="task" value={task.id} />
					<!-- svelte-ignore a11y_autofocus -->
					<input name="motivo" placeholder="Motivo: materiale mancante, file da rifare, macchina ferma…" required autofocus />
					<button class="btn btn--xs" type="submit" disabled={busy}>Blocca</button>
					<button class="btn btn--ghost btn--xs" type="button" onclick={() => (blocking = false)}>Annulla</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}
