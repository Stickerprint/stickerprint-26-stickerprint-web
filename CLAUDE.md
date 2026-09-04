# Stickerprint — nuovo sito (contesto per Claude Code)

Sito e-commerce di adesivi personalizzati stampati in Italia. Questo repository sostituisce
progressivamente stickerprint.it (SvelteKit su Cloudflare Pages). Lingua del prodotto: italiano.

## Stack e regole

- SvelteKit 2 + Svelte 5 con runes (`$state`, `$derived`, `$props`), TypeScript strict.
- CSS custom in `src/app.css`: token (`--navy`, `--blue`, `--yellow`, `--green`, `--pink`…),
  componenti globali (`.btn`, `.tag`, `.hl` evidenziazione obliqua, `.panel`, `.card`).
  Niente Tailwind. Font: Montserrat (display/body), Rubik light per le note.
- Supabase: auth (email/password), database, storage. Client per richiesta in `src/hooks.server.ts`;
  nel browser via `data.supabase` dal layout. Lo schema è versionato in `supabase/migrations/`:
  ogni modifica al DB va scritta come nuovo file `NNNN_descrizione.sql`, mai fatta a mano nel pannello.
- Email transazionali: Postmark via `src/lib/server/email.ts` + template in `email-templates.ts`.
- Deploy: Vercel (`@sveltejs/adapter-vercel`). Variabili in `.env` (mai committare), elenco in `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` (solo server) abilita gli ordini degli ospiti nel checkout.
- Lingue/valute: struttura in `src/lib/i18n.ts` (cookie `sp-locale`, rilevamento in `hooks.server.ts`, selettore nel footer, percorsi `/en` e `/us`). Testi ancora in italiano.
- Route protette: `/account/*` (cliente) e `/admin/*` (staff) sono gestite in `hooks.server.ts`.

## Struttura

- `src/routes/+page.svelte` homepage (design da HOME_V4.pdf), dati in `+page.server.ts`
- `src/routes/login|signup|reset-password|logout|auth/callback` flusso auth
- `src/routes/checkout/` carrello (localStorage + file in IndexedDB) e ordine: prezzi ricalcolati lato server con il listino, file caricati nel bucket privato `order-files`, numerazione `SP-xxxx`
- `src/routes/account/` area personale cliente (panoramica, ordini con popup Riordina, credito, fatture, dati e indirizzi, pagamenti, recensioni). Tabelle `orders`, `invoices`, `reviews` in `supabase/migrations/0009_customer_area.sql`
- `src/routes/blog/` blog pubblico (tabelle `posts`, `post_categories`, bucket `blog-media`, migrazione 0008); gestione in `/dashboard/blog`
- `src/routes/aziende|chi-siamo|support|resi` pagine informative (testi da stickerprint.it); i form salvano in `contact_requests` (migrazione 0007)
- `src/routes/dashboard/` area amministratore (login dedicato in `/dashboard/login`, accesso solo a profili con role admin/staff)
- `src/lib/components/Configurator.svelte` preventivatore prodotto (passi dinamici: sagoma, materiale, finitura, misura, quantità). Il listino è a costi (`src/lib/pricing/engine.ts`, versione 2: materiali €/m², stampa, avvio produzione, lamina, resina, range commerciale per m² e range prezzo per quantità, markup) e arriva da `pricing_engines` (Supabase) tramite `src/lib/server/pricing.ts`; si modifica da `/dashboard/preventivatori/[slug]` (storico in `pricing_engine_history`)
- `src/lib/components/ProductPage.svelte` + `src/lib/products.ts`: pagina prodotto generica e contenuti (testi/foto) per `/adesivi-personalizzati`, `/adesivi-resinati`, `/adesivi-rilievo`, `/etichette`, `/fogli`, `/vetrofanie`
- `src/routes/dashboard/marketing/` sezione **Marketing**: la parte social curata da PERIZ Marketing (contenuti, programmazione, budget ADV, risultati di Meta, approvazioni, appuntamenti, notifiche), letta dalla dashboard `dashboard.perizmarketing.it` tramite `src/lib/server/periz.ts` con la chiave `PERIZ_API_KEY` (solo server, mai nel browser; vale solo per il brand Stickerprint). Tipi in `src/lib/marketing/tipi.ts`, formati ed etichette in `formato.ts`, stile `src/lib/styles/marketing.css` (prefisso `mk-`). Regola presa dalla dashboard: non si inventa mai un numero, ogni casella ha tre stati (caricamento, dato, non collegato) e quando un dato manca si scrive il motivo. Le azioni (approvare, programmare, budget, richieste di appuntamento, caricamento) sono form actions che chiamano la dashboard dal server; le notifiche WhatsApp all'agenzia partono da lì. Documento completo: `docs/periz-marketing.md`.
- `/dashboard/codici-sconto` gestisce `discount_codes`. Migrazione: `supabase/migrations/0003_dashboard.sql`
- `src/lib/components/EnginePreview.svelte` motore preprint in iframe; con `panel` mostra i comandi del motore sotto l'anteprima
- `src/lib/components/` Header (logo centrato e ruotato), Footer, UploadPreview
- `static/preprint/index.html` motore preprint (anteprima automatica): file unico, documentato in `docs/motore-preprint/`.
  Regola: il motore resta uno solo; nel sito è incluso in iframe con `?embed=1` e parla via postMessage (vedi il blocco "ponte per il sito" in fondo al file).
  La grafica del cliente non si butta via, mai.
- `preview/home.html` anteprima statica della home, utile per screenshot senza dev server
- `static/images`, `static/icons` asset e favicon

## Convenzioni di lavoro a più persone

- Repository: github.com/Stickerprint/stickerprint-26-stickerprint-web. Il branch `main` va su Vercel in produzione.
- Commit con autore `Claude <noreply@anthropic.com>` (`git -c user.name=Claude -c user.email=noreply@anthropic.com commit`):
  con altre email Vercel lascia il deploy in *Blocked* senza avvisare.
- Chi lavora dal browser e non dal terminale: quando serve un'azione su Supabase, Vercel o GitHub, un passaggio alla volta con il nome esatto del pulsante.
- `docs/mappa-sito-attuale.md` è la mappa delle pagine del sito attuale da rifare: riferimento per copy, listini e flussi.

- Un branch per attività (`nome/cosa`), pull request verso `main`, mai push diretto su `main`.
- File condivisi da toccare con attenzione: `src/app.css`, `Header.svelte`, `hooks.server.ts`, `app.d.ts`.
- Testi in italiano, tono diretto (vedi copy della home). Nomi di tabelle e colonne in inglese, snake_case.
- Prima di chiudere un task: `npm run check` e `npm run build` devono passare.

## Comandi

```bash
npm run dev      # http://localhost:5173
npm run check    # type check
npm run build    # build di produzione
```

## Stato e prossimi passi

1. Homepage: fatta. 2. Auth Supabase: fatta. 3. Postmark: modulo pronto, token da inserire.
4. Pagine prodotto con configuratore: fatte (6 prodotti). Aziende, chi siamo, supporto, resi, blog: fatte. Campioni e catalogo `/prodotti`: da fare.
5. Area personale cliente e programma fedeltà (Creator/Partner/Ambassador): fatti. Checkout `/checkout` con fattura PDF automatica (pdf-lib, bucket `invoices`) ed email di conferma: fatto con pagamento "Test"; carta e PayPal richiedono le chiavi Stripe/PayPal (da collegare).
6. Dashboard interna produzione (`/admin`): da fare.
