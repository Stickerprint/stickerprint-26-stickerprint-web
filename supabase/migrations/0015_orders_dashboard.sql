-- Dashboard ordini: ordini manuali, stati completi, campi per la gestione interna.
alter table public.orders
  add column if not exists channel text not null default 'ecommerce',
  add column if not exists starred boolean not null default false,
  add column if not exists product_code text,
  add column if not exists description text,
  add column if not exists unit_net numeric(10,4),
  add column if not exists price_type text not null default 'netti',
  add column if not exists shipping_method text,
  add column if not exists delivery_date date,
  add column if not exists customer_name text,
  add column if not exists country text not null default 'IT',
  add column if not exists mockup_url text,
  add column if not exists prod_stage text,
  add column if not exists internal_notes text,
  add column if not exists lamination text;
create index if not exists orders_group_idx on public.orders(checkout_group);
create index if not exists orders_created_idx on public.orders(created_at desc);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione',
  'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato'));

-- nome cliente per gli ordini già presenti
update public.orders set customer_name = trim(coalesce(shipping->>'first_name', '') || ' ' || coalesce(shipping->>'last_name', ''))
  where customer_name is null and shipping is not null;
update public.orders o set customer_name = p.full_name from public.profiles p where o.customer_name is null and o.user_id = p.id;

-- lo staff carica mockup e file per gli ordini manuali
drop policy if exists "order files: staff write" on storage.objects;
create policy "order files: staff write" on storage.objects for insert with check (bucket_id = 'order-files' and public.is_staff());
drop policy if exists "order files: staff update" on storage.objects;
create policy "order files: staff update" on storage.objects for update using (bucket_id = 'order-files' and public.is_staff());
