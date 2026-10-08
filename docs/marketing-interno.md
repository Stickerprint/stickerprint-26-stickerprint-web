# Area Marketing interna (dashboard)

Dall'8/10/2026 la sezione **Marketing** della dashboard è sviluppata in casa: niente più dashboard PERIZ
(il file `periz-marketing.md` resta solo perché il feed Instagram in home può ancora leggere da lì).

## Cosa c'è

| Pagina | Cosa mostra |
| --- | --- |
| `/dashboard/marketing` | **Panoramica**: tutti i canali insieme (spesa, ordini, ritorno, costo per ordine), un riquadro per canale, i consigli (campagne che rendono meglio / da spegnere / da continuare, idea di budget divisa tra i canali), spesa giorno per giorno, storico per mese |
| `/dashboard/marketing/meta` | Meta: le campagne girano su Instagram **e** Facebook, quindi una pagina sola con la spesa e i risultati divisi per piattaforma (Meta li riporta così) |
| `/dashboard/marketing/google` | Google Ads |
| `/dashboard/marketing/tiktok` | TikTok Ads |
| `/dashboard/marketing/analytics` | Google Analytics 4 (già c'era) |
| `/dashboard/marketing/impostazioni` | Obiettivi: valore medio ordine, ritorno minimo, costo massimo per ordine, tetto mensile e quote per canale, note per l'assistente |

In ogni pagina canale: numeri col confronto col periodo prima (7/14/30/90 giorni), consigli, tabella campagne con
**verdetto** (clic sul verdetto → il motivo), budget modificabile (−5/+5, "usa" per il budget consigliato), pausa/riattiva
(solo admin), spesa giorno per giorno, storico mensile.

## Come nascono i consigli

1. `src/lib/marketing/analisi.ts` — regole pure, senza rete. Per ogni campagna: **Da spingere** (rende ≥ 1,25× l'obiettivo con
   almeno 3 ordini → +25% budget), **Da continuare** (≥ 0,8×), **Da osservare** (poca spesa, o 0,5–0,8× → −20%), **Da spegnere**
   (0 ordini con spesa ≥ 3 volte il costo massimo per ordine, oppure < 0,5×), **In pausa**. Dove il canale non misura il valore
   degli ordini, il ritorno è stimato con ordini × valore medio.
   Budget: per canale somma dei budget proposti; con un tetto mensile in Impostazioni lo divide in proporzione al ritorno.
2. `src/lib/server/ads/consigli.ts` — l'assistente (Claude, `ANTHROPIC_API_KEY`, modello `MARKETING_MODEL` o `claude-sonnet-5-5`)
   scrive tre sezioni (Come sta andando / Cosa farei questa settimana / Budget) **partendo dai verdetti**, mai dal nulla.
   Il report si salva in `marketing_report` e non si rigenera a ogni apertura: bottone "Aggiorna i consigli" oppure cron del lunedì.

## Dati

- Letti al momento dalle piattaforme (`src/lib/server/ads/meta.ts`, `google.ts`, `tiktok.ts`, forma unica in `src/lib/marketing/ads-tipi.ts`), cache 60 s.
- Storico in casa: cron `/api/marketing/snapshot` alle 05:00 UTC salva ieri in `ads_giorni` (campagna per campagna); il lunedì rigenera i report.
  `?giorno=YYYY-MM-DD` rifà un giorno; `?report=1` forza i report. Chiave: `Authorization: Bearer $CRON_SECRET`.
- Migrazione `0054_marketing_interno.sql`.

## Chiavi da mettere su Vercel (Settings → Environment Variables)

Mattia salva i valori in un file e si caricano da CLI senza leggerli:
`printf 'valore' | perl -e 'alarm 60; exec @ARGV' vercel env add NOME production`.

### Meta (Instagram e Facebook)
- `META_ADS_ACCESS_TOKEN` — Business Manager → Impostazioni → Utenti → **Utenti di sistema** → crea (ruolo Amministratore) →
  **Aggiungi risorse**: l'account pubblicitario → **Genera token**: permessi `ads_read` e `ads_management`, scadenza "mai".
- `META_ADS_ACCOUNT_ID` — Gestione inserzioni, in alto a sinistra (numero, con o senza `act_`).
- facoltativa `META_API_VERSION` (default `v25.0`).
Nel pixel deve arrivare l'evento **Purchase con il valore**: altrimenti il ritorno è stimato.

### Google Ads
- `GOOGLE_ADS_DEVELOPER_TOKEN` — dall'account **amministratore** (MCC) → Strumenti → Configurazione → **Centro API**.
  All'inizio è "Accesso di prova" (legge solo account di test): va chiesto l'**Accesso Base** (modulo, qualche giorno).
- `GOOGLE_ADS_CLIENT_ID` e `GOOGLE_ADS_CLIENT_SECRET` — Google Cloud → API e servizi → Credenziali → ID client OAuth (app desktop).
- `GOOGLE_ADS_REFRESH_TOKEN` — consenso dato una volta con quell'app (scope `https://www.googleapis.com/auth/adwords`),
  con l'utente Google che ha accesso all'account.
- `GOOGLE_ADS_CUSTOMER_ID` — numero in alto a destra in Google Ads, senza trattini.
- facoltative `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (l'MCC, se l'accesso passa da lì) e `GOOGLE_ADS_API_VERSION` (default `v25`).

### TikTok Ads
- `TIKTOK_ACCESS_TOKEN` e `TIKTOK_ADVERTISER_ID` — TikTok for Business → Developer → app Marketing API, autorizzata sull'account.
  TikTok non riporta il valore degli ordini in modo affidabile: ritorno stimato.

### Assistente
- `ANTHROPIC_API_KEY` c'è già (bot). Senza chiave i verdetti escono lo stesso, manca solo il testo discorsivo.
