# PERIZ Marketing dentro il sito del cliente

Questo file e' scritto per chi lavora sul **sito e-commerce di Stickerprint**
(repo `Stickerprint/stickerprint-26-stickerprint-web`, SvelteKit + Supabase,
progetto Supabase `nhiwiwubecumxuknwxto`),
per costruire dentro la sua area riservata — quella con ordini, produzione,
fatturazione — una sezione **"Marketing"** che mostra i dati della dashboard
di PERIZ Marketing. Il cliente entra nel suo sito con il suo login e trova
anche i social: **non fa un secondo login su dashboard.perizmarketing.it**.

Va copiato nel repo del sito (come `docs/periz-marketing.md`, o incollato nel
suo CLAUDE.md). La prima meta' racconta cos'e' la dashboard e quali dati ha;
la seconda dice come si collega e cosa va fatto da una parte e dall'altra.

---

## 1. La dashboard PERIZ, in breve

`dashboard.perizmarketing.it` — React + Vite, database Supabase, funzioni
server su Vercel, deploy a ogni push su `main` del repo `periz-dashboard`.
E' lo strumento **interno** dell'agenzia: l'agenzia carica contenuti,
calendario, budget e analisi; ogni cliente (brand) ha la sua area e vede solo
la sua roba. Dal 30/8/2026 parla con Meta: legge i numeri veri di Instagram e
Facebook, pubblica i contenuti programmati, crea le sponsorizzazioni e manda
le notifiche su WhatsApp.

### Le tre aree di oggi

- **Agenzia**: Panoramica, Brand, Calendario generale, Analytics, Notifiche;
  da un brand si apre il workspace (Panoramica, Calendario, Approvazioni,
  Social, Campagne, Concorrenza, Collegamenti).
- **Cliente comune**: la stessa cosa vista dal cliente, in sola lettura piu'
  le azioni sue (approvare, chiedere appuntamenti, collegare Meta).
- **Stickerprint**: area rifatta l'1/9/2026 sui mockup, con menu
  `Panoramica · Programmazione · Budget & ADV · Contenuti · Risultati ·
  Approvazioni · Appuntamenti · Notifiche · Impostazioni`. E' l'area che va
  **riportata dentro il sito del cliente**: le schermate e i dati sono
  quelli, cambia solo la casa.

### I dati che esistono, e dove stanno

Tutto e' in Supabase (progetto della dashboard, **non** quello del sito),
una riga sempre legata a un `brand_id`.

| Cosa | Tabella / vista | Note |
| --- | --- | --- |
| Il brand e il suo cliente | `brands` (`slug`, `name`, `platforms`, `client_id`) | `client_id` e' l'utente Supabase del cliente |
| Calendario e programmazione | `activities` | contenuti con data, ora, canali, stato (`programmato`, `pubblicato`…) |
| Contenuti da approvare / coda | `content_approvals` + `approval_feedback` | file nel bucket privato `approvals`, cartella `<brand_id>/…` |
| Richieste di appuntamento | `appointment_requests` | il cliente chiede, l'agenzia conferma |
| Budget | `brand_budget_totals` (tetto), `brand_ad_budgets` (quota per canale: `meta`, `tiktok`, `google`), `brand_budget_log` (storico), `brand_manual_spend` (spesa scritta a mano, oggi solo Google) | |
| Report esportabili | `brand_reports` | archivio pdf/xlsx nel bucket |
| Notifiche | `notifications` | una riga per destinatario, `profile_id` |
| Stato del collegamento Meta | vista `brand_meta_status` | dice se il brand e' collegato; **i token non escono mai** |
| Token Meta del cliente | `brand_meta_connections` | RLS senza policy: la legge solo la chiave di servizio |
| Sponsorizzazioni | `content_boosts` | nascono sempre in pausa |
| Preventivi (solo Poolprint) | `quote_requests` | non riguarda Stickerprint |

I numeri di Instagram, Facebook e delle campagne **non stanno nel database**:
si chiedono a Meta al momento, dalle funzioni server.

### Le funzioni server (`/api` su Vercel)

