-- Fatturazione automatica, ordini ospite (senza account) e collegamento al momento della registrazione.
alter table public.orders alter column user_id drop not null;
alter table public.invoices alter column user_id drop not null;
alter table public.invoices
  add column if not exists email text,
  add column if not exists billing jsonb,
  add column if not exists lines jsonb,
  add column if not exists subtotal_net numeric(10,2) not null default 0,
  add column if not exists discount_net numeric(10,2) not null default 0,
  add column if not exists express_net numeric(10,2) not null default 0,
  add column if not exists credit_used numeric(10,2) not null default 0,
  add column if not exists vat_amount numeric(10,2) not null default 0,
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists checkout_group text;

create sequence if not exists public.invoice_number_seq start 1;
create or replace function public.next_invoice_number()
returns text language sql security definer set search_path = public as $$
  select 'FT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
$$;
revoke execute on function public.next_invoice_number() from anon, public;
grant execute on function public.next_invoice_number() to authenticated, service_role;

drop policy if exists "invoices: own insert" on public.invoices;
create policy "invoices: own insert" on public.invoices for insert with check (auth.uid() = user_id);
drop policy if exists "invoices: own pdf insert" on storage.objects;
create policy "invoices: own pdf insert" on storage.objects for insert with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

-- Credito e punti solo per i clienti registrati (gli ospiti non ne hanno)
create or replace function public.orders_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare rate numeric; earned numeric;
begin
  if new.user_id is null or new.status = 'annullato' or new.product_slug = 'campioni' then return new; end if;
  perform public.loyalty_refresh(new.user_id);
  select l.credit_rate into rate from public.loyalty y join public.loyalty_levels l on l.level = y.level where y.user_id = new.user_id;
  earned := round(new.total_net * coalesce(rate, 0.02), 2);
  update public.orders set credit_earned = earned where id = new.id;
  insert into public.credit_transactions (user_id, amount, kind, order_ref, note, expires_at)
  values (new.user_id, earned, 'earn', new.number, 'Credito ' || round(coalesce(rate, 0.02) * 100) || '% sull''ordine ' || new.number, now() + interval '6 months');
  perform public.loyalty_add_points(new.user_id, floor(new.total_net)::int);
  return new;
end $$;

-- Alla registrazione: profilo, livello Creator e collegamento degli ordini/fatture fatti da ospite con la stessa email (senza credito)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  insert into public.loyalty (user_id) values (new.id) on conflict (user_id) do nothing;
  update public.orders set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  update public.invoices set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;
