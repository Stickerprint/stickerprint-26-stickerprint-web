-- Accesso Gmail con l'API di Google (17/10/2026): il permesso dato da Mattia (refresh token) sta qui.
-- Nessuna policy: lo legge e lo scrive solo il server con la chiave di servizio.
create table if not exists public.posta_gmail (
  id            int primary key default 1 check (id = 1),
  email         text,
  refresh_token text,
  scope         text,
  collegato_il  timestamptz,
  errore        text
);
alter table public.posta_gmail enable row level security;
-- posta_sync: con l'API di Gmail last_uid tiene l'internalDate (ms) dell'ultima mail letta
