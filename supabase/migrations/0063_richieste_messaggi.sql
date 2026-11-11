-- Richieste aziende: risposte scritte dalla dashboard (7/11/2026, Mattia: "rispondere direttamente dal sito,
-- come nelle richieste di aiuto"). Ogni risposta esce via email al cliente e resta qui come storico.
create table if not exists public.request_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  direction  text not null default 'out' check (direction in ('out', 'note')),
  author     text,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists request_messages_request_idx on public.request_messages (request_id, created_at);
alter table public.request_messages enable row level security;
drop policy if exists "request_messages: staff all" on public.request_messages;
create policy "request_messages: staff all" on public.request_messages for all using (public.is_staff()) with check (public.is_staff());
alter table public.contact_requests add column if not exists replied_at timestamptz;
-- 11/11/2026: allegati delle risposte (elenco {path, name, size, type} nel bucket requests). Tutto il file si puo' rieseguire.
alter table public.request_messages add column if not exists files jsonb;
