<script lang="ts">
	/** Le fasi di una commessa come passi: fatta ✓, in corso (blu), da fare (grigia), bloccata, in attesa (maturazione) */
	import type { Phase } from '$lib/production/types';
	import { DEPARTMENTS } from '$lib/production/types';
	let { phases, compact = false }: { phases: Phase[]; compact?: boolean } = $props();
	const cls = (p: Phase) => (p.status === 'completato' || p.status === 'saltata' ? 'done' : p.status === 'in_corso' ? 'run' : p.status === 'in_attesa' ? 'wait' : p.status === 'bloccato' ? 'block' : p.status === 'pronto' ? 'ready' : '');
</script>
<ol class="steps" class:steps--compact={compact}>
	{#each phases as p (p.id)}
		<li class="step step--{cls(p)}" title="{p.seq}. {p.label}{p.machine ? ` · ${p.machine}` : ''}">
			<span class="step__dot">{#if cls(p) === 'done'}✓{:else if cls(p) === 'block'}!{:else}{DEPARTMENTS[p.stage]?.icon ?? ''}{/if}</span>
			{#if !compact}<span class="step__lbl">{p.label}</span>{/if}
		</li>
	{/each}
</ol>
