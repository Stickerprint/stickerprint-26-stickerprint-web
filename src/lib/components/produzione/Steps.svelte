<script lang="ts">
	/** Le fasi di una commessa come passi, un passo per reparto (le righe di uno stesso ordine si sommano: "Stampa 1/3").
	 *  Verde ✓ fatta, blu in corso, bordo blu pronta, viola in attesa (maturazione), rosso bloccata, grigia da fare. */
	import type { Phase } from '$lib/production/types';
	import { DEPARTMENTS } from '$lib/production/types';
	let { phases, compact = false }: { phases: Phase[]; compact?: boolean } = $props();
	type Step = { key: string; label: string; icon: string; done: number; total: number; cls: string; title: string };
	const steps = $derived.by((): Step[] => {
		const out: Step[] = []; const idx = new Map<string, Step>();
		for (const p of [...phases].sort((a, b) => a.seq - b.seq)) {
			// resinatura e maturazione sono lo stesso reparto: un passo solo
			const key = p.stage; let s = idx.get(key);
			if (!s) { s = { key, label: DEPARTMENTS[p.stage]?.label ?? p.label, icon: DEPARTMENTS[p.stage]?.icon ?? '', done: 0, total: 0, cls: '', title: '' }; idx.set(key, s); out.push(s); }
			s.total++; if (p.status === 'completato' || p.status === 'saltata') s.done++;
			s.title += `${s.title ? '\n' : ''}${p.seq}. ${p.label}${p.machine ? ` · ${p.machine}` : ''} — ${p.status.replace('_', ' ')}`;
			const rank: Record<string, number> = { in_corso: 5, bloccato: 4, pronto: 3, in_attesa: 2, da_fare: 1 };
			const cur = p.status === 'completato' || p.status === 'saltata' ? 0 : rank[p.status] ?? 1;
			const prev = s.cls === 'run' ? 5 : s.cls === 'block' ? 4 : s.cls === 'ready' ? 3 : s.cls === 'wait' ? 2 : s.cls === 'todo' ? 1 : 0;
			if (cur > prev) s.cls = cur === 5 ? 'run' : cur === 4 ? 'block' : cur === 3 ? 'ready' : cur === 2 ? 'wait' : 'todo';
		}
		for (const s of out) if (s.done === s.total) s.cls = 'done';
		return out;
	});
</script>
<ol class="pvs" class:pvs--compact={compact}>
	{#each steps as s (s.key)}
		<li class="pvs__step pvs__step--{s.cls}" title={s.title}>
			<span class="pvs__dot">{#if s.cls === 'done'}✓{:else if s.cls === 'block'}!{:else}{s.icon}{/if}</span>
			{#if !compact}<span class="pvs__lbl">{s.label}{#if s.total > 1} <i>{s.done}/{s.total}</i>{/if}</span>{/if}
		</li>
	{/each}
</ol>
