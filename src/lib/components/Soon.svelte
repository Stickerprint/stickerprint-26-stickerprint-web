<script lang="ts">
	let { title, text = 'Questa sezione la configuriamo più avanti.' }: { title: string; text?: string } = $props();
</script>

<h1>{title}</h1>
<div class="soon">
	<b>In arrivo</b>
	<p>{text}</p>
</div>
