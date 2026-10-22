<script lang="ts">
	/**
	 * Popup di iscrizione "Ecco il 10% per te" nella lingua del sito, per le lingue diverse dall'italiano (in italiano
	 * resta il popup di Klaviyo, limitato agli URL italiani). Compare una volta sola per visitatore, dopo qualche secondo
	 * o quando il mouse esce dalla pagina; l'iscrizione passa da /api/newsletter, che mette l'email nella lista Klaviyo
	 * "Contatti Popup" con la proprieta' `lingua`: da li' parte il flusso di benvenuto nella lingua giusta.
	 */
	import { onMount } from 'svelte';
	import { usaLingua } from '$lib/traduzioni';
	const { t } = usaLingua();
	const CHIAVE = 'sp-popup-iscrizione';
	let aperto = $state(false);
	let email = $state('');
	let stato: 'idle' | 'invio' | 'ok' | 'errore' = $state('idle');
	let errore = $state('');
	const segna = () => { try { localStorage.setItem(CHIAVE, String(Date.now())); } catch { /* niente */ } };
	onMount(() => {
		try { if (localStorage.getItem(CHIAVE)) return; } catch { return; }
		/* niente popup nel checkout o nell'area personale */
		if (/\/(checkout|carrito|panier|warenkorb|winkelwagen|cart|account|cuenta|compte|konto|login|signup)/.test(location.pathname)) return;
		let fatto = false;
		const mostra = () => { if (fatto) return; fatto = true; aperto = true; segna(); };
		const timer = setTimeout(mostra, 12000);
		const esci = (e: MouseEvent) => { if (e.clientY <= 0) mostra(); };
		document.addEventListener('mouseleave', esci);
		return () => { clearTimeout(timer); document.removeEventListener('mouseleave', esci); };
	});
	async function invia(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;
		stato = 'invio';
		try {
			const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fonte: 'popup' }) });
			const d = await r.json().catch(() => ({}));
			if (r.ok && d.ok) stato = 'ok'; else { stato = 'errore'; errore = d.error ?? t('footer.erroreIscrizione'); }
		} catch { stato = 'errore'; errore = t('footer.connessione'); }
	}
</script>

{#if aperto}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="pi-bg" onclick={(e) => { if (e.target === e.currentTarget) aperto = false; }} onkeydown={(e) => { if (e.key === 'Escape') aperto = false; }}>
		<div class="pi" role="dialog" aria-modal="true" aria-labelledby="pi-titolo">
			<button type="button" class="pi__x" aria-label={t('popup.chiudi')} onclick={() => (aperto = false)}>✕</button>
			<div class="pi__img"><img src="/images/home/kit-campioni.webp" alt="" loading="lazy" /></div>
			<div class="pi__body">
				{#if stato === 'ok'}
					<h2 id="pi-titolo">{t('popup.grazieTitolo')}</h2>
					<p>{t('popup.grazieTesto')}</p>
					<button type="button" class="btn btn--yellow" onclick={() => (aperto = false)}>{t('popup.chiudi')}</button>
				{:else}
					<small>{t('popup.sopra')}</small>
					<h2 id="pi-titolo">{t('popup.titolo')}</h2>
					<p>{t('popup.testo')}</p>
					<form onsubmit={invia}>
						<input type="email" required placeholder={t('footer.newsletterPlaceholder')} bind:value={email} autocomplete="email" />
						<button type="submit" class="btn btn--yellow" disabled={stato === 'invio'}>{stato === 'invio' ? t('footer.iscrizione') : t('popup.bottone')}</button>
					</form>
					{#if stato === 'errore'}<p class="pi__err">{errore}</p>{/if}
					<button type="button" class="pi__no" onclick={() => (aperto = false)}>{t('popup.no')}</button>
					<p class="pi__privacy">{t('popup.privacy')}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.pi-bg { position: fixed; inset: 0; z-index: 1000; background: rgba(11, 11, 59, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
	.pi { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: min(720px, 100%); background: #2f7bff; color: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.35); }
	.pi__img { background: #ffd600; min-height: 100%; }
	.pi__img img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.pi__body { padding: 36px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
	.pi__body small { font-weight: 600; font-size: 14px; }
	.pi__body h2 { margin: 0; font-family: var(--font-display); font-size: 34px; line-height: 1.05; color: #fff; }
	.pi__body p { margin: 0; font-size: 14.5px; }
	.pi__body form { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 8px; }
	.pi__body input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 0; font: inherit; color: #0b0b3b; }
	.pi__no { background: none; border: 0; color: #d9e7ff; text-decoration: underline; font: inherit; font-size: 13px; cursor: pointer; }
	.pi__privacy { font-size: 11px; color: #d9e7ff; }
	.pi__err { color: #ffd600; font-weight: 600; }
	.pi__x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #fff; font-size: 20px; cursor: pointer; z-index: 1; }
	@media (max-width: 700px) { .pi { grid-template-columns: 1fr; } .pi__img { display: none; } .pi__body { padding: 32px 20px 24px; } .pi__body h2 { font-size: 28px; } }
</style>
