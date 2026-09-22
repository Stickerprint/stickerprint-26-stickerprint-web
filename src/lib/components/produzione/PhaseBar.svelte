<script lang="ts">
	/** barra con un segmento per fase: verde fatta, blu in corso (lampeggia), viola in attesa, grigio bloccata */
	import type { Phase } from '$lib/production/types';
	let { phases }: { phases: Phase[] } = $props();
	const cls = (p: Phase) => (p.status === 'completato' || p.status === 'saltata' ? 'done' : p.status === 'in_corso' ? 'run' : p.status === 'in_attesa' ? 'wait' : p.status === 'bloccato' ? 'block' : '');
</script>
<div class="pbar" title={phases.map((p) => `${p.seq}. ${p.label}`).join(' → ')}>{#each phases as p (p.id)}<i class={cls(p)}></i>{/each}</div>