| Endpoint | Cosa da' | Chi puo' chiamarla oggi |
| --- | --- | --- |
| `GET /api/social-insights` | follower, copertura, interazioni, post recenti, serie giornaliera (30 giorni) di IG + FB | admin (con `?brand_id=`), cliente (brand dalla sessione) |
| `GET /api/campaign-insights` | spesa, lead, campagne dell'account pubblicitario + `budget` del mese | admin, cliente |
| `POST /api/client-upload` | il cliente carica un contenuto suo (due fasi: permesso di scrittura, poi riga a DB) | cliente |
| `POST /api/notify` | registra un evento e manda WhatsApp (il testo lo compone il server, mai il browser) | admin, cliente, cron |
| `POST /api/meta-oauth` | collegamento dell'account Meta del cliente | cliente, admin |
| `POST /api/whatsapp-test` | messaggio di prova al proprio numero | admin, cliente |
| `publish-scheduled`, `boost-content`, `sync-competitors`, `search-competitors`, `meta-assets` | pubblicazione, sponsorizzate, concorrenza, asset del token | cron / admin, non servono al sito |

Ogni chiamata porta `Authorization: Bearer <token di sessione Supabase>`.
`chiChiama()` (`api/_lib/db.js`) legge da quel token chi e': `cron`,
`admin` o `client`, e per il cliente **rilegge il brand dal database** — il
brand non viene mai accettato dalla richiesta. E' la regola che regge tutto
l'isolamento fra clienti, e vale anche per l'integrazione descritta sotto.

### Le regole che non si toccano

1. **I dati di un cliente non escono dalla dashboard sua e dell'agenzia.**
   Non e' un filtro nel codice: e' RLS nel database, con policy su
   `brands.client_id = auth.uid()`. Ogni nuova tabella nasce con la sua policy.
2. **Niente credenziali nel browser.** Tutto cio' che tocca Meta vive in `/api`.
3. **Non si inventa mai un numero.** Ogni casella ha tre stati: caricamento,
   dato vero, *non collegato*. Quando Meta non da' una metrica si mostra un
   trattino e il motivo esatto finisce in "Pezzi che Meta non ha dato": mai
   uno zero al posto di un dato che non e' arrivato.
4. **Quando una cosa non funziona, il messaggio dice cosa andare a sistemare**,
   non "errore".
5. Etichette in italiano, valori a DB in inglese/snake_case. Date "da oggi"
   sempre con la data locale, mai `toISOString().slice(0,10)`.

---

## 2. Cosa vuole il cliente

Stickerprint ha il suo e-commerce con un'area riservata (ordini, produzione,
fatturazione) e il suo login. Vuole che **da li'** si apra anche la parte
social fatta con PERIZ: programmazione, contenuti, approvazioni, budget,
risultati. Un solo posto, un solo accesso.

Il login resta quello del sito. La dashboard PERIZ non deve chiedere
un'altra password, e il sito non deve conoscere niente delle chiavi Meta.

### Perche' non si fa con un login condiviso

