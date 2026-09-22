-- Produzione, versione 2 (22/09/2026): macchinari configurabili, commesse per ordine, calendario di lavoro,
-- fasi con macchinario assegnato e pianificazione. Niente magazzino, niente approvazioni.
-- Le tabelle production_tasks (fasi) e production_events (cronologia) restano: si estendono.

-- ---------- MACCHINARI ----------
create table if not exists public.production_machines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- codice interno (es. SG3-1)
  name text not null,
  brand text,
  model text,
  machine_type text not null,                      -- stampante_ecosolvente, stampante_uv, laminatrice, plotter_taglio, resinatrice (aperto a nuovi tipi)
  department text not null,                        -- stampa, laminazione, taglio, resinatura
  usable_width_mm int,                             -- larghezza utile (null = non nota)
  is_active boolean not null default true,
  archived_at timestamptz,                         -- archiviato: resta nella cronologia, non riceve lavori
  setup_minutes int,                               -- tempo fisso di preparazione
  sqm_per_hour numeric,                            -- metri quadrati all'ora (stampa, laminazione, taglio)
  minutes_per_sqm numeric,                         -- in alternativa: minuti per metro quadrato
  pieces_per_hour numeric,                         -- resinatrice: pezzi all'ora
  minutes_per_piece numeric,                       -- in alternativa: minuti per pezzo
  cleanup_minutes int,                             -- tempo di pulizia finale (resinatrice)
  passive_minutes int,                             -- tempo passivo (maturazione resina, asciugatura): calendario, non occupa la macchina
  waste_coefficient numeric,                       -- coefficiente di scarto/occupazione sull'area (es. 1.15)
  capabilities text[] not null default '{}',       -- lavorazioni che sa fare: stampa_ecosolvente, stampa_uv, laminazione, taglio, resinatura
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- profili di velocita' per prodotto / qualita' / materiale (facoltativi: senza profilo valgono i parametri della macchina)
create table if not exists public.production_machine_profiles (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.production_machines(id) on delete cascade,
  name text not null,
  product_slug text,                               -- null = tutti i prodotti
  quality text,                                    -- es. standard, alta (libero)
  material text,                                   -- es. bianco, trasparente (libero)
  capability text,                                 -- lavorazione a cui si applica (null = tutte quelle della macchina)
  sqm_per_hour numeric,
  minutes_per_sqm numeric,
  minutes_per_piece numeric,
  setup_minutes int,
  coefficient numeric,                             -- moltiplicatore sulla durata (es. complessita' del taglio)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists production_machine_profiles_machine_idx on public.production_machine_profiles(machine_id);

-- ---------- CALENDARIO DI LAVORO (una riga) ----------
create table if not exists public.production_calendar (
  id int primary key default 1 check (id = 1),
  timezone text not null default 'Europe/Rome',
  working_days int[] not null default '{1,2,3,4,5}',   -- 1 = lunedi' ... 7 = domenica
  open_time time not null default '08:30',
  close_time time not null default '17:30',
  break_start time,                                    -- pausa (facoltativa)
  break_end time,
  ship_cutoff time not null default '17:00',           -- ritiro del corriere
  ship_margin_minutes int not null default 60,         -- margine prima del ritiro
  orange_threshold_minutes int not null default 240,   -- sotto questo margine: TIGHT (arancione)
  holidays date[] not null default '{}',               -- festivita' (oltre a quelle fisse italiane, che il codice conosce)
  closures jsonb not null default '[]',                -- chiusure aziendali: [{"from":"2026-08-10","to":"2026-08-23","label":"Ferie"}]
  updated_at timestamptz not null default now()
);
insert into public.production_calendar (id) values (1) on conflict (id) do nothing;

-- ---------- COMMESSE (una per ordine = checkout_group) ----------
create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  checkout_group text not null unique,             -- idempotenza: un pagamento (o un webhook ripetuto) non crea due commesse
  order_number text not null,
  promised_ship_date date not null,                -- SNAPSHOT della data mostrata al cliente: la produzione non la tocca
  status text not null default 'READY_TO_START' check (status in ('READY_TO_START','IN_PROGRESS','WAITING_PASSIVE_TIME','READY_FOR_PACKAGING','PACKAGING','COMPLETED','CANCELLED')),
  paid_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  -- campi calcolati dal pianificatore
  latest_start_at timestamptz,                     -- ultimo avvio utile della commessa
  estimated_packaging_at timestamptz,              -- fine confezionamento prevista
  total_minutes int not null default 0,            -- lavoro attivo totale
  slack_minutes int,                               -- margine (minuti di lavoro) rispetto alla spedizione
  predicted_delay_minutes int not null default 0,  -- di quanto la previsione supera la spedizione
  risk_status text not null default 'ON_TRACK' check (risk_status in ('ON_TRACK','TIGHT','AT_RISK','LATE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_jobs_status_idx on public.production_jobs(status, risk_status);

-- ---------- FASI: colonne nuove sulle lavorazioni esistenti ----------
alter table public.production_tasks
  add column if not exists job_id uuid references public.production_jobs(id) on delete cascade,
  add column if not exists capability text,                 -- lavorazione richiesta (stampa_ecosolvente, stampa_uv, laminazione, taglio, resinatura, controllo, confezionamento)
  add column if not exists machine_type text,               -- tipologia di macchinario richiesta (null = postazione)
  add column if not exists machine_id uuid references public.production_machines(id) on delete set null,
  add column if not exists passive boolean not null default false,   -- tempo passivo (maturazione, asciugatura)
  add column if not exists manual_minutes boolean not null default false,  -- durata corretta a mano: il ricalcolo non la tocca
  add column if not exists machine_locked boolean not null default false,  -- macchina scelta a mano: il pianificatore non la cambia
  add column if not exists latest_start_at timestamptz,     -- ultimo avvio utile della fase
  add column if not exists planned_start_at timestamptz,
  add column if not exists planned_end_at timestamptz,
  add column if not exists complexity text;                 -- taglio: semplice, standard, complesso
alter table public.production_tasks drop constraint if exists production_tasks_status_check;
alter table public.production_tasks add constraint production_tasks_status_check
  check (status in ('da_fare','pronto','in_corso','bloccato','completato','in_attesa','saltata'));
create index if not exists production_tasks_job_idx on public.production_tasks(job_id, seq);
create index if not exists production_tasks_machine_idx on public.production_tasks(machine_id, status);

-- ---------- CRONOLOGIA: piu' dettaglio ----------
alter table public.production_events
  add column if not exists job_id uuid references public.production_jobs(id) on delete cascade,
  add column if not exists machine_id uuid,
  add column if not exists from_status text,
  add column if not exists to_status text,
  add column if not exists est_minutes int,
  add column if not exists actual_minutes int,
  add column if not exists packaging_eta timestamptz,
  add column if not exists slack_minutes int;

-- ---------- PERMESSI ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
alter table public.production_machines enable row level security;
alter table public.production_machine_profiles enable row level security;
alter table public.production_calendar enable row level security;
alter table public.production_jobs enable row level security;
-- staff: legge tutto; scrive solo su commesse e fasi. Il setup (macchinari, profili, calendario) e' solo admin.
drop policy if exists "machines: staff read" on public.production_machines;
create policy "machines: staff read" on public.production_machines for select using (public.is_staff());
drop policy if exists "machines: admin write" on public.production_machines;
create policy "machines: admin write" on public.production_machines for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profiles: staff read" on public.production_machine_profiles;
create policy "profiles: staff read" on public.production_machine_profiles for select using (public.is_staff());
drop policy if exists "profiles: admin write" on public.production_machine_profiles;
create policy "profiles: admin write" on public.production_machine_profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "calendar: staff read" on public.production_calendar;
create policy "calendar: staff read" on public.production_calendar for select using (public.is_staff());
drop policy if exists "calendar: admin write" on public.production_calendar;
create policy "calendar: admin write" on public.production_calendar for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "jobs: staff all" on public.production_jobs;
create policy "jobs: staff all" on public.production_jobs for all using (public.is_staff()) with check (public.is_staff());

-- ---------- SETUP INIZIALE: i sette macchinari di Stickerprint ----------
-- Velocita' e tempi NON noti restano NULL ("Da configurare"): finche' non sono impostati vale la durata di riserva del percorso.
insert into public.production_machines (code, name, brand, model, machine_type, department, usable_width_mm, capabilities, sort) values
  ('SG3-1',  'Roland SG3 #1',            'Roland',   'SG3-300',      'stampante_ecosolvente', 'stampa',      750,  '{stampa_ecosolvente}', 1),
  ('SG3-2',  'Roland SG3 #2',            'Roland',   'SG3-300',      'stampante_ecosolvente', 'stampa',      750,  '{stampa_ecosolvente}', 2),
  ('LG2-UV', 'Roland LG2 UV',            'Roland',   'LG2',          'stampante_uv',          'stampa',      750,  '{stampa_uv}',          3),
  ('LAM-1',  'Laminatrice',              null,       null,           'laminatrice',           'laminazione', null, '{laminazione}',        4),
  ('FC-1',   'Graphtec FC Pro 9000 #1',  'Graphtec', 'FC Pro 9000',  'plotter_taglio',        'taglio',      null, '{taglio}',             5),
  ('FC-2',   'Graphtec FC Pro 9000 #2',  'Graphtec', 'FC Pro 9000',  'plotter_taglio',        'taglio',      null, '{taglio}',             6),
  ('RES-1',  'Resinatrice automatica',   null,       null,           'resinatrice',           'resinatura',  null, '{resinatura}',         7)
on conflict (code) do nothing;

-- ---------- DATI ESISTENTI ----------
-- le lavorazioni gia' pianificate con i vecchi nomi delle macchine prendono il macchinario corrispondente
update public.production_tasks t set machine_id = m.id from public.production_machines m
  where t.machine_id is null and (
    (t.machine = 'Roland SG3-300 #1' and m.code = 'SG3-1') or (t.machine = 'Roland SG3-300 #2' and m.code = 'SG3-2') or
    (t.machine = 'Roland LG-300' and m.code = 'LG2-UV') or (t.machine = 'Plastificatrice' and m.code = 'LAM-1') or
    (t.machine = 'Graphtec' and m.code = 'FC-1') or (t.machine = 'Banco resina' and m.code = 'RES-1'));
update public.production_tasks set stage = 'laminazione' where stage = 'plastifica';
update public.production_tasks set passive = true where wait_minutes > 0 and minutes = 0;
update public.production_tasks set capability = case stage when 'stampa' then (case when machine = 'Roland LG-300' then 'stampa_uv' else 'stampa_ecosolvente' end) when 'laminazione' then 'laminazione' when 'taglio' then 'taglio' when 'resinatura' then 'resinatura' when 'controllo' then 'controllo' when 'confezionamento' then 'confezionamento' end where capability is null;
-- una commessa per ogni ordine in produzione che ha gia' lavorazioni
insert into public.production_jobs (checkout_group, order_number, promised_ship_date, status, paid_at, created_at)
  select coalesce(o.checkout_group, o.id::text), o.number, coalesce(o.ship_by, o.delivery_date, (o.created_at + interval '5 days')::date),
         case when exists (select 1 from public.production_tasks t where t.order_id = o.id and t.status = 'in_corso') then 'IN_PROGRESS' else 'READY_TO_START' end,
         o.created_at, o.created_at
  from public.orders o where o.status = 'in_produzione'
  group by coalesce(o.checkout_group, o.id::text), o.number, o.ship_by, o.delivery_date, o.created_at
on conflict (checkout_group) do nothing;
update public.production_tasks t set job_id = j.id from public.orders o join public.production_jobs j on j.checkout_group = coalesce(o.checkout_group, o.id::text)
  where t.order_id = o.id and t.job_id is null;
