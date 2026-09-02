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
- Deploy: Vercel (`@sveltejs/adapter-vercel`). Variabili in `.env` (mai committare), elenco in `.env.example`.
- Route protette: `/account/*` (cliente) e `/admin/*` (staff) sono gestite in `hooks.server.ts`.

## Struttura

- `src/routes/+page.svelte` homepage (design da HOME_V4.pdf), dati in `+page.server.ts`
- `src/routes/login|signup|reset-password|logout|auth/callback` flusso auth
- `src/routes/account/` dashboard cliente (in sviluppo)
- `src/routes/admin/` dashboard interna produzione (da fare)
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
4. Pagine prodotto/configuratore, campioni, aziende, supporto, blog: da fare.
5. Dashboard cliente (ordini, prove, fatture, credito 5%): da fare.
6. Dashboard interna produzione (`/admin`): da fare.
