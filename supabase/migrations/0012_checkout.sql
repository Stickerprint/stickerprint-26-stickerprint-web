-- Checkout: numerazione ordini, dati di spedizione/fatturazione, pagamento, file del cliente.
create sequence if not exists public.order_number_seq start 1;
create or replace function public.next_order_number()
returns text language sql security definer set search_path = public as $$
  select 'SP-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;
-- allinea la sequenza agli ordini già presenti (es. SP-0001 di esempio)
select setval('public.order_number_seq', greatest(1, coalesce((select max(substring(number from 4)::int) from public.orders where number ~ '^SP-[0-9]+$'), 0)));

alter table public.orders
  add column if not exists email text,
  add column if not exists shipping jsonb,
  add column if not exists billing jsonb,
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists credit_used numeric(10,2) not null default 0,
  add column if not exists express boolean not null default false,
  add column if not exists checkout_group text,
  add column if not exists total_paid numeric(10,2);

-- il cliente inserisce i propri ordini dal checkout
drop policy if exists "orders: own insert" on public.orders;
create policy "orders: own insert" on public.orders for insert with check (auth.uid() = user_id);
-- il cliente registra l'utilizzo del proprio credito
drop policy if exists "credit: own spend" on public.credit_transactions;
create policy "credit: own spend" on public.credit_transactions for insert with check (auth.uid() = user_id and kind = 'spend' and amount <= 0);
-- codici sconto: leggibili da tutti per la verifica (solo quelli attivi)
drop policy if exists "discount: public read active" on public.discount_codes;
create policy "discount: public read active" on public.discount_codes for select using (active = true or public.is_staff());
create or replace function public.discount_code_used(p_code text)
returns void language sql security definer set search_path = public as $$
  update public.discount_codes set uses = uses + 1 where code = p_code;
$$;

-- File dei clienti: bucket privato, ognuno nella propria cartella
insert into storage.buckets (id, name, public) values ('order-files', 'order-files', false) on conflict (id) do nothing;
drop policy if exists "order files: own insert" on storage.objects;
create policy "order files: own insert" on storage.objects for insert with check (bucket_id = 'order-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "order files: own read" on storage.objects;
create policy "order files: own read" on storage.objects for select using (bucket_id = 'order-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
