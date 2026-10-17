-- Posta in arrivo (17/10/2026): il sito legge la casella mattia@stickerprint.it via IMAP (password per le app di Google)
-- alle 9 e alle 15, salva qui ogni mail nuova con gli allegati (bucket posta-in), riconosce ordini e richieste di
-- preventivo e li inserisce in dashboard (src/lib/server/posta/). Il webhook Postmark Inbound resta come alternativa.

create table if not exists public.posta_in (
  id              uuid primary key default gen_random_uuid(),
  message_id      text unique,                      -- MessageID di Postmark
  mail_id         text,                             -- header Message-ID originale della mail
  ricevuta_il     timestamptz not null default now(),
  data_mail       timestamptz,
  mittente_email  text not null,
  mittente_nome   text,
  destinatari     text[] not null default '{}',
  oggetto         text,
  testo           text,
  html            text,
  allegati        jsonb not null default '[]',      -- [{nome, tipo, byte, path}] nel bucket posta-in
  stato           text not null default 'nuova' check (stato in ('nuova','ordine','preventivo','altro','ignorata','errore')),
  contact_id      uuid references public.contacts (id) on delete set null,
  esito           jsonb,                            -- cosa ha capito e cosa ha fatto: righe, ordine, richiesta, blocchi
  elaborata_il    timestamptz,
  errore          text,
  note            text
);
create index if not exists posta_in_stato on public.posta_in (stato, data_mail desc);
create index if not exists posta_in_data on public.posta_in (data_mail desc);
alter table public.posta_in enable row level security;
create policy "posta: staff legge" on public.posta_in for select using (public.is_staff());
create policy "posta: staff scrive" on public.posta_in for update using (public.is_staff()) with check (public.is_staff());
-- l'inserimento lo fa solo il webhook con la chiave di servizio

-- i domini email di un cliente: chiunque scriva da @metrica.it e' Metrica (i domini generici tipo gmail.com non si mettono)
alter table public.contacts add column if not exists domini text[] not null default '{}';
update public.contacts set domini = array['metrica.it'] where vat = '00584770242' and domini = '{}';
update public.contacts set email = coalesce(email, 'comaplast@hotmail.it') where vat = '05545430968';

-- dove e' arrivata la lettura IMAP: l'ultimo UID letto nella INBOX (UIDVALIDITY cambia se Google ricrea la casella)
create table if not exists public.posta_sync (
  id            int primary key default 1 check (id = 1),
  uid_validity  bigint,
  last_uid      bigint not null default 0,
  letta_il      timestamptz,
  errore        text
);
insert into public.posta_sync (id) values (1) on conflict do nothing;
alter table public.posta_sync enable row level security;
create policy "posta sync: staff legge" on public.posta_sync for select using (public.is_staff());

insert into storage.buckets (id, name, public) values ('posta-in', 'posta-in', false) on conflict (id) do nothing;
drop policy if exists "posta in: staff legge" on storage.objects;
create policy "posta in: staff legge" on storage.objects for select using (bucket_id = 'posta-in' and public.is_staff());
