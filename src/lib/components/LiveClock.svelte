<script lang="ts">
	/** Orologio in tempo reale: data, ore, minuti e secondi */
	let now = $state(new Date());
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(t);
	});
	const date = $derived(new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now));
	const time = $derived(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
</script>

<div class="clock"><span class="clock__time">{time}</span><span class="clock__date">{date}</span></div>

<style>
	.clock { display: grid; justify-items: end; line-height: 1.1; }
	.clock__time { font-family: var(--font-display); font-weight: 800; font-size: 26px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
	.clock__date { font-size: 12px; color: var(--muted); text-transform: capitalize; }
</style>
