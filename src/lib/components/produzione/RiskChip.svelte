<script lang="ts">
	import { RISK, type RiskStatus } from '$lib/production/types';
	let { risk, lg = false }: { risk: RiskStatus; lg?: boolean } = $props();
	const r = $derived(RISK[risk]);
</script>
<span class="risk" class:risk--lg={lg} style="--c:{r.hex};--cs:{r.soft}">{r.icon} {r.label}</span>
