-- Integrazione corrieri: etichette generate, numero di tracking, manifest (borderò) trasmessi al corriere
alter table public.orders
  add column if not exists labels_generated_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists courier_label_path text,
  add column if not exists manifest_id uuid;
create table if not exists public.courier_manifests (
  id            uuid primary key default gen_random_uuid(),
  courier       text not null,
  number        text not null,                 -- es. GLS-2026-09-04-1
  day           date not null default current_date,
  shipments     jsonb not null default '[]',   -- [{group, order_number, customer, city, parcels, weight_kg, tracking}]
  pdf_path      text,                          -- manifest ufficiale del corriere (se fornito dalle API)
  api_response  jsonb,
  transmitted_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
alter table public.courier_manifests enable row level security;
drop policy if exists "manifests: staff all" on public.courier_manifests;
create policy "manifests: staff all" on public.courier_manifests for all using (public.is_staff()) with check (public.is_staff());
