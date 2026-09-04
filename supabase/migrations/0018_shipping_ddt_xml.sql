-- Spedizioni (corriere, colli, peso), DDT collegati agli ordini, XML fattura elettronica.
alter table public.orders
  add column if not exists courier text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists parcels int,
  add column if not exists weight_kg numeric(8,2),
  add column if not exists ddt_id uuid references public.ddts(id) on delete set null;
alter table public.ddts
  add column if not exists order_number text,
  add column if not exists parcels int not null default 1,
  add column if not exists weight_kg numeric(8,2),
  add column if not exists causale text not null default 'Vendita',
  add column if not exists trasporto text,
  add column if not exists customer_name text,
  add column if not exists email text;
alter table public.invoices
  add column if not exists ddt_id uuid references public.ddts(id) on delete set null,
  add column if not exists ddt_number text,
  add column if not exists xml_generated_at timestamptz,
  add column if not exists xml_path text,
  add column if not exists order_numbers text[];
drop policy if exists "invoices: staff pdf insert" on storage.objects;
create policy "invoices: staff pdf insert" on storage.objects for insert with check (bucket_id = 'invoices' and public.is_staff());
drop policy if exists "invoices: staff pdf update" on storage.objects;
create policy "invoices: staff pdf update" on storage.objects for update using (bucket_id = 'invoices' and public.is_staff());
-- il cliente vede i propri ordini aggiornarsi in tempo reale: la tabella è già nella pubblicazione realtime
