-- Fattura come pagina del cliente: email scritta dallo staff, scadenze pagabili online (bonifico) o solo informative (ricevuta bancaria), domande, aperture
alter table public.invoices
  add column if not exists token uuid not null default gen_random_uuid(),
  add column if not exists sent_subject text,
  add column if not exists sent_message text,
  add column if not exists sender_name text,
  add column if not exists opened_count int not null default 0,
  add column if not exists opened_at timestamptz,
  add column if not exists pdf_downloaded_at timestamptz,
  add column if not exists unread boolean not null default false;
create index if not exists invoices_token_idx on public.invoices(token);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  seq int not null,
  method text not null,
  xml_code text,
  due date not null,
  amount numeric(10,2) not null,
  payable boolean not null default true,       -- pagabile online/bonifico; false per ricevuta bancaria (addebito alla scadenza)
  status text not null default 'da_pagare' check (status in ('da_pagare','pagato','annullato')),
  paid_at timestamptz,
  provider text,
  provider_ref text,
  note text,
  created_at timestamptz not null default now(),
  unique (invoice_id, seq)
);
create table if not exists public.invoice_messages (
  id bigserial primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  author text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.invoice_payments enable row level security;
alter table public.invoice_messages enable row level security;
drop policy if exists "invoice_payments: staff all" on public.invoice_payments;
create policy "invoice_payments: staff all" on public.invoice_payments for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "invoice_payments: own read" on public.invoice_payments;
create policy "invoice_payments: own read" on public.invoice_payments for select using (exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and i.user_id = auth.uid()));
drop policy if exists "invoice_messages: staff all" on public.invoice_messages;
create policy "invoice_messages: staff all" on public.invoice_messages for all using (public.is_staff()) with check (public.is_staff());
