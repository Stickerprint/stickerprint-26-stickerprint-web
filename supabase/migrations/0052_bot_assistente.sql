-- Assistente automatico (bot) su Instagram / WhatsApp / sito: una conversazione per cliente e canale,
-- con lo storico nel formato del modello (history) e quello leggibile per la dashboard (chat).
create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('instagram', 'whatsapp', 'facebook', 'sito')),
  external_id text not null,                 -- id utente Instagram, numero WhatsApp, sessione del sito
  name text,                                 -- nome del profilo, se il canale lo passa
  history jsonb not null default '[]'::jsonb,
  chat jsonb not null default '[]'::jsonb,   -- [{da:'cliente'|'bot', testo, ora, strumenti?}]
  handed_off boolean not null default false, -- passata a Mattia (ticket aperto)
  ticket_number text,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create index if not exists bot_conversations_last_at on public.bot_conversations (last_at desc);
-- messaggi già elaborati (Meta rimanda lo stesso evento se non riceve 200 in fretta)
create table if not exists public.bot_seen (
  id text primary key,
  at timestamptz not null default now()
);
alter table public.bot_conversations enable row level security;
alter table public.bot_seen enable row level security;
-- solo il server (chiave di servizio) scrive; lo staff legge dalla dashboard
drop policy if exists "staff legge le conversazioni del bot" on public.bot_conversations;
create policy "staff legge le conversazioni del bot" on public.bot_conversations for select
  using (public.is_staff());
