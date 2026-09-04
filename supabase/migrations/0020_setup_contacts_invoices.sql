-- Anagrafica contatti (inserita a mano dalla dashboard), codici prodotto, fatture da più DDT.
create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  kind          text not null default 'azienda',      -- azienda | privato
  name          text not null,                        -- ragione sociale o nome completo
  first_name    text, last_name text,
  email         text, phone text,
  street        text, city text, zip text, province text, country text not null default 'IT',
  vat           text, fiscal_code text, sdi text, pec text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contacts_email_idx on public.contacts (lower(email));
create index if not exists contacts_vat_idx on public.contacts (vat);
alter table public.contacts enable row level security;
drop policy if exists "contacts: staff all" on public.contacts;
create policy "contacts: staff all" on public.contacts for all using (public.is_staff()) with check (public.is_staff());

alter table public.orders add column if not exists contact_id uuid references public.contacts(id) on delete set null;

-- Codici prodotto: il prefisso decide la categoria di produzione, il codice completo porta descrizione e prezzo di default
create table if not exists public.product_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  category    text not null,                          -- slug categoria (adesivi_resinati, …)
  description text,
  unit_net    numeric(10,4),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.product_codes enable row level security;
drop policy if exists "product codes: staff all" on public.product_codes;
create policy "product codes: staff all" on public.product_codes for all using (public.is_staff()) with check (public.is_staff());
insert into public.product_codes (code, name, category, sort) values
  ('ADR', 'Adesivi resinati', 'adesivi_resinati', 1),
  ('STK', 'Adesivi personalizzati', 'adesivi_personalizzati', 2),
  ('STKR', 'Adesivi in rilievo', 'adesivi_rilievo', 3),
  ('STKF', 'Fogli di adesivi', 'fogli_adesivi', 4),
  ('EAT', 'Etichette in fogli', 'etichette', 5),
  ('VET', 'Vetrofanie', 'vetrofanie', 6),
  ('CMP', 'Campioni', 'campioni', 7)
on conflict (code) do nothing;

-- Fatture: più DDT collegati, note, blocco dopo l'XML
alter table public.invoices
  add column if not exists ddt_ids uuid[],
  add column if not exists ddt_numbers text[],
  add column if not exists notes text,
  add column if not exists updated_at timestamptz;
update public.invoices set ddt_ids = array[ddt_id], ddt_numbers = array[ddt_number] where ddt_id is not null and ddt_ids is null;
