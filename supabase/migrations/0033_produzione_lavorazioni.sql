-- Produzione a lavorazioni: ogni riga d'ordine e' una commessa con una coda di lavorazioni
-- (percorso per prodotto), pianificate a ritroso dalla data di spedizione promessa.
alter table public.orders
  add column if not exists ship_by date,                 -- data di spedizione promessa (ritiro corriere alle 17:00)
  add column if not exists proof_sent_at timestamptz,    -- quando l'anteprima e' stata inviata al cliente
  add column if not exists proof_reminded_at timestamptz,-- ultimo sollecito di approvazione
  add column if not exists reprints int not null default 0;

create table if not exists public.production_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seq int not null,
  stage text not null,                       -- reparto/coda: stampa, plastifica, taglio, resinatura, controllo, confezionamento
  label text not null,                       -- nome della lavorazione (Stampa, Colata resina, Maturazione...)
  machine text,                              -- macchina o banco assegnato
  minutes int not null default 0,            -- durata prevista di lavoro (minuti)
  wait_minutes int not null default 0,       -- tempo di attesa in calendario (es. maturazione della resina)
  status text not null default 'da_fare' check (status in ('da_fare','pronto','in_corso','bloccato','completato')),
  due_at timestamptz,                        -- scadenza della fase (pianificazione a ritroso)
  started_at timestamptz,
  completed_at timestamptz,
  operator text,
  block_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_tasks_order_idx on public.production_tasks(order_id, seq);
create index if not exists production_tasks_status_idx on public.production_tasks(status, stage);

create table if not exists public.production_events (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  task_id uuid references public.production_tasks(id) on delete set null,
  kind text not null,                        -- pianificata, iniziata, completata, bloccata, sbloccata, ristampa, data_spostata, sollecito, macchina, nota
  detail text,
  operator text,
  created_at timestamptz not null default now()
);
create index if not exists production_events_order_idx on public.production_events(order_id, created_at desc);

alter table public.production_tasks enable row level security;
alter table public.production_events enable row level security;
drop policy if exists "production_tasks: staff all" on public.production_tasks;
create policy "production_tasks: staff all" on public.production_tasks for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "production_events: staff all" on public.production_events;
create policy "production_events: staff all" on public.production_events for all using (public.is_staff()) with check (public.is_staff());
-- il cliente vede l'avanzamento della propria commessa (solo lettura)
drop policy if exists "production_tasks: own read" on public.production_tasks;
create policy "production_tasks: own read" on public.production_tasks for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
