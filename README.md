# Stickerprint — nuovo sito

SvelteKit 2 + Svelte 5, Supabase (auth + dati), Postmark (email), deploy su Vercel.

## Struttura

```
src/
├── app.css                      design system (token colore/tipografia + componenti)
├── app.html                     shell HTML, favicon, Google Fonts (Montserrat, Rubik)
├── hooks.server.ts              client Supabase per richiesta, protezione /account e /admin, header di sicurezza
├── lib/
│   ├── components/              Header (logo centrato e ruotato), Footer, UploadPreview (anteprima drag&drop)
│   ├── server/email.ts          invio email via API Postmark
│   ├── server/email-templates.ts  template brand: benvenuto, password cambiata, richieste supporto/aziende, notifiche interne
│   └── utils/shipping.ts        data di spedizione stimata (giorni lavorativi)
└── routes/
    ├── +page.svelte             HOMEPAGE (da HOME_V4.pdf)
    ├── +page.server.ts          recensioni e statistiche reali da Supabase, data spedizione
    ├── login / signup / reset-password / logout / auth/callback   flusso auth Supabase
    ├── account/                 bozza dashboard cliente (protetta)
    ├── account/password         cambio password
    └── api/send-email           endpoint POST per email transazionali
preview/home.html                anteprima statica della home (senza Node): python3 -m http.server 8788
static/images                    asset estratti dal PDF (pila adesivi, card credito, foto Instagram) + logo
static/icons                     favicon generate dal logo
```

## Avvio in locale

Serve Node.js 20+ (https://nodejs.org).

```bash
npm install
cp .env.example .env   # poi compila le chiavi
npm run dev
```

## Variabili d'ambiente

| Nome | Dove trovarla |
| --- | --- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `PUBLIC_SITE_URL` | URL pubblico del sito (usato nei link delle email e nei redirect auth) |
| `POSTMARK_SERVER_TOKEN` | Postmark → Server → API Tokens |
| `POSTMARK_FROM` | mittente verificato in Postmark (Sender Signature o dominio) |
| `POSTMARK_MESSAGE_STREAM` | di solito `outbound` |
| `OWNER_NOTIFY_EMAIL` | casella che riceve richieste e notifiche interne |
| `INTERNAL_API_KEY` | stringa casuale per chiamare `/api/send-email` da automazioni |

## Supabase: cose da impostare

1. **Authentication → URL Configuration**: aggiungi `https://<dominio>/auth/callback` (e `http://localhost:5173/auth/callback`) ai Redirect URLs; Site URL = dominio pubblico.
2. **Authentication → Email Templates**: nei template "Confirm signup" e "Reset password" usa il link `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (signup) e `...&type=recovery` (reset), così il rientro passa dal nostro endpoint.
3. (Consigliato) **Authentication → SMTP Settings**: inserisci le credenziali SMTP di Postmark (host `smtp.postmarkapp.com`, user e password = Server Token) così anche le email di sistema di Supabase partono da Postmark con il dominio stickerprint.it.

## Postmark

- Verifica il dominio `stickerprint.it` (DKIM + Return-Path) in Postmark → Sender Signatures.
- Crea un Message Stream transazionale (`outbound`) e prendi il Server Token.
- Test rapido con il server in esecuzione:

```bash
curl -X POST http://localhost:5173/api/send-email -H 'Content-Type: application/json' -H "x-internal-key: $INTERNAL_API_KEY" -d '{"type":"owner-notify","title":"Test Postmark","lines":["Funziona"]}'
```

## Deploy su Vercel

Opzione A (consigliata): collega il repository Git su https://vercel.com/new, framework "SvelteKit", aggiungi le variabili d'ambiente, deploy automatico a ogni push.

Opzione B (CLI):

```bash
npm i -g vercel
vercel login
vercel --prod
```

Quando si vorrà spostare il dominio: su Vercel → Project → Domains aggiungi `stickerprint.it` e aggiorna il record DNS su Cloudflare (CNAME verso `cname.vercel-dns.com`, proxy disattivato o DNS-only).

## Prossimi passi

- Pagine prodotto/configuratore, campioni, aziende, supporto, blog
- Dashboard cliente completa (ordini, prove di stampa, fatture, credito 5%)
- Dashboard interna di produzione (/admin)
- Checkout con Stripe/PayPal e spedizioni Qapla (già in uso nel sito attuale)
