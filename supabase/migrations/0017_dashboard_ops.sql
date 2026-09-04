-- Notifiche push per lo staff, tipo cliente (privato/azienda), ordini in tempo reale.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,           -- { p256dh, auth }
  device     text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: staff own" on public.push_subscriptions;
create policy "push: staff own" on public.push_subscriptions for all using (public.is_staff() and auth.uid() = user_id) with check (public.is_staff() and auth.uid() = user_id);

alter table public.profiles add column if not exists customer_type text not null default 'privato' check (customer_type in ('privato', 'azienda'));
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, customer_type, company_name, vat_number)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''),
          case when new.raw_user_meta_data ->> 'customer_type' = 'azienda' then 'azienda' else 'privato' end,
          nullif(new.raw_user_meta_data ->> 'company_name', ''), nullif(new.raw_user_meta_data ->> 'vat_number', ''))
  on conflict (id) do nothing;
  insert into public.loyalty (user_id) values (new.id) on conflict (user_id) do nothing;
  update public.orders set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  update public.invoices set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

-- ordini in tempo reale nella dashboard (lo staff li legge già via RLS)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
