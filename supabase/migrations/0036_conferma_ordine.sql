-- Conferma d'ordine come pagina del cliente: email scritta dallo staff, pagina con scadenze e pagamento, domande, aperture.
-- Stato "in attesa di pagamento": le scadenze anticipate vanno incassate prima di produrre.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione', 'attesa_pagamento',
  'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato'));

create table if not exists public.order_confirmations (
  checkout_group uuid primary key,
  token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  sent_subject text,
  sent_message text,
  sender_name text,
  opened_count int not null default 0,
  opened_at timestamptz,
  pdf_downloaded_at timestamptz,
  unread boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists order_confirmations_token_idx on public.order_confirmations(token);

-- una riga per scadenza: le anticipate si pagano online (o con bonifico) prima della produzione
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  checkout_group uuid not null,
  seq int not null,
  method text not null,
  due date not null,
  amount numeric(10,2) not null,
  upfront boolean not null default false,
  status text not null default 'da_pagare' check (status in ('da_pagare','pagato','annullato')),
  paid_at timestamptz,
  provider text,
  provider_ref text,
  note text,
  created_at timestamptz not null default now(),
  unique (checkout_group, seq)
);
create index if not exists order_payments_group_idx on public.order_payments(checkout_group);

create table if not exists public.order_messages (
  id bigserial primary key,
  checkout_group uuid not null,
  direction text not null check (direction in ('in','out')),
  kind text not null default 'domanda' check (kind in ('domanda','errore','risposta')),
  author text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_messages_group_idx on public.order_messages(checkout_group, created_at);

alter table public.order_confirmations enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_messages enable row level security;
drop policy if exists "order_confirmations: staff all" on public.order_confirmations;
create policy "order_confirmations: staff all" on public.order_confirmations for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "order_payments: staff all" on public.order_payments;
create policy "order_payments: staff all" on public.order_payments for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "order_messages: staff all" on public.order_messages;
create policy "order_messages: staff all" on public.order_messages for all using (public.is_staff()) with check (public.is_staff());
-- il cliente registrato vede le proprie scadenze
drop policy if exists "order_payments: own read" on public.order_payments;
create policy "order_payments: own read" on public.order_payments for select using (exists (select 1 from public.orders o where o.checkout_group = order_payments.checkout_group and o.user_id = auth.uid()));
