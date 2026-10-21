<script lang="ts">
	import '$lib/styles/checkout.css';
	import FreeShippingBar from '$lib/components/FreeShippingBar.svelte';
	import { shippingForCountry, isRemote } from '$lib/shipping-rules';
	import { NOME_PAESE, zonaDi, ivaDi, valutaDi } from '$lib/mercati';
	import { PRICE_BOOKS } from '$lib/i18n';
	import { onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { readCart, removeFromCart, updateCartItem, clearCart, type CartItem } from '$lib/cart';
	import { getCartFile, getCartPreview, deleteCartFile } from '$lib/utils/draftStore';
	import { PROVINCES } from '$lib/provinces';
	import { materialLabel, fmtMm } from '$lib/account';
	import { track, cartItems, trackingOn } from '$lib/tracking';
	import { klaviyo } from '$lib/klaviyo';
	import { usaLingua } from '$lib/traduzioni';
	const { t, path, prezzo, numero, lang } = usaLingua();
	/* link a login/registrazione che riportano al carrello, nella lingua del sito */
	const loginHref = `${path('/login')}?next=${encodeURIComponent(path('/checkout'))}`;
	const signupHref = `${path('/signup')}?next=${encodeURIComponent(path('/checkout'))}`;
	/* valori che finiscono dentro stringhe rese con {@html}: niente tag dentro */
	/* nome della lamina nella lingua del sito (lucida/opaca); altri valori restano com'erano */
	const finituraNome = (f: string) => (f === 'lucida' || f === 'opaca' ? t(`checkout.finiture.${f}`) : f);
	const esc = (v: string) => v.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);

	let { data } = $props();
	let items = $state<CartItem[]>([]);
	let thumbs = $state<Record<string, string>>({});
	let hasFile = $state<Record<string, boolean>>({});
	let loaded = $state(false);
	let noteOpen = $state<string | null>(null);

	// form (valori iniziali dal profilo)
	// svelte-ignore state_referenced_locally
	const p = data.profile;
	// svelte-ignore state_referenced_locally
	const addr = data.addresses.find((a) => a.kind === 'shipping') ?? null;
	const [fn, ...ln] = (p?.full_name ?? '').split(' ');
	let sameBilling = $state(true);
	let saveAddress = $state(!addr);
	let express = $state(false);
	let useCredit = $state(false);
	// svelte-ignore state_referenced_locally
	let payment = $state(data.stripeKey ? 'card' : data.online ? 'stripe' : 'test');
	// svelte-ignore state_referenced_locally
	const PAY_ERR = data.cancelled ? t('checkout.errori.pagamentoAnnullato') : '';
	let code = $state('');
	let discount = $state<{ code: string; amount: number; description: string | null } | null>(null);
	let codeMsg = $state('');
	let submitting = $state(false);
	let err = $state('');
	let formEl = $state<HTMLFormElement | undefined>();

	/** IVA italiana inclusa nei prezzi del motore; l'IVA applicata dipende dal paese (0 fuori UE) */
	const VAT = 1.22;
	let country = $state(addr?.country && data.paesi.includes(addr.country) ? addr.country : data.paeseDefault);
	const zona = $derived(zonaDi(country));
	const vatRate = $derived(ivaDi(zona));
	const VATF = $derived(1 + vatRate);
	const currency = $derived(valutaDi(zona));
	const fx = $derived(currency === 'USD' ? PRICE_BOOKS.USD.rate * PRICE_BOOKS.USD.markup : 1);
	/* importo "come addebitato" (IVA della zona inclusa) -> prezzo nella valuta del cliente: prezzo() parte sempre dal lordo italiano */
	const mostra = (v: number) => prezzo((v * VAT) / VATF);
	const subtotalNet = $derived(items.reduce((a, i) => a + i.net, 0));
	const subtotalGross = $derived(Math.round(subtotalNet * VATF * 100) / 100);
	const discountAmt = $derived(discount ? Math.min(discount.amount, subtotalNet) : 0);
	const expressBase = $derived(items.filter((i) => i.product !== 'campioni').reduce((a, i) => a + i.net, 0));
	const expressNet = $derived(express ? Math.round(expressBase * data.expressRate * 100) / 100 : 0);
	/* spedizione: gratuita da 50 € di prodotti (IVA inclusa, dopo lo sconto), altrimenti 10 € */
	const productsGrossForShip = $derived(Math.round(Math.max(0, subtotalNet - discountAmt) * VAT * 100) / 100);
	let province = $state(addr?.province ?? '');
	const sped = $derived(shippingForCountry(productsGrossForShip, items.length > 0 && items.every((i) => i.product === 'campioni'), country, province));
	/* Italia/UE: costo lordo IVA inclusa; USA: costo gia' netto (in euro) */
	const shippingNet = $derived(zona === 'us' ? sped.gross : Math.round((sped.gross / VAT) * 100) / 100);
	const shippingGross = $derived(Math.round(shippingNet * VATF * 100) / 100);
	const totalNet = $derived(Math.max(0, subtotalNet - discountAmt) + expressNet + shippingNet);
	const totalGross = $derived(Math.round(totalNet * VATF * 100) / 100);
	const creditUsed = $derived(useCredit ? Math.min(data.credit, totalGross) : 0);
	const toPay = $derived(Math.round((totalGross - creditUsed) * 100) / 100);
	/* quanto si incassa nella valuta del cliente (in dollari: totale netto al cambio del listino) */
	const toPayCurrency = $derived(currency === 'USD' ? Math.round(toPay * fx * 100) / 100 : toPay);
	const vatAmount = $derived(totalGross - totalNet);
	const allFiles = $derived(items.every((i) => hasFile[i.id] || !!i.filePath));
	let guestEmail = $state('');
	const canOrder = $derived(!!data.user || (data.guestAllowed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)));

	onMount(async () => {
		// righe di vecchie versioni del carrello (senza prezzo) vengono scartate
		items = readCart().filter((i) => typeof i.net === 'number' && typeof i.gross === 'number');
		for (const it of items) {
			const f = await getCartFile(it.id);
			hasFile[it.id] = !!f;
			const pv = await getCartPreview(it.id);
			if (pv) thumbs[it.id] = URL.createObjectURL(pv);
			else if (f && f.type.startsWith('image/')) thumbs[it.id] = URL.createObjectURL(f);
		}
		loaded = true;
		if (items.length) {
			const ti = cartItems(items);
			track.viewCart(ti); track.beginCheckout(ti);
			klaviyo.startedCheckout(items.map((i) => ({ productId: `${i.product}_${i.forma}`, productName: `${i.productName} ${i.forma}`, quantity: i.qty, price: i.gross })));
		}
	});
	function remove(id: string) {
		const it = items.find((i) => i.id === id);
		if (it) track.removeFromCart(cartItems([it])[0]);
		items = removeFromCart(id);
		deleteCartFile(id);
	}
	/* add_contact_info quando nome ed email ci sono, add_payment_info alla scelta del pagamento: una volta sola */
	let contactSent = false, paymentSent = false;
	function contactInfo() {
		if (contactSent || !formEl || !items.length) return;
		const fd = new FormData(formEl);
		const email = data.user?.email ?? String(fd.get('email') ?? '');
		if (!String(fd.get('first_name') ?? '').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
		contactSent = true; track.addContactInfo(cartItems(items), discount?.code ?? null); klaviyo.identify(email);
	}
	const PAY_LABEL: Record<string, string> = { stripe: 'Carta di credito', card: 'Carta di credito', wallet: 'Apple Pay / Google Pay', paypal: 'PayPal', test: 'Test' };
	$effect(() => { const p = payment; if (loaded && items.length && p && !paymentSent) { paymentSent = true; track.addPaymentInfo(cartItems(items), PAY_LABEL[p] ?? p, discount?.code ?? null); } });
	async function applyCode() {
		codeMsg = '';
		const r = await fetch('/api/discount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, subtotalNet, email: data.user?.email ?? guestEmail }) }).then((r) => r.json());
		if (r.ok) { discount = r; codeMsg = t('checkout.riepilogo.codiceApplicato', { codice: r.code, importo: prezzo(r.amount) }) + (r.description ? ' · ' + r.description : ''); }
		else { discount = null; codeMsg = r.error; }
	}
	async function reupload(id: string, e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const { saveCartFile } = await import('$lib/utils/draftStore');
		await saveCartFile(id, file);
		hasFile[id] = true;
		if (file.type.startsWith('image/')) thumbs[id] = URL.createObjectURL(file);
		items = updateCartItem(id, { fileName: file.name });
	}
	// ---------- pagamento in pagina (Stripe.js): carta inserita a mano, Apple Pay / Google Pay ----------
	type StripeJs = { elements: (o?: Record<string, unknown>) => StripeElements; confirmCardPayment: (cs: string, o: Record<string, unknown>) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }>; confirmPayment: (o: Record<string, unknown>) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }> };
	type StripeElements = { create: (t: string, o?: Record<string, unknown>) => StripeElement; update: (o: Record<string, unknown>) => void; submit: () => Promise<{ error?: { message?: string } }> };
	type StripeElement = { mount: (el: HTMLElement) => void; unmount: () => void; on: (ev: string, cb: (e: any) => void) => void; destroy: () => void }; // eslint-disable-line @typescript-eslint/no-explicit-any
	let stripe = $state<StripeJs | null>(null);
	let cardEl: StripeElement | null = null;
	let cardHost = $state<HTMLDivElement | undefined>();
	let cardReady = $state(false);
	let cardErr = $state('');
	let exElements: StripeElements | null = null;
	let exHost = $state<HTMLDivElement | undefined>();
	let walletsShown = $state(false);
	/* Stripe.js non arrivato (blocco pubblicita', rete aziendale, script bloccato): la carta si paga sulla cassa Stripe esterna */
	let stripeFailed = $state(false);
	const cardFallback = $derived(payment === 'card' && !!data.stripeKey && !stripe && stripeFailed);
	/* totale coperto dal credito: non c'e' niente da incassare, l'ordine si chiude subito */
	const free = $derived(toPay <= 0);
	/* ordine gia' creato in attesa del pagamento in pagina: si riusa se il carrello non e' cambiato (una carta rifiutata si puo' riprovare) */
	let pending: { clientSecret: string; group: string; sig: string } | null = null;
	const cents = (v: number) => Math.max(50, Math.round(v * 100));
	/* carta salvata dell'account: si sceglie una di quelle gia' salvate oppure 'nuova' (con la casella per salvarla) */
	// svelte-ignore state_referenced_locally
	let cardPick = $state<string>(data.savedCards?.[0]?.id ?? 'new');
	let saveCard = $state(true);
	const BRAND: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', diners: 'Diners', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay' };
	const brandName = (b: string) => BRAND[b] ?? t('checkout.pagamento.cartaGenerica');
	const two = (n: number) => String(n).padStart(2, '0');
	const sig = () => JSON.stringify({ i: items.map((x) => [x.id, x.qty]), t: toPay, e: express, c: discount?.code ?? null, m: guestEmail, cr: useCredit, cp: cardPick, sc: saveCard });
	async function loadStripe() {
		if (!data.stripeKey || typeof window === 'undefined') return;
		const w = window as unknown as { Stripe?: (k: string, o?: Record<string, unknown>) => StripeJs };
		if (!w.Stripe) await new Promise<void>((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://js.stripe.com/v3/'; sc.onload = () => res(); sc.onerror = () => rej(new Error('Stripe.js not loaded')); document.head.appendChild(sc); });
		/* Stripe accetta it, en, es, fr, de, nl: i suoi moduli parlano la lingua del sito */
		const st = w.Stripe!(data.stripeKey, { locale: lang });
		cardEl = st.elements({ locale: lang }).create('card', { hidePostalCode: true, style: { base: { fontFamily: 'Montserrat, Helvetica, Arial, sans-serif', fontSize: '15px', color: '#0b0b3b', '::placeholder': { color: '#9aa0b8' } }, invalid: { color: '#d0342c' } } });
		cardEl.on('change', (ev: { error?: { message?: string }; complete?: boolean }) => { cardErr = ev.error?.message ?? ''; cardReady = !!ev.complete; });
		stripe = st; // dopo aver creato il Card Element: l'effetto che lo monta dipende da questo stato
	}
	/* Card Element montato quando la scelta "Carta di credito" e' aperta */
	$effect(() => { const host = cardHost; const st = stripe; if (host && st && cardEl) { cardEl.mount(host); return () => cardEl?.unmount(); } });
	/* Apple Pay / Google Pay: Express Checkout Element (compare solo dove il wallet e' disponibile) */
	$effect(() => {
		const host = exHost; const st = stripe;
		if (!host || !st || !loaded || items.length === 0 || free) return;
		/* l'importo iniziale non e' una dipendenza: ai cambi di totale pensa l'effetto di aggiornamento qui sotto */
		const els = st.elements({ mode: 'payment', amount: untrack(() => cents(toPayCurrency)), currency: currency === 'USD' ? 'usd' : 'eur', locale: lang, appearance: { variables: { borderRadius: '10px' } } });
		exElements = els;
		const ex = els.create('expressCheckout', { paymentMethods: { link: 'never', paypal: 'never', amazonPay: 'never', klarna: 'never' }, buttonHeight: 48, layout: { maxColumns: 2, maxRows: 1, overflow: 'never' }, buttonType: { applePay: 'buy', googlePay: 'buy' }, buttonTheme: { applePay: 'black', googlePay: 'black' } });
		ex.on('ready', (ev: { availablePaymentMethods?: Record<string, boolean> }) => { walletsShown = !!ev.availablePaymentMethods && Object.values(ev.availablePaymentMethods).some(Boolean); });
		ex.on('click', (ev: { resolve: (o?: Record<string, unknown>) => void }) => {
			err = '';
			if (!canOrder) { err = data.user ? '' : data.guestAllowed ? t('checkout.errori.emailPrima') : t('checkout.errori.accedi'); return; }
			if (!allFiles) { err = t('checkout.errori.mancaFile'); return; }
			const miss = missingFields(); if (miss) { err = miss; return; }
			ev.resolve({ emailRequired: false });
		});
		ex.on('confirm', async (ev: { paymentFailed: (o?: { reason?: string; message?: string }) => void }) => {
			submitting = true; err = '';
			try {
				const { error: se } = await els.submit();
				if (se) throw new Error(se.message ?? t('checkout.errori.datiNonValidi'));
				const cs = await ensurePending('wallet');
				const r = await st.confirmPayment({ elements: els, clientSecret: cs.clientSecret, confirmParams: { return_url: `${location.origin}${path('/checkout/grazie')}${express ? '?e=1' : ''}` }, redirect: 'if_required' });
				if (r.error) { ev.paymentFailed({ reason: 'fail', message: r.error.message }); err = r.error.message ?? t('checkout.errori.pagamento'); submitting = false; return; }
				await goto(`${path('/checkout/grazie')}?pi=${encodeURIComponent(r.paymentIntent?.id ?? '')}${express ? '&e=1' : ''}`);
			} catch (ex) {
				ev.paymentFailed({ reason: 'fail', message: ex instanceof Error ? ex.message : t('checkout.errori.errore') });
				err = ex instanceof Error ? ex.message : t('checkout.errori.errorePagamento'); submitting = false;
			}
		});
		ex.mount(host);
		return () => { ex.destroy(); exElements = null; };
	});
	$effect(() => { const t = toPayCurrency; exElements?.update({ amount: cents(t) }); });
	onMount(() => {
		loadStripe().catch((e) => { console.error('[stripe.js]', e); stripeFailed = true; });
		/* dopo 12 secondi senza Stripe.js il bottone porta alla cassa Stripe: il cliente non resta bloccato su "Caricamento…" */
		const t = setTimeout(() => { if (!stripe) stripeFailed = true; }, 12_000);
		return () => clearTimeout(t);
	});

	/* carica i file su Storage e registra l'ordine (in attesa, se il pagamento avviene sul sito); restituisce la risposta del server */
	async function prepare(paymentKind: string): Promise<{ type: string; data?: Record<string, unknown> }> {
		if (!formEl) throw new Error(t('checkout.errori.modulo'));
			const lines = [];
			for (const it of items) {
				let filePath = it.filePath ?? null;
				let previewUrl: string | null = it.previewUrl ?? null;
				const f = await getCartFile(it.id);
				const pv = await getCartPreview(it.id);
				if (pv) {
					const ppath = `${data.user?.id ?? 'guest'}/${it.id}.png`;
					const { error: pe } = await data.supabase.storage.from('order-previews').upload(ppath, pv, { contentType: 'image/png', upsert: true });
					if (!pe) previewUrl = data.supabase.storage.from('order-previews').getPublicUrl(ppath).data.publicUrl;
				}
				const extOf = (x: File) => (x.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
				/* file d'ordine: gli utenti registrati scrivono nel bucket direttamente; gli ospiti chiedono al server un permesso firmato e poi caricano anche loro direttamente (il bucket non accetta scritture anonime) */
				const putFile = async (path: string, kf: File) => {
					if (data.user) { const { error } = await data.supabase.storage.from('order-files').upload(path, kf, { contentType: kf.type || undefined, upsert: true }); if (error) throw new Error(t('checkout.errori.fileNonCaricato', { nome: kf.name, errore: error.message })); return; }
					/* ospite: permesso firmato dal server, poi il file va dritto su Supabase Storage (le funzioni Vercel rifiutano i corpi oltre 4,5 MB) */
					const fdu = new FormData(); fdu.set('path', path); fdu.set('size', String(kf.size));
					const r = await fetch('/api/order-file', { method: 'POST', body: fdu }).then((x) => x.json()).catch(() => ({ error: t('checkout.errori.rete') }));
					if (!r.ok || !r.token) throw new Error(t('checkout.errori.fileNonCaricato', { nome: kf.name, errore: r.error ?? t('checkout.errori.erroreGenerico') }));
					const { error } = await data.supabase.storage.from('order-files').uploadToSignedUrl(path, String(r.token), kf, { contentType: kf.type || undefined });
					if (error) throw new Error(t('checkout.errori.fileNonCaricato', { nome: kf.name, errore: error.message }));
				};
				if (it.product === 'kit_adesivi') {
					/* kit di adesivi: piu' file in una cartella dell'ordine (cavallotto + adesivo-1..6); file_path = la cartella */
					const dir = `${data.user?.id ?? 'guest'}/${it.id}`;
					const n = Number(String(it.forma).replace(/\D/g, '')) || 0;
					const keys = [':cav', ...Array.from({ length: n }, (_, k) => `:s${k + 1}`)];
					for (const key of keys) {
						const kf = await getCartFile(it.id + key);
						if (!kf) continue;
						const name = key === ':cav' ? 'cavallotto' : `adesivo-${key.slice(2)}`;
						await putFile(`${dir}/${name}.${extOf(kf)}`, kf);
					}
					filePath = `${dir}/`;
				} else if (it.product === 'fogli_adesivi' && (await getCartFile(it.id + ':layout'))) {
					/* foglio composto sul sito: foglio.png (file di stampa), sfondo, i design e la disposizione, in una cartella */
					const dir = `${data.user?.id ?? 'guest'}/${it.id}`;
					const keys = [':foglio', ':bg', ':layout', ...Array.from({ length: 12 }, (_, k) => `:s${k + 1}`)];
					for (const key of keys) {
						const kf = await getCartFile(it.id + key);
						if (!kf) continue;
						const name = key === ':foglio' ? 'foglio' : key === ':bg' ? 'sfondo' : key === ':layout' ? 'layout' : `design-${key.slice(2)}`;
						await putFile(`${dir}/${name}.${extOf(kf)}`, kf);
					}
					filePath = `${dir}/`;
				} else if (f) {
					const ext = extOf(f);
					const path = `${data.user?.id ?? 'guest'}/${it.id}.${ext}`;
					await putFile(path, f);
					filePath = path;
				} else if (!filePath && it.fileName) {
					/* il file era stato caricato ma il browser non ce l'ha piu' (succede su iPhone): meglio fermarsi che ordinare senza file */
					throw new Error(t('checkout.errori.fileNonDisponibile', { nome: it.fileName }));
				}
				lines.push({ id: it.id, product: it.product, forma: it.forma, materiale: it.materiale, finitura: it.finitura, w: it.w, h: it.h, qty: it.qty, filePath, fileName: it.fileName ?? null, previewUrl, note: it.note, reorderOf: it.reorderOf ?? null, promoId: it.promoId ?? null, engineState: it.engineState ?? null });
			}
			const fd = new FormData(formEl);
			fd.set('items', JSON.stringify(lines));
			fd.set('payment', paymentKind);
			/* carta: quella salvata scelta, oppure la nuova da salvare (solo clienti registrati) */
			fd.delete('saved_pm'); fd.delete('save_card');
			if (paymentKind === 'card' && data.user && data.canSaveCard) { if (cardPick !== 'new') fd.set('saved_pm', cardPick); else if (saveCard) fd.set('save_card', 'on'); }
			const res = await fetch('?/order', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
			return deserialize(await res.text()) as { type: string; data?: Record<string, unknown> };
	}
	/* per carta e wallet: l'ordine in attesa viene creato una volta sola; se il carrello cambia, quello vecchio viene annullato */
	async function ensurePending(kind: 'card' | 'wallet'): Promise<{ clientSecret: string; group: string }> {
		const now = sig() + kind;
		if (pending && pending.sig === now) return pending;
		if (pending) { const fd = new FormData(); fd.set('group', pending.group); await fetch('?/annulla', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } }).catch(() => {}); pending = null; }
		const result = await prepare(kind);
		if (result.type === 'success' && result.data?.clientSecret) { pending = { clientSecret: String(result.data.clientSecret), group: String(result.data.group), sig: now }; return pending; }
		throw new Error(result.type === 'failure' ? String(result.data?.error ?? t('checkout.errori.ordineNonInviato')) : t('checkout.errori.ordineRiprova'));
	}
	/* controlli che il server farebbe comunque, ma prima di caricare i file: il codice fiscale non e' un campo `required` del browser */
	function missingFields(): string {
		if (!formEl) return t('checkout.errori.modulo');
		const fd = new FormData(formEl);
		const g = (k: string) => String(fd.get(k) ?? '').trim();
		if (country === 'IT' && !g('fiscal_code') && !g('vat')) return t('checkout.errori.codiceFiscale');
		return '';
	}
	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		err = '';
		if (!canOrder) { err = data.user ? '' : data.guestAllowed ? t('checkout.errori.email') : t('checkout.errori.accedi'); return; }
		if (!allFiles) { err = t('checkout.errori.mancaFile'); return; }
		if (!formEl) return;
		const miss = missingFields(); if (miss) { err = miss; return; }
		/* carta scelta ma Stripe.js assente: si paga sulla cassa Stripe esterna (stesso incasso, pagina di Stripe) */
		const hosted = payment === 'card' && !stripe;
		const useSaved = payment === 'card' && !hosted && cardPick !== 'new';
		if (payment === 'card' && !hosted && !free && !useSaved && (!cardReady || cardErr)) { err = cardErr || t('checkout.errori.datiCarta'); return; }
		submitting = true;
		try {
			if (useSaved && stripe && !free) {
				/* carta salvata: il server prepara il pagamento con quella carta, il browser lo conferma (3D Secure se la banca lo chiede) */
				const cs = await ensurePending('card');
				const r = await stripe.confirmCardPayment(cs.clientSecret, { payment_method: cardPick });
				if (r.error) { err = r.error.message ?? t('checkout.errori.cartaSalvata'); submitting = false; return; }
				await goto(`${path('/checkout/grazie')}?pi=${encodeURIComponent(r.paymentIntent?.id ?? '')}${express ? '&e=1' : ''}`);
				return;
			}
			if (payment === 'card' && stripe && cardEl && !free) {
				/* carta inserita in pagina: ordine in attesa + conferma del pagamento nel browser (3D Secure compreso) */
				const cs = await ensurePending('card');
				const fd = new FormData(formEl);
				const r = await stripe.confirmCardPayment(cs.clientSecret, { payment_method: { card: cardEl, billing_details: { name: `${fd.get('first_name') ?? ''} ${fd.get('last_name') ?? ''}`.trim(), email: data.user?.email ?? String(fd.get('email') ?? '') } } });
				if (r.error) { err = r.error.message ?? t('checkout.errori.carta'); submitting = false; return; }
				await goto(`${path('/checkout/grazie')}?pi=${encodeURIComponent(r.paymentIntent?.id ?? '')}${express ? '&e=1' : ''}`);
				return;
			}
			/* totale a zero (credito): l'ordine si chiude subito senza cassa, qualunque metodo sia selezionato */
			const result = await prepare(free ? 'credito' : hosted ? 'stripe' : payment);
			if (result.type === 'success' && result.data?.clientSecret) {
				/* il server ha preparato un pagamento in pagina che qui non possiamo confermare: non si svuota il carrello */
				const fd = new FormData(); fd.set('group', String(result.data.group ?? ''));
				await fetch('?/annulla', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } }).catch(() => {});
				err = t('checkout.errori.moduloCarta'); submitting = false; return;
			}
			if (result.type === 'success' && result.data?.redirect) {
				/* cassa esterna (PayPal, o Stripe hosted se manca la chiave pubblica): il carrello resta finche' il pagamento non va a buon fine */
				location.href = String(result.data.redirect);
				return;
			}
			if (result.type === 'success' && result.data?.numbers) {
				const numbers = result.data.numbers as string[];
				const fd = new FormData(formEl);
				const g = (k: string) => String(fd.get(k) ?? '');
				track.purchase({ orderNumber: numbers[0], items: cartItems(items), value: toPay, tax: Math.round(vatAmount * 100) / 100, paymentType: PAY_LABEL[payment] ?? payment, express, coupon: discount?.code ?? null, discount: Math.round(discountAmt * VAT * 100) / 100, returning: !!data.user && (data.orderCount ?? 0) > 0, userId: data.user?.id ?? null, orderCount: (data.orderCount ?? 0) + 1, lifetimeValue: Math.round(((data.lifetimeValue ?? 0) + toPay) * 100) / 100, user: { email: data.user?.email ?? g('email'), phone: g('phone'), first_name: g('first_name'), last_name: g('last_name'), street: g('street'), city: g('city'), province: g('province'), zip: g('zip') } });
				if (trackingOn()) await new Promise((r) => setTimeout(r, 400));   /* il tempo di far partire i tag prima di cambiare pagina */
				for (const it of items) deleteCartFile(it.id);
				clearCart();
				await goto(`${path('/checkout/grazie')}?n=${encodeURIComponent(numbers.join(','))}${express ? '&e=1' : ''}`);
				return;
			}
			err = result.type === 'failure' ? String(result.data?.error ?? t('checkout.errori.ordineNonInviato')) : t('checkout.errori.ordineRiprova');
		} catch (ex) {
			err = ex instanceof Error ? ex.message : t('checkout.errori.erroreInvio');
		}
		submitting = false;
	}
