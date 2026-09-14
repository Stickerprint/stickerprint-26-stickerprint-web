-- Richieste aziende → preventivi → ordine; helpdesk (ticket con conversazione) per supporto, resi e lamentele.

-- Richieste aziendali: stati del percorso commerciale, lettura, note interne, collegamenti
alter table public.contact_requests drop constraint if exists contact_requests_status_check;
alter table public.contact_requests add constraint contact_requests_status_check check (status in ('new','in_progress','quoted','won','lost','closed'));
alter table public.contact_requests
  add column if not exists read_at timestamptz,
  add column if not exists notes text,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists quote_id uuid,
  add column if not exists ticket_id uuid;

-- Preventivi (stessa bozza dell'editor ordini: cliente, righe, scadenze), numerazione SPP00001 che riparte ogni anno
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  seq int not null,
  number text not null,
  version int not null default 1,
  parent_id uuid references public.quotes(id) on delete set null,
  request_id uuid references public.contact_requests(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'bozza' check (status in ('bozza','inviato','accettato','rifiutato','scaduto','ordinato')),
  draft jsonb not null,
  total_net numeric(10,2) not null default 0,
  total_gross numeric(10,2) not null default 0,
  valid_until date,
  sent_at timestamptz,
  reminded_at timestamptz,
  accepted_at timestamptz,
  accepted_by text,
  rejected_reason text,
  order_group uuid,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, seq, version)
);
create index if not exists quotes_status_idx on public.quotes(status, created_at desc);
create index if not exists quotes_token_idx on public.quotes(token);
alter table public.quotes enable row level security;
drop policy if exists "quotes: staff all" on public.quotes;
create policy "quotes: staff all" on public.quotes for all using (public.is_staff()) with check (public.is_staff());

-- Helpdesk: ticket e messaggi (in = dal cliente, out = nostra risposta via email, note = nota interna)
create sequence if not exists public.ticket_seq;
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('HD' || lpad(nextval('public.ticket_seq')::text, 5, '0')),
  kind text not null default 'domanda' check (kind in ('domanda','problema','lamentela','reso','altro')),
  status text not null default 'nuovo' check (status in ('nuovo','in_carico','attesa_cliente','risolto','chiuso')),
  name text,
  email text not null,
  phone text,
  order_number text,
  subject text,
  complaint_reason text,
  contact_id uuid references public.contacts(id) on delete set null,
  request_id uuid references public.contact_requests(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  unread boolean not null default true,
  assigned text,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_status_idx on public.tickets(status, last_message_at desc);
create index if not exists tickets_token_idx on public.tickets(token);
create table if not exists public.ticket_messages (
  id bigserial primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  direction text not null check (direction in ('in','out','note')),
  author text,
  body text not null,
  file_path text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages(ticket_id, created_at);
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
drop policy if exists "tickets: staff all" on public.tickets;
create policy "tickets: staff all" on public.tickets for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tickets: anyone insert" on public.tickets;
create policy "tickets: anyone insert" on public.tickets for insert with check (true);
drop policy if exists "ticket_messages: staff all" on public.ticket_messages;
create policy "ticket_messages: staff all" on public.ticket_messages for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "ticket_messages: anyone insert" on public.ticket_messages;
create policy "ticket_messages: anyone insert" on public.ticket_messages for insert with check (true);

-- Risposte pronte per l'helpdesk
create table if not exists public.reply_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reply_templates enable row level security;
drop policy if exists "reply_templates: staff all" on public.reply_templates;
create policy "reply_templates: staff all" on public.reply_templates for all using (public.is_staff()) with check (public.is_staff());
insert into public.reply_templates (title, body, sort) values
  ('Tempi di produzione', 'Ciao, grazie per averci scritto. I tempi di produzione sono di 3-5 giorni lavorativi dall''approvazione dell''anteprima, più 1-2 giorni di corriere. Se hai una scadenza precisa dicci la data e vediamo come arrivarci.', 1),
  ('File di stampa', 'Ciao, per una stampa perfetta ci serve il file in PDF, AI, EPS o PNG ad alta risoluzione (almeno 300 dpi alla misura finale). Se il file non è adatto lo sistemiamo noi e ti mandiamo l''anteprima prima di stampare.', 2),
  ('Stato dell''ordine', 'Ciao, il tuo ordine è in lavorazione: appena parte ricevi l''email con il tracking del corriere. Puoi seguirlo in ogni momento dalla tua area personale.', 3),
  ('Problema sulla consegna', 'Ciao, ci dispiace per il disagio. Abbiamo aperto subito una verifica con il corriere e ti aggiorniamo entro un giorno lavorativo. Se il pacco risulta danneggiato, mandaci una foto e ristampiamo senza costi.', 4)
on conflict do nothing;

-- Le richieste di supporto e i resi già ricevuti diventano ticket
insert into public.tickets (kind, status, name, email, phone, order_number, subject, request_id, unread, last_message_at, created_at)
select case when r.kind = 'reso' then 'reso' else 'domanda' end,
       case r.status when 'closed' then 'chiuso' when 'in_progress' then 'in_carico' else 'nuovo' end,
       r.name, r.email, r.phone, r.order_number, left(r.message, 80), r.id, r.status = 'new', r.created_at, r.created_at
from public.contact_requests r
where r.kind in ('support','reso') and not exists (select 1 from public.tickets t where t.request_id = r.id);
insert into public.ticket_messages (ticket_id, direction, author, body, file_path, created_at)
select t.id, 'in', coalesce(r.name, r.email), r.message, r.file_path, r.created_at
from public.tickets t join public.contact_requests r on r.id = t.request_id
where not exists (select 1 from public.ticket_messages m where m.ticket_id = t.id);
update public.contact_requests r set ticket_id = t.id from public.tickets t where t.request_id = r.id and r.ticket_id is null;
