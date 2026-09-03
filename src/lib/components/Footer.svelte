<script lang="ts">
	import { LOCALES, type LocaleCode } from '$lib/i18n';
	let { locale = 'it' }: { locale?: LocaleCode } = $props();
	const current = $derived(LOCALES[locale] ?? LOCALES.it);
	let email = $state('');
	let status: 'idle' | 'sending' | 'ok' | 'error' = $state('idle');
	let message = $state('');

	async function subscribe(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;
		status = 'sending';
		try {
			const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.ok) {
				status = 'ok';
				message = data.already ? 'Sei già iscritto alla newsletter.' : 'Iscrizione confermata, benvenuto!';
				email = '';
			} else {
				status = 'error';
				message = data.error ?? 'Non siamo riusciti a iscriverti, riprova.';
			}
		} catch {
			status = 'error';
			message = 'Connessione non riuscita, riprova.';
		}
	}
</script>

{#snippet flag(f: string)}
	{#if f === 'it'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ce2b37" /></svg>
	{:else if f === 'eu'}<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#003399" /><g fill="#ffcc00">{#each Array(12) as _, i (i)}<circle cx={15 + 6.5 * Math.cos((i / 12) * Math.PI * 2)} cy={10 + 6.5 * Math.sin((i / 12) * Math.PI * 2)} r="1.1" />{/each}</g></svg>
	{:else}<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff" />{#each [0, 2, 4, 6, 8, 10, 12] as y (y)}<rect y={(y * 20) / 13} width="30" height={20 / 13} fill="#b22234" />{/each}<rect width="12" height={(20 * 7) / 13} fill="#3c3b6e" /></svg>{/if}
{/snippet}

<footer class="footer">
	<div class="container">
		<div class="footer__grid">
			<div class="footer__col footer__col--left">
				<div class="footer__head">
					<img src="/icons/footer/lock.webp" alt="" width="26" height="26" />
					<p>Metodi di pagamento sicuri</p>
				</div>
				<div class="footer__logos">
					<img src="/icons/footer/paypal.webp" alt="PayPal" />
					<img src="/icons/footer/visa.webp" alt="Visa" />
					<img src="/icons/footer/mastercard.webp" alt="MasterCard" />
					<img src="/icons/footer/amex.webp" alt="American Express" />
				</div>
			</div>
			<div class="footer__col">
				<div class="footer__head">
					<img src="/icons/footer/furgowh.svg" alt="" width="26" height="26" />
					<p>Spedizioni Tracciate</p>
				</div>
				<div class="footer__logos footer__logos--ship">
					<img src="/icons/footer/brt.webp" alt="BRT" />
					<img src="/icons/footer/ups.webp" alt="UPS" />
					<img src="/icons/footer/fedex.webp" alt="FedEx" />
				</div>
			</div>
			<div class="footer__col footer__col--right">
				<div class="newsletter">
					<h4>Iscriviti alla Nostra Newsletter</h4>
					<form onsubmit={subscribe}>
						<label class="sr-only" for="nl-email">Il tuo indirizzo email</label>
						<input id="nl-email" type="email" placeholder="il tuo indirizzo mail" required bind:value={email} autocomplete="email" />
						<button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Iscrizione…' : 'Iscriviti'}</button>
					</form>
					{#if message}<p class="msg" class:ok={status === 'ok'}>{message}</p>{/if}
				</div>
			</div>
		</div>

		<div class="footer__bottom">
			<nav class="footer__nav" aria-label="Footer">
				<a href="/chi-siamo">Chi Siamo</a>
				<a href="/blog">Blog</a>
				<a href="/support">Supporto</a>
				<a href="/resi">Resi</a>
			</nav>
			<p class="footer__copy">© 2023 - {new Date().getFullYear()} Stickerprint Srl</p>
			<div class="footer__meta">
				<details class="footer__lang">
					<summary>
						{@render flag(current.flag)}
						<span>{current.label}</span>
						<i class="footer__chev" aria-hidden="true">▾</i>
					</summary>
					<div class="footer__lang-menu">
						{#each Object.values(LOCALES) as l (l.code)}
							<a href="/set-locale/{l.code}" class:is-active={l.code === current.code} data-sveltekit-reload>{@render flag(l.flag)}<span>{l.label}</span></a>
						{/each}
					</div>
				</details>
				<div class="footer__social">
					<a href="https://www.facebook.com/stickerprint.it" target="_blank" rel="noopener" aria-label="Facebook"><img src="/icons/footer/facebook.webp" alt="" /></a>
					<a href="https://www.instagram.com/stickerprint.it" target="_blank" rel="noopener" aria-label="Instagram"><img src="/icons/footer/instagram.webp" alt="" /></a>
					<a href="https://www.tiktok.com/@stickerprint.it" target="_blank" rel="noopener" aria-label="TikTok"><img src="/icons/footer/tiktok.webp" alt="" /></a>
				</div>
			</div>
		</div>
	</div>
</footer>
