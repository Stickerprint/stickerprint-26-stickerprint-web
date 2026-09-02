-- ============================================================================
-- Stickerprint — schema base per il nuovo progetto Supabase (stickerprint26)
-- Eseguita a mano il 2/9/2026 nel SQL Editor. È idempotente: può essere rilanciata
-- dall'integrazione GitHub di Supabase senza errori.
-- Copre: profili utente (creati automaticamente alla registrazione),
--        indirizzi, credito Stickerprint (5%), ruoli per la dashboard interna.
-- Ordini, prove di stampa e fatture arrivano nella migrazione successiva.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Funzione di utilità: aggiorna updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILI (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  company_name  text,
  vat_number    text,        -- P.IVA
  fiscal_code   text,        -- Codice fiscale
  sdi_code      text,        -- Codice destinatario SDI (7 caratteri)
  pec           text,
  role          text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  marketing_opt_in boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea il profilo automaticamente quando un utente si registra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: l'utente corrente è staff o admin?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- INDIRIZZI (spedizione e fatturazione)
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'shipping' check (kind in ('shipping', 'billing')),
  label       text,
  first_name  text not null,
  last_name   text not null,
  company     text,
  street      text not null,
  city        text not null,
  zip         text not null,
  province    text not null,
  country     text not null default 'IT',
  phone       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);
drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CREDITO STICKERPRINT (5% su ogni ordine pagato, validità 6 mesi)
-- Ogni riga è un movimento; il saldo è la somma dei movimenti non scaduti.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(10,2) not null,            -- positivo = accredito, negativo = utilizzo
  kind        text not null check (kind in ('earn', 'spend', 'expire', 'adjust')),
  order_ref   text,                              -- numero ordine collegato (es. SPIT00265)
  note        text,
  expires_at  timestamptz,                       -- solo per 'earn'
  created_at  timestamptz not null default now()
);
create index if not exists credit_user_idx on public.credit_transactions(user_id);

-- Saldo credito dell'utente corrente (esclude accrediti scaduti)
create or replace function public.my_credit_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)
  from public.credit_transactions
  where user_id = auth.uid()
    and (kind <> 'earn' or expires_at is null or expires_at > now());
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.addresses           enable row level security;
alter table public.credit_transactions enable row level security;

-- profiles: ognuno vede/aggiorna il proprio; lo staff vede tutti
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id or public.is_staff());
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));  -- il ruolo non è auto-modificabile
drop policy if exists "profiles: staff update" on public.profiles;
create policy "profiles: staff update" on public.profiles for update using (public.is_staff());

-- addresses: CRUD solo sui propri; staff in lettura
drop policy if exists "addresses: own all" on public.addresses;
create policy "addresses: own all" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "addresses: staff read" on public.addresses;
create policy "addresses: staff read" on public.addresses for select using (public.is_staff());

-- credito: l'utente legge i propri movimenti; solo staff/funzioni server scrivono
create policy "credit: own read"   on public.credit_transactions for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "credit: staff write" on public.credit_transactions;
create policy "credit: staff write" on public.credit_transactions for insert with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Dopo aver eseguito: rendi admin il tuo utente (sostituisci l'email)
-- update public.profiles set role = 'admin' where email = 'mattia@stickerprint.it';
-- ---------------------------------------------------------------------------
