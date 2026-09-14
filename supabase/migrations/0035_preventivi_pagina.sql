-- Preventivi: email personalizzata prima dell'invio, pagina del cliente con aperture, domande dalla pagina, sollecito automatico
alter table public.quotes
  add column if not exists sent_subject text,
  add column if not exists sent_message text,
  add column if not exists sender_name text,
  add column if not exists opened_count int not null default 0,
  add column if not exists opened_at timestamptz,
  add column if not exists pdf_downloaded_at timestamptz,
  add column if not exists auto_remind boolean not null default true,
  add column if not exists unread boolean not null default false;

-- domande del cliente dalla pagina del preventivo e nostre risposte
create table if not exists public.quote_messages (
  id bigserial primary key,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  author text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists quote_messages_quote_idx on public.quote_messages(quote_id, created_at);
alter table public.quote_messages enable row level security;
drop policy if exists "quote_messages: staff all" on public.quote_messages;
create policy "quote_messages: staff all" on public.quote_messages for all using (public.is_staff()) with check (public.is_staff());

-- modelli anche per le email dei preventivi (con oggetto)
alter table public.reply_templates
  add column if not exists kind text not null default 'supporto' check (kind in ('supporto','preventivo')),
  add column if not exists subject text;
