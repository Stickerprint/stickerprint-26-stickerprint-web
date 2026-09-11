<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let stars = $state(5);
	let sending = $state(false);
</script>

<svelte:head><title>La tua recensione | Stickerprint</title></svelte:head>

<section class="section container" style="max-width:640px">
	<p class="eyebrow">Ordine {data.number}</p>
	<h1 style="font-size:clamp(28px,4vw,42px)">Com'è andata{data.name ? `, ${data.name}` : ''}?</h1>
	<p class="lead">Due righe e una stella da 1 a 5: aiutano noi a migliorare e chi deve ancora scegliere.</p>
	{#if data.items.length}<ul style="margin:14px 0 22px;padding-left:18px;color:#3d3f63">{#each data.items as i (i)}<li>{i}</li>{/each}</ul>{/if}
	{#if data.done || form?.ok}
		<div class="card" style="padding:26px;text-align:center"><p style="font-size:22px;margin:0 0 6px">Grazie! 🙌</p><p style="margin:0;color:#3d3f63">La tua recensione è stata registrata.</p><a class="btn btn--green" style="margin-top:18px" href="/">Torna su Stickerprint</a></div>
	{:else}
		<form method="POST" use:enhance={() => { sending = true; return async ({ update }) => { sending = false; await update(); }; }} class="card" style="padding:26px;display:grid;gap:14px">
			<div class="stars-in" style="display:flex;gap:6px;font-size:36px;cursor:pointer">{#each [1, 2, 3, 4, 5] as n (n)}<label style="color:{n <= stars ? '#f5b301' : '#d6d9e2'}"><input type="radio" name="rating" value={n} checked={n === stars} onchange={() => (stars = n)} hidden />★</label>{/each}</div>
			<label>Titolo<input class="input" name="title" maxlength="120" placeholder="es. Adesivi perfetti" /></label>
			<label>La tua esperienza<textarea class="input" name="comment" rows="5" maxlength="2000" placeholder="Qualità, tempi, assistenza: racconta quello che vuoi."></textarea></label>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="btn btn--green btn--lg" type="submit" disabled={sending}>{sending ? 'Invio…' : 'Invia la recensione'}</button>
			<p class="note" style="margin:0">La recensione può essere pubblicata sul sito con nome e iniziale del cognome.</p>
		</form>
	{/if}
</section>