</script>

<svelte:head><title>{t('checkout.titolo')} | Stickerprint</title></svelte:head>

<section class="section container">
	<h1 class="center" style="font-size:clamp(30px,4vw,44px)">{t('checkout.titolo')}</h1>

	{#if loaded && items.length === 0}
		<div class="co-empty">
			<p class="lead">{t('checkout.vuoto.testo')}</p>
			<a class="btn btn--green btn--lg" href={path('/prodotti')}>{t('checkout.vuoto.cta')}</a>
		</div>
	{:else}
		<form class="co" method="POST" action="?/order" bind:this={formEl} onsubmit={onSubmit}>
			<input type="hidden" name="same_billing" value={sameBilling ? 'on' : 'off'} />

			<!-- SINISTRA: dati -->
			<div class="co__left">
				{#if !data.user}
					<div class="co-login">
						<h2>{t('checkout.login.titolo')} <a class="link" href={loginHref}>{t('checkout.login.accedi')}</a></h2>
						<!-- testi con grassetti dal catalogo (mai da input utente) -->
						<p class="lead">{@html t('checkout.login.lead')} {#if data.guestAllowed}{t('checkout.login.ospite')}{/if}</p>
						<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn btn--green" href={signupHref}>{t('checkout.login.crea')}</a><a class="btn btn--ghost" href={loginHref}>{t('checkout.login.accedi')}</a></div>
					</div>
				{/if}

				<h2>{t('checkout.spedizione.titolo')}</h2>
				<div class="co-grid">
					<label>{t('checkout.spedizione.nome')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="first_name" required value={addr?.first_name ?? fn ?? ''} onblur={contactInfo} /></label>
					<label>{t('checkout.spedizione.cognome')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="last_name" required value={addr?.last_name ?? ln.join(' ')} /></label>
					<label class="full">{t('checkout.spedizione.email')} <i>{t('checkout.spedizione.obbligatorio')}</i>{#if data.user}<input type="email" value={data.user.email ?? ''} readonly /><small>{@html t('checkout.spedizione.emailAccount', { email: esc(data.user.email ?? '') })}</small>{:else}<input type="email" name="email" required bind:value={guestEmail} autocomplete="email" onblur={contactInfo} /><small>{t('checkout.spedizione.emailOspite')}</small>{/if}</label>
					<label class="full">{t('checkout.spedizione.indirizzo')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="street" required value={addr?.street ?? ''} /></label>
					<label class="full"><span class="sr-only">{t('checkout.spedizione.dettagli')}</span><input name="street2" placeholder={t('checkout.spedizione.dettagliPlaceholder')} /></label>
					<label>{t('checkout.spedizione.citta')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="city" required value={addr?.city ?? ''} /></label>
					{#if data.paesi.length > 1}
						<label>{t('checkout.spedizione.paese')} <i>{t('checkout.spedizione.obbligatorio')}</i>
							<select name="country" required bind:value={country} onchange={() => (province = '')}>
								{#each data.paesi as c (c)}<option value={c}>{NOME_PAESE[c] ?? c}</option>{/each}
							</select>
						</label>
					{:else}<input type="hidden" name="country" value={country} />{/if}
					<label>{t('checkout.spedizione.cap')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="zip" required inputmode={country === 'NL' ? 'text' : 'numeric'} value={addr?.zip ?? ''} /></label>
					{#if country === 'IT'}
						<label>{t('checkout.spedizione.provincia')} <i>{t('checkout.spedizione.obbligatorio')}</i>
							<select name="province" required bind:value={province}>
								<option value="">{t('checkout.spedizione.seleziona')}</option>
								{#each PROVINCES as [sigla, nome] (sigla)}<option value={sigla} selected={addr?.province === sigla}>{nome}</option>{/each}
							</select>
						</label>
					{:else if country === 'US' && data.stati}
						<label>{t('checkout.spedizione.stato')} <i>{t('checkout.spedizione.obbligatorio')}</i>
							<select name="province" required bind:value={province}>
								<option value="">{t('checkout.spedizione.seleziona')}</option>
								{#each Object.entries(data.stati) as [sigla, nome] (sigla)}<option value={sigla}>{nome}</option>{/each}
							</select>
						</label>
					{:else}
						<label>{t('checkout.spedizione.provincia')} <i>{t('checkout.spedizione.facoltativo')}</i><input name="province" bind:value={province} maxlength="40" /></label>
					{/if}
					<label>{t('checkout.spedizione.telefono')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="phone" type="tel" required value={addr?.phone ?? p?.phone ?? ''} /></label>
					{#if country === 'IT'}<label>{t('checkout.spedizione.codiceFiscale')} <i>{t('checkout.spedizione.obbligatorio')}</i><input name="fiscal_code" value={p?.fiscal_code ?? ''} /></label>{/if}
					<label>{t('checkout.spedizione.azienda')} <i>{t('checkout.spedizione.facoltativo')}</i><input name="company" value={p?.company_name ?? ''} /></label>
					<label>{t('checkout.spedizione.partitaIva')} <i>{t('checkout.spedizione.facoltativo')}</i><input name="vat" value={p?.vat_number ?? ''} /></label>
					{#if country === 'IT'}<label>{t('checkout.spedizione.sdi')} <i>{t('checkout.spedizione.facoltativo')}</i><input name="sdi" maxlength="7" value={p?.sdi_code ?? ''} /></label>{/if}
				</div>
				<label class="co-check"><input type="checkbox" bind:checked={sameBilling} /> {t('checkout.spedizione.stessaFatturazione')}</label>
				{#if !sameBilling}
					<h3 style="margin-top:10px">{t('checkout.spedizione.fatturazione')}</h3>
					<div class="co-grid">
						<label>{t('checkout.spedizione.nome')}<input name="b_first_name" /></label>
						<label>{t('checkout.spedizione.cognome')}<input name="b_last_name" /></label>
						<label class="full">{t('checkout.spedizione.indirizzo')}<input name="b_street" /></label>
						<label class="full"><span class="sr-only">{t('checkout.spedizione.dettagli')}</span><input name="b_street2" placeholder={t('checkout.spedizione.dettagliPlaceholder')} /></label>
						<label>{t('checkout.spedizione.citta')}<input name="b_city" /></label>
						<label>{t('checkout.spedizione.cap')}<input name="b_zip" /></label>
						{#if country === 'IT'}<label>{t('checkout.spedizione.provincia')}<select name="b_province"><option value="">{t('checkout.spedizione.seleziona')}</option>{#each PROVINCES as [sigla, nome] (sigla)}<option value={sigla}>{nome}</option>{/each}</select></label>
						{:else if country === 'US' && data.stati}<label>{t('checkout.spedizione.stato')}<select name="b_province"><option value="">{t('checkout.spedizione.seleziona')}</option>{#each Object.entries(data.stati) as [sigla, nome] (sigla)}<option value={sigla}>{nome}</option>{/each}</select></label>
						{:else}<label>{t('checkout.spedizione.provincia')}<input name="b_province" maxlength="40" /></label>{/if}
					</div>
				{/if}
				<label class="co-check"><input type="checkbox" name="save_address" bind:checked={saveAddress} /> {t('checkout.spedizione.salvaIndirizzo')}</label>

				<h2 style="margin-top:28px">{t('checkout.pagamento.titolo')}</h2>
				<div class="co-pay">
					{#if data.stripeKey}
						<label class="co-pay__opt co-pay__opt--card" class:is-open={payment === 'card'}>
							<input type="radio" name="payment" value="card" bind:group={payment} />
							<span><b>{t('checkout.pagamento.carta')}</b><small>{t('checkout.pagamento.cartaSub')}</small></span>
							<span class="co-pay__logos"><img src="/icons/pay/visa.svg" alt="Visa" /><img src="/icons/pay/mastercard.svg" alt="Mastercard" /><img src="/icons/pay/amex.svg" alt="American Express" /></span>
						</label>
						{#if payment === 'card'}
							<div class="co-card">
								{#if data.savedCards?.length}
									<div class="co-saved" role="radiogroup" aria-label={t('checkout.pagamento.cartaDaUsare')}>
										{#each data.savedCards as c (c.id)}
											<label class="co-saved__opt" class:is-on={cardPick === c.id}><input type="radio" value={c.id} bind:group={cardPick} /><span><b>{brandName(c.brand)} •••• {c.last4}</b><small>{t('checkout.pagamento.scade', { data: `${two(c.expMonth)}/${String(c.expYear).slice(-2)}` })}</small></span></label>
										{/each}
										<label class="co-saved__opt" class:is-on={cardPick === 'new'}><input type="radio" value="new" bind:group={cardPick} /><span><b>{t('checkout.pagamento.altraCarta')}</b></span></label>
									</div>
								{/if}
								<div hidden={cardPick !== 'new'} style="display:{cardPick === 'new' ? 'grid' : 'none'};gap:8px">
									<p class="co-card__lead">{t('checkout.pagamento.inserisciCarta')}{#if !data.user}{' · '}{@html t('checkout.pagamento.accediSalva', { href: loginHref })}{/if}</p>
									{#if cardFallback}
										<p class="co-card__lead" style="margin:0">{@html t('checkout.pagamento.fallback')}</p>
									{:else}
										<div class="co-card__box" bind:this={cardHost}>{#if !stripe}<span class="note">{t('checkout.pagamento.caricamento')}</span>{/if}</div>
									{/if}
									{#if cardErr}<p class="error" style="margin:6px 0 0;font-size:13px">{cardErr}</p>{/if}
									{#if data.user && data.canSaveCard}<label class="co-save"><input type="checkbox" bind:checked={saveCard} /> {t('checkout.pagamento.salvaCarta')}</label>{/if}
								</div>
								<p class="co-card__note">{t('checkout.pagamento.notaCarta')}{#if data.savedCards?.length}{' '}{@html t('checkout.pagamento.gestisciCarte', { href: path('/account/pagamenti') })}{/if}</p>
							</div>
						{/if}
					{:else if data.online}
						<label class="co-pay__opt"><input type="radio" name="payment" value="stripe" bind:group={payment} /><span><b>{t('checkout.pagamento.carta')}</b><small>{t('checkout.pagamento.cartaSubStripe')}</small></span><span class="co-pay__logos"><img src="/icons/pay/visa.svg" alt="Visa" /><img src="/icons/pay/mastercard.svg" alt="Mastercard" /><img src="/icons/pay/amex.svg" alt="American Express" /></span></label>
					{/if}
					{#if data.online || data.paypal}
						<label class="co-pay__opt"><input type="radio" name="payment" value="paypal" bind:group={payment} /><span><b>{t('checkout.pagamento.paypal')}</b><small>{t('checkout.pagamento.paypalSub')}</small></span><img class="co-pay__paypal" src="/icons/pay/paypal.svg" alt="PayPal" /></label>
					{/if}
					{#if data.stripeKey}
						<div class="co-wallets" class:is-on={walletsShown}>
							<div class="co-wallets__sep"><span>{t('checkout.pagamento.oppure')}</span></div>
							<div bind:this={exHost}></div>
						</div>
					{/if}
					{#if !data.online && !data.paypal}
						<label class="co-pay__opt is-soon"><input type="radio" name="payment" value="stripe" disabled /><span><b>{t('checkout.pagamento.carta')}</b><small>{t('checkout.pagamento.presto')}</small></span></label>
						<label class="co-pay__opt is-soon"><input type="radio" name="payment" value="paypal" disabled /><span><b>{t('checkout.pagamento.paypal')}</b><small>{t('checkout.pagamento.presto')}</small></span></label>
						<label class="co-pay__opt"><input type="radio" name="payment" value="test" bind:group={payment} /><span><b>{t('checkout.pagamento.test')}</b><small>{t('checkout.pagamento.testSub')}</small></span></label>
					{/if}
				</div>
				<p class="co-secure">{@html t('checkout.pagamento.sicuro')}</p>

				{#if err || PAY_ERR}<p class="error" style="margin-top:14px">{err || PAY_ERR}</p>{/if}
				{#if payment === 'paypal' && (data.paypal || data.online) && !free}
					<button class="btn btn--paypal btn--lg co-submit" type="submit" disabled={submitting || !canOrder || !allFiles || items.length === 0}><img src="/icons/footer/paypal.webp" alt="" />{submitting ? t('checkout.bottoni.paypalAttesa') : t('checkout.bottoni.paypal')}</button>
				{:else}
					<button class="btn btn--green btn--lg co-submit" type="submit" disabled={submitting || !canOrder || !allFiles || items.length === 0}>{submitting ? (free ? t('checkout.bottoni.invioInCorso') : payment === 'card' && stripe ? t('checkout.bottoni.pagamentoInCorso') : data.online && payment !== 'test' ? t('checkout.bottoni.cassaAttesa') : t('checkout.bottoni.invioInCorso')) : free ? t('checkout.bottoni.inviaCredito') : cardFallback ? t('checkout.bottoni.pagaCassa', { importo: prezzo(toPay) }) : payment === 'card' ? t('checkout.bottoni.pagaCarta', { importo: prezzo(toPay) }) : t('checkout.bottoni.invia')}</button>
				{/if}
				<p class="note" style="margin-top:8px">{@html t('checkout.bottoni.consenso', { privacy: path('/privacy'), termini: path('/termini') })}</p>
			</div>

			<!-- DESTRA: riepilogo -->
			<aside class="co__right">
				<div class="co-box">
					<h2>{t('checkout.riepilogo.titolo')}</h2>
					{#each items as it (it.id)}
						<div class="co-item">
							<div class="co-item__thumb">{#if thumbs[it.id]}<img src={thumbs[it.id]} alt="" />{:else}<img src="/images/estimator/round_stickers.webp" alt="" />{/if}</div>
							<div class="co-item__body">
								<div class="co-item__top"><b>{#if it.product === 'campioni'}{t('checkout.riepilogo.kitCampioni')}{:else if it.product === 'kit_adesivi'}{t('checkout.riepilogo.kitAdesivi', { n: numero(it.qty), adesivi: it.forma.replace(/\D/g, '') })}{:else}{numero(it.qty)} {it.productName} {it.forma}{/if}</b><span class="co-item__price">{prezzo(it.gross)}</span><button type="button" class="co-item__x" aria-label={t('checkout.riepilogo.rimuovi')} onclick={() => remove(it.id)}>✕</button></div>
								{#if it.product === 'campioni'}<small>{t('checkout.riepilogo.campioniSub')}</small>{:else if it.product === 'kit_adesivi'}<small>{t('checkout.riepilogo.kitSub', { mm: fmtMm(it.w), materiale: materialLabel(it.materiale, lang) })}{#if it.finitura && it.finitura !== 'nessuna'}{' · '}{t('checkout.riepilogo.lamina', { finitura: finituraNome(it.finitura) })}{/if}</small>{:else}<small>{t('checkout.riepilogo.misura', { w: fmtMm(it.w), h: fmtMm(it.h), materiale: materialLabel(it.materiale, lang) })}{#if it.finitura && it.finitura !== 'nessuna'}{' · '}{t('checkout.riepilogo.lamina', { finitura: finituraNome(it.finitura) })}{/if}</small>{/if}
								{#if it.product !== 'campioni'}<small>{t('checkout.riepilogo.file')} {#if hasFile[it.id] || it.filePath}{it.fileName ?? t('checkout.riepilogo.fileCaricato')}{:else}<span class="err">{t('checkout.riepilogo.mancante')}</span> <label class="link" style="cursor:pointer">{t('checkout.riepilogo.carica')}<input type="file" hidden accept="image/*,.pdf,.svg,.ai,.eps" onchange={(e) => reupload(it.id, e)} /></label>{/if}</small>{/if}
								{#if noteOpen === it.id}
									<textarea rows="2" placeholder={t('checkout.riepilogo.notePlaceholder')} value={it.note ?? ''} onchange={(e) => (items = updateCartItem(it.id, { note: (e.currentTarget as HTMLTextAreaElement).value }))}></textarea>
								{:else}
									<button type="button" class="link-btn" onclick={() => (noteOpen = it.id)}>{it.note ? t('checkout.riepilogo.modificaNote') : t('checkout.riepilogo.aggiungiNote')}</button>
								{/if}
							</div>
						</div>
					{/each}
					{#if !items.every((i) => i.product === 'campioni')}<FreeShippingBar gross={productsGrossForShip} />{/if}
					<div class="co-row"><span>{t('checkout.riepilogo.prova')}</span><b>{t('checkout.riepilogo.inclusa')}</b></div>
					<div class="co-ship">{@html t('checkout.riepilogo.spedizioneStimata', { data: express ? data.expressDate : data.shipDate })}</div>

					<label class="co-code__label" for="code">{t('checkout.riepilogo.codiceLabel')}</label>
					<div class="co-code"><input id="code" placeholder={t('checkout.riepilogo.codicePlaceholder')} bind:value={code} /><button type="button" class="btn btn--blue btn--xs" onclick={applyCode} disabled={!code}>{t('checkout.riepilogo.applica')}</button></div>
					{#if codeMsg}<small class:err={!discount}>{codeMsg}</small>{/if}
					<input type="hidden" name="discount_code" value={discount?.code ?? ''} />

					{#if data.user && data.credit > 0}
						<label class="co-credit"><input type="checkbox" name="use_credit" bind:checked={useCredit} /><img src="/images/coin-sp.png" alt="" /><span>{@html t('checkout.riepilogo.usaCredito', { importo: prezzo(data.credit) })}</span></label>
					{:else if !data.user}
						<div class="co-credit" style="cursor:default"><img src="/images/coin-sp.png" alt="" /><span>{@html t('checkout.riepilogo.registratiCredito', { href: signupHref })}</span></div>
					{/if}

					<div class="co-totals">
						<div class="co-row"><span>{t('checkout.riepilogo.subtotale')}</span><span>{mostra(subtotalGross)}</span></div>
						{#if discountAmt > 0}<div class="co-row"><span>{t('checkout.riepilogo.sconto', { codice: discount?.code ?? '' })}</span><span>−{mostra(discountAmt * VATF)}</span></div>{/if}
						{#if express}<div class="co-row"><span>{t('checkout.riepilogo.express')}</span><span>{mostra(expressNet * VATF)}</span></div>{/if}
						<div class="co-row"><span>{t('checkout.riepilogo.spedizione')}{#if shippingGross > 0 && country === 'IT' && isRemote(province)}{' '}<small>{t('checkout.riepilogo.zoneRemote')}</small>{/if}</span><span>{shippingGross > 0 ? mostra(shippingGross) : t('checkout.riepilogo.gratuita')}</span></div>
						{#if creditUsed > 0}<div class="co-row"><span>{t('checkout.riepilogo.credito')}</span><span>−{mostra(creditUsed)}</span></div>{/if}
						<div class="co-row co-row--total"><span>{t('checkout.riepilogo.totale')}</span><span>{mostra(toPay)}</span></div>
						<small class="center">{vatRate > 0 ? t('checkout.riepilogo.iva', { importo: mostra(vatAmount) }) : t('checkout.riepilogo.senzaIva')}</small>
					</div>
				</div>

				<div class="co-express">
					<h3>{t('checkout.express.titolo')}</h3>
					<p>{t('checkout.express.testo')}</p>
					<input type="checkbox" name="express" bind:checked={express} hidden />
					<button type="button" class="co-express__btn" class:is-on={express} onclick={() => (express = !express)}>{express ? t('checkout.express.attivata', { importo: mostra(Math.round(expressBase * data.expressRate * VATF * 100) / 100) }) : t('checkout.express.cta')}</button>
					<small>{t('checkout.express.nota', { pct: Math.round(data.expressRate * 100) })}{#if data.user}{t('checkout.express.notaCredito')}{/if}</small>
				</div>
			</aside>
		</form>
	{/if}
</section>