Il sito e la dashboard stanno su **due progetti Supabase diversi**
(`nhiwiwubecumxuknwxto` di qua, quello della dashboard di la'). Una sessione di
uno non vale nell'altro, e unirli vorrebbe dire mettere i dati di tutti i
clienti dell'agenzia nello stesso database del sito di un cliente: e' la
cosa che la regola 1 vieta. Un iframe della dashboard dentro il sito porterebbe
comunque al secondo login, e un aspetto diverso dal resto dell'area.

### La strada scelta: il sito chiama la dashboard da server a server

```
browser del cliente ──(sessione del sito)──▶ server del sito (SvelteKit +server.ts)
                                                     │
                                       Authorization: Bearer <chiave del brand>
                                                     │
                                                     ▼
                                     dashboard.perizmarketing.it/api/…
                                                     │
                                                     ▼
                                     Supabase dashboard + Meta Graph
```

- La dashboard rilascia a Stickerprint **una chiave API legata al suo brand**
  (`brand_api_keys`), che vive nelle variabili d'ambiente del sito
  (`PERIZ_API_KEY`), mai nel browser.
- Il server del sito, **dopo** aver verificato che chi chiede e' un utente
  con diritto (l'admin di Stickerprint nel loro Supabase), chiama gli
  endpoint della dashboard con quella chiave e passa la risposta alla pagina.
- La dashboard riconosce la chiave in `chiChiama()` come quarto tipo di
  chiamante, `partner`, con il `brandId` letto dalla tabella: esattamente come
  per il cliente, il brand non arriva dalla richiesta. Un sito con la chiave
  di Stickerprint non puo' chiedere niente di Poolprint, nemmeno cambiando
  la chiamata a mano.
- Chi ha diritto di vedere la sezione Marketing lo decide **il sito**, con i
  suoi ruoli (deciso il 4/9: `admin` e `staff`, come tutto `/dashboard`):
  per la dashboard esiste solo "il brand Stickerprint".

La chiave si genera e si revoca dalla scheda **Collegamenti** del workspace
del brand, nell'area agenzia. In tabella sta solo l'hash (sha256): la chiave
in chiaro si vede una volta, quando viene creata, e va incollata su Vercel
del sito. Si tiene `last_used_at` per vedere se e' viva, e `revoked_at` per
spegnerla senza cancellare la storia.

---

## 3. Le due fasi

### Un endpoint solo per i dati: `/api/partner`

Il piano Hobby di Vercel accetta al massimo dodici funzioni, e la dashboard
ne aveva undici: tutto quello che il sito legge e fa passa da **un endpoint
solo**, smistato dal parametro `cosa`. I numeri di Meta restano sui loro
endpoint, che riconoscono la chiave come riconoscono il cliente.

| Cosa | Chiamata | Risposta / effetto |
| --- | --- | --- |
| Il brand e lo stato Meta | `GET /api/partner?cosa=brand` | `brand {id, slug, name, platforms}`, `meta {collegato, pagina, instagram, accountPubblicitario, last_error}` |
| Social (30 giorni) | `GET /api/social-insights` | `kpi`, `trend`, `serieGiorni`, `canali`, `serieFollower`, `engagement`, `contenuti`, `instagram`, `facebook`, `avvisi`; oppure `collegato:false` con `motivo` |
| Campagne e budget del mese | `GET /api/campaign-insights` | `kpi`, `serie`, `campagne`, `budget` (tetto, quote, spesa del mese), `avvisi` |
| Contenuti (coda, approvazioni, programmazione) | `GET /api/partner?cosa=contenuti` | `contenuti[]` (ogni riga con `url` firmato per un'ora e `media`), `commenti[]`, `conteggi` |
| Calendario | `GET /api/partner?cosa=attivita&da=YYYY-MM-DD&a=YYYY-MM-DD` | `attivita[]` |
| Appuntamenti | `GET /api/partner?cosa=appuntamenti` | `appuntamenti[]` (riprese e incontri dal calendario), `richieste[]`, `etichette` |
| Budget & ADV | `GET /api/partner?cosa=budget` | `budget` (tetto, canali, mese, spesa a mano), `quote[]`, `movimenti[]`, `etichette.obiettivi` |
| Notifiche | `GET /api/partner?cosa=notifiche&limite=50` | `notifiche[]`, `nonLette`, `whatsapp {numero, attivo, nome}` |
| Report | `GET /api/partner?cosa=report` | `report[]`, `etichette.tipi` |

Le azioni sono `POST /api/partner` con corpo JSON `{ cosa, azione, ... }`:

| `cosa` | `azione` | Campi | Cosa scatta in dashboard |
| --- | --- | --- | --- |
| `contenuti` | `approva` | `id` | stato `approvato`, WhatsApp all'agenzia (`contenuto_approvato`) |
| `contenuti` | `modifiche` | `id`, `messaggio` | commento in `approval_feedback`, stato `modifiche_richieste`, WhatsApp |
| `contenuti` | `programma` | `id`, `data`, `ora`, `didascalia`, `piattaforme[]`, `conferma` | `conferma:true` → stato `programmato` e pubblicazione automatica alla data/ora; `false` → bozza in coda |
| `contenuti` | `annulla_programmazione` | `id` | torna in coda |
| `contenuti` | `budget` | `id`, `budget`, `split {instagram,tiktok,facebook}`, `obiettivo` | budget sul contenuto, riga nello storico, WhatsApp (`budget_assegnato`); rifiuta se supera la quota mensile |
| `contenuti` | `rimuovi_budget` | `id` | |
| `appuntamenti` | `richiedi` | `tipo`, `data`, `fascia`, `note` | riga in `appointment_requests`, WhatsApp (`richiesta_appuntamento`) |
| `budget` | `mensile` | `meta`, `tiktok` | quote mensili per piattaforma, storico; rifiuta se superano il tetto del brand |
| `notifiche` | `letta` / `tutte_lette` | `id` | |
| `notifiche` | `whatsapp` | `numero`, `attivo` | numero WhatsApp del cliente per le notifiche |
| `report` | `crea` | `tipo`, `piattaforme[]`, `sezioni[]`, `da`, `a` | riga in `brand_reports` |

Caricare un contenuto dal sito: `POST /api/client-upload` in due fasi
(`fase:'inizio'` con `nome_file` → `path` + `token`; il browser manda il file a
Supabase Storage della dashboard con `uploadToSignedUrl`; `fase:'fine'` con
`path`, `titolo`, `tipo`, `piattaforme`). Il token firmato si può passare al
browser: vale per quel solo percorso e per pochi minuti.

Ogni risposta ha `ok`; quando `ok:false` c'è `errore`, scritto per essere
letto da una persona (dice cosa sistemare). `avviso` è un dato parziale, non
un fallimento. Le risposte di Meta hanno tre stati: `collegato:false` con
`motivo` non è un errore, è configurazione che manca.

Le pagine dell'area Stickerprint (`src/pages/client/sp/*.jsx` +
`src/lib/spDati.js`) sono la traccia di cosa mostrare: periodi, formati di
data e numeri in italiano sono logica da **riscrivere** nel sito, non da
importare (nessun codice condiviso fra i due progetti, deciso il 29/8).

## 4. Lato dashboard (`periz-dashboard`): fatto il 4/9/2026

- `docs/sql/2026-09-04-chiavi-api-sito-cliente.sql`: tabella
  `brand_api_keys` (solo impronta sha256, RLS senza policy). **Da eseguire in
  Supabase** prima di creare la prima chiave.
- `chiChiama()` riconosce le chiavi `pk_…` come chiamante `partner`, con il
  brand dalla tabella; `perche()` dice cosa sistemare se la chiave è
  sconosciuta o revocata.
- `social-insights`, `campaign-insights` e `client-upload` accettano il
  partner come il cliente.
- `api/partner.js` + `api/_lib/partner.js`: tutte le letture e le azioni della
  tabella sopra, con le notifiche che partono dal server.
- Scheda **Collegamenti** del brand: riquadro "Chiavi per il sito del
  cliente" con **Crea chiave** (la mostra una volta) e **Revoca**, più
  l'ultimo uso di ogni chiave.

L'area Stickerprint su `dashboard.perizmarketing.it` **non si spegne**: resta
come accesso di riserva e come riferimento visivo, e l'account cliente di
Mattia continua a funzionare. Gli altri brand (Poolprint) non cambiano.

## 5. Cosa va fatto dalla parte del sito (`stickerprint-26-stickerprint-web`)

Letto dal repo il 4/9/2026: la dashboard interna sta in `/dashboard/*`
(login dedicato in `/dashboard/login`, profili con ruolo `admin` o `staff`),
il menu e' a gruppi in `src/routes/dashboard/+layout.svelte`, e **il gruppo
"Marketing" con la voce "Panoramica" esiste gia'**: `/dashboard/marketing`
mostra il componente `Soon` ("Questa sezione la configuriamo piu' avanti").
E' li' che si aggancia tutto. Le regole del repo: SvelteKit 2 + Svelte 5 con
runes, CSS in `src/app.css` (token `--navy`, `--blue`, `--yellow`…, classi
`.panel`, `.card`, `.btn`), un branch per attivita' e pull request verso
`main`, `npm run check` + `npm run build` prima di chiudere.

1. Variabili d'ambiente **solo server**, da aggiungere a `.env.example`:
   `PERIZ_API_URL` (`https://dashboard.perizmarketing.it`) e
   `PERIZ_API_KEY`. In SvelteKit si leggono da `$env/dynamic/private`, mai
   da `$env/*/public`.
2. Un modulo `src/lib/server/periz.ts` (accanto a `email.ts` e
   `pricing.ts`) con una sola funzione che aggiunge la chiave, chiama la
   dashboard e rilancia `errore` / `avviso` cosi' come arrivano: sono gia'
   scritti per essere letti da una persona.
3. Le pagine sotto `src/routes/dashboard/marketing/` con i dati caricati in
   `+page.server.ts` (il controllo della sessione e del ruolo lo fa gia'
   `hooks.server.ts` per tutto `/dashboard`). Nessuna chiamata alla dashboard
   dal browser: niente CORS da aprire, niente chiave che gira. Le azioni
   della fase 2 sono `actions` di form o `+server.ts`, sempre lato server.
4. Il gruppo "Marketing" del menu cresce con le voci dell'area Stickerprint:
   Panoramica, Programmazione, Budget & ADV, Contenuti, Risultati,
   Approvazioni, Appuntamenti. Tre stati per ogni casella (caricamento,
   dato, non collegato); trattino e motivo quando manca un dato.
5. Una piccola memoria lato server delle risposte di Meta (un minuto), come
   fa la dashboard: un giro di domande a Meta dura qualche secondo, e
   rifarlo a ogni clic di menu si sente.
6. **`INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_USER_ID`**, oggi in
   `.env.example` del sito, **non vanno usati per questa sezione**: i numeri
   di Instagram arrivano dalla dashboard, che ha gia' il token del brand e
   la firma `appsecret_proof`. Due sistemi che chiedono a Meta la stessa
   cosa sono due token da rinnovare e due posti dove i numeri possono non
   tornare. Se servono per altro (il feed Instagram in home), restano per
   quello.

## 6. Cosa serve da Luca, un passaggio alla volta

1. ~~Chi vede la voce Marketing~~ — deciso il 4/9/2026: la vedono tutti i
   profili `admin` e `staff`, come il resto di `/dashboard`. Nessun
   controllo in piu' dentro `marketing/*`.
2. Quando la scheda Collegamenti avra' il riquadro: **Crea chiave** sul
   brand Stickerprint, copiarla, e incollarla su Vercel del sito come
   `PERIZ_API_KEY` (Settings → Environment Variables → Add).
3. Fase 1 prima di fase 2: vedere i numeri veri nel sito, poi spostare le
   azioni.

## 7. Cose da sapere prima di iniziare

- Il codice che parla con Meta ha iniziato a girare davvero solo dopo il
  30/8/2026: sui nomi delle metriche Instagram Meta cambia spesso, e quando
  una casella resta vuota il motivo sta nel riquadro "Pezzi che Meta non ha
  dato". Nel sito va mostrato allo stesso modo, non nascosto.
- Stickerprint oggi in dashboard non ha un tetto di budget (`brand_budget_totals`),
  solo la divisione per piattaforma: `budget.totale` puo' arrivare vuoto.
- TikTok non e' collegato a niente: e' un canale nel calendario, non un dato.
- L'app Meta e' ancora nel portfolio Poolprint (sistemazione temporanea):
  finche' non nasce il portfolio aziendale PERIZ, il collegamento Meta di
  Stickerprint passa dal login Facebook del cliente con un ruolo di tester
  nell'app. Non riguarda il sito, ma spiega perche' `collegato` puo' essere
  falso per un po'.
- Regola per tutti e due i progetti: **l'autore dei commit e'
  `Claude <noreply@anthropic.com>`**, altrimenti Vercel lascia il deploy in
  *Blocked* senza dirlo.
