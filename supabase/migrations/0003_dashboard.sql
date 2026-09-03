-- ============================================================================
-- Area amministratore: motori di calcolo prezzi (preventivatori) e codici sconto
-- Idempotente.
-- ============================================================================

-- Listini dei preventivatori: un record per prodotto, configurazione in JSON.
-- Il sito legge il listino da qui; l'amministratore lo modifica dalla dashboard.
create table if not exists public.pricing_engines (
  slug        text primary key,                 -- es. adesivi_personalizzati
  name        text not null,
  config      jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
drop trigger if exists pricing_engines_set_updated_at on public.pricing_engines;
create trigger pricing_engines_set_updated_at
  before update on public.pricing_engines
  for each row execute function public.set_updated_at();

-- storico delle modifiche ai listini (per poter tornare indietro)
create table if not exists public.pricing_engine_history (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null references public.pricing_engines(slug) on delete cascade,
  config      jsonb not null,
  changed_by  uuid references public.profiles(id),
  changed_at  timestamptz not null default now()
);
create index if not exists pricing_history_slug_idx on public.pricing_engine_history(slug, changed_at desc);

-- Codici sconto
create table if not exists public.discount_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text,
  kind          text not null default 'percent' check (kind in ('percent', 'fixed')),
  value         numeric(10,2) not null check (value > 0),
  min_order     numeric(10,2) not null default 0,
  max_uses      integer,                          -- null = illimitato
  uses          integer not null default 0,
  active        boolean not null default true,
  valid_from    timestamptz,
  valid_to      timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at
  before update on public.discount_codes
  for each row execute function public.set_updated_at();

-- RLS
alter table public.pricing_engines        enable row level security;
alter table public.pricing_engine_history enable row level security;
alter table public.discount_codes         enable row level security;

drop policy if exists "pricing: public read" on public.pricing_engines;
create policy "pricing: public read" on public.pricing_engines for select using (active = true or public.is_staff());
drop policy if exists "pricing: staff write" on public.pricing_engines;
create policy "pricing: staff write" on public.pricing_engines for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "pricing history: staff" on public.pricing_engine_history;
create policy "pricing history: staff" on public.pricing_engine_history for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "discount: staff all" on public.discount_codes;
create policy "discount: staff all" on public.discount_codes for all using (public.is_staff()) with check (public.is_staff());
-- il checkout valida i codici tramite funzione server-side, non in lettura diretta

-- Prodotti previsti nei preventivatori (i listini reali arrivano dalla dashboard)
insert into public.pricing_engines (slug, name, config, active) values
  ('adesivi_personalizzati', 'Adesivi personalizzati', '{}'::jsonb, true),
  ('adesivi_resinati',       'Adesivi resinati',       '{}'::jsonb, false),
  ('adesivi_rilievo',        'Adesivi in rilievo',     '{}'::jsonb, false),
  ('etichette',              'Etichette in fogli',     '{}'::jsonb, false),
  ('fogli_adesivi',          'Fogli di adesivi',       '{}'::jsonb, false),
  ('vetrofanie',             'Vetrofanie',             '{}'::jsonb, false)
on conflict (slug) do nothing;
