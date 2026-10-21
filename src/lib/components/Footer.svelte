<script lang="ts">
	import { LOCALES, activeLocales, formatAmount, type LocaleCode } from '$lib/i18n';
	import { usaLingua } from '$lib/traduzioni';
	let { locale = 'it', anteprima = false }: { locale?: LocaleCode; anteprima?: boolean } = $props();
	const { t, path: L } = usaLingua();
	const current = $derived(LOCALES[locale] ?? LOCALES.it);
	/* lingue nel selettore: quelle online, piu' tutte in anteprima per lo staff; compare solo se c'e' una scelta */
	const scelte = $derived(anteprima ? Object.values(LOCALES) : activeLocales().map((c) => LOCALES[c]));
	const soglia = $derived(formatAmount(current.freeShipping, current, 0));
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
				message = data.already ? t('footer.giaIscritto') : t('footer.benvenuto');
				email = '';
			} else {
				status = 'error';
				message = data.error ?? t('footer.erroreIscrizione');
			}
		} catch {
			status = 'error';
			message = t('footer.connessione');
		}
	}
</script>

{#snippet flag(f: string)}
	{#if f === 'it'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="1" height="2" fill="#009246" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ce2b37" /></svg>
	{:else if f === 'fr'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="1" height="2" fill="#0055a4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#ef4135" /></svg>
	{:else if f === 'es'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="3" height="2" fill="#aa151b" /><rect y="0.5" width="3" height="1" fill="#f1bf00" /></svg>
	{:else if f === 'de'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="3" height="2" fill="#000" /><rect y="0.667" width="3" height="0.667" fill="#dd0000" /><rect y="1.333" width="3" height="0.667" fill="#ffce00" /></svg>
	{:else if f === 'nl'}<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true"><rect width="3" height="2" fill="#21468b" /><rect width="3" height="1.333" fill="#fff" /><rect width="3" height="0.667" fill="#ae1c28" /></svg>
	{:else}<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff" />{#each [0, 2, 4, 6, 8, 10, 12] as y (y)}<rect y={(y * 20) / 13} width="30" height={20 / 13} fill="#b22234" />{/each}<rect width="12" height="10.77" fill="#3c3b6e" /></svg>{/if}
{/snippet}

<footer class="footer">
	<div class="container">
		<div class="footer__grid">
			<div class="footer__col footer__col--left">
				<div class="footer__block">
					<div class="footer__head">
						<img src="/icons/footer/lock.webp" alt="" width="26" height="26" />
						<p>{t('footer.pagamentiSicuri')}</p>
					</div>
					<div class="footer__logos">
						<img src="/icons/footer/paypal.webp" alt="PayPal" />
						<img src="/icons/footer/visa.webp" alt="Visa" />
						<img src="/icons/footer/mastercard.webp" alt="MasterCard" />
						<img src="/icons/footer/amex.webp" alt="American Express" />
					</div>
				</div>
			</div>
			<div class="footer__col">
				<div class="footer__block">
					<div class="footer__head">
						<img src="/icons/footer/furgowh.svg" alt="" width="26" height="26" />
						<p>{t('footer.spedizioneGratis', { soglia })}</p>
					</div>
					<div class="footer__logos footer__logos--ship">
						<img src="/icons/footer/brt.webp" alt="BRT" />
						<img src="/icons/footer/ups.webp" alt="UPS" />
						<img src="/icons/footer/fedex.webp" alt="FedEx" />
					</div>
				</div>
			</div>
			<div class="footer__col footer__col--right">
				<div class="newsletter">
					<h3 class="newsletter__title">{t('footer.newsletterTitolo')}</h3>
					<form onsubmit={subscribe}>
						<label class="sr-only" for="nl-email">{t('footer.newsletterEmail')}</label>
						<input id="nl-email" type="email" placeholder={t('footer.newsletterPlaceholder')} required bind:value={email} autocomplete="email" />
						<button type="submit" disabled={status === 'sending'}>{status === 'sending' ? t('footer.iscrizione') : t('footer.iscriviti')}</button>
					</form>
					{#if message}<p class="msg" class:ok={status === 'ok'}>{message}</p>{/if}
				</div>
			</div>
		</div>

		<!-- seconda riga sulle stesse tre colonne: menu sotto i pagamenti, copyright sotto i corrieri,
		     lingua e social sotto la newsletter -->
		<div class="footer__bottom">
			<nav class="footer__nav" aria-label={t('footer.menuFooter')}>
				<a href={L('/chi-siamo')}>{t('footer.chiSiamo')}</a>
				<a href={L('/blog')}>{t('footer.blog')}</a>
				<a href={L('/support')}>{t('footer.supporto')}</a>
				<a href={L('/resi')}>{t('footer.resi')}</a>
			</nav>
			<p class="footer__copy">© {new Date().getFullYear()} Stickerprint Srl</p>
			<div class="footer__meta">
				<!-- selettore lingua: compare quando c'e' piu' di una lingua online (PUBLIC_LOCALES) o in anteprima -->
				{#if scelte.length > 1}
				<details class="footer__lang">
					<summary>
						{@render flag(current.flag)}
						<span>{current.label}</span>
						<i class="footer__chev" aria-hidden="true">▾</i>
					</summary>
					<div class="footer__lang-menu">
						{#each scelte as l (l.code)}
							<a href="/set-locale/{l.code}" class:is-active={l.code === current.code} data-sveltekit-reload>{@render flag(l.flag)}<span>{l.label}</span></a>
						{/each}
					</div>
				</details>
				{/if}
				<div class="footer__social">
					<a href="https://www.facebook.com/stickerprint.it" target="_blank" rel="noopener" aria-label="Facebook"><img src="/icons/footer/facebook.webp" alt="" /></a>
					<a href="https://www.instagram.com/stickerprint.it" target="_blank" rel="noopener" aria-label="Instagram"><img src="/icons/footer/instagram.webp" alt="" /></a>
					<a href="https://www.tiktok.com/@stickerprint.it" target="_blank" rel="noopener" aria-label="TikTok"><img src="/icons/footer/tiktok.webp" alt="" /></a>
				</div>
			</div>
		</div>
	</div>
</footer>
