-- Area personale clienti: ordini, fatture, recensioni.
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  number        text not null unique,
  product_slug  text not null,
  product_name  text not null,
  forma         text,
  materiale     text,
  finitura      text,
  width_mm      numeric(7,1),
  height_mm     numeric(7,1),
  qty           int not null,
  total_net     numeric(10,2) not null default 0,
  total_gross   numeric(10,2) not null default 0,
  credit_earned numeric(10,2) not null default 0,
  status        text not null default 'in_attesa' check (status in ('in_attesa', 'in_produzione', 'spedito', 'consegnato', 'annullato')),
  preview_url   text,
  file_path     text,
  tracking_url  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  number       text not null unique,
  issued_at    date not null default current_date,
  amount_gross numeric(10,2) not null default 0,
  pdf_path     text,               -- nel bucket privato "invoices": <user_id>/<file>.pdf
  created_at   timestamptz not null default now()
);
create index if not exists invoices_user_idx on public.invoices(user_id);

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  order_id   uuid not null unique references public.orders(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  title      text,
  comment    text,
  is_public  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.orders   enable row level security;
alter table public.invoices enable row level security;
alter table public.reviews  enable row level security;
drop policy if exists "orders: own read" on public.orders;
create policy "orders: own read" on public.orders for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "orders: staff write" on public.orders;
create policy "orders: staff write" on public.orders for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "invoices: own read" on public.invoices;
create policy "invoices: own read" on public.invoices for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "invoices: staff write" on public.invoices;
create policy "invoices: staff write" on public.invoices for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read" on public.reviews for select using (is_public = true or auth.uid() = user_id or public.is_staff());
drop policy if exists "reviews: own insert" on public.reviews;
create policy "reviews: own insert" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews: staff all" on public.reviews;
create policy "reviews: staff all" on public.reviews for all using (public.is_staff()) with check (public.is_staff());

-- PDF delle fatture: privati, ognuno scarica solo i propri
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false) on conflict (id) do nothing;
drop policy if exists "invoices: own read" on storage.objects;
create policy "invoices: own read" on storage.objects for select using (bucket_id = 'invoices' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "invoices: staff write" on storage.objects;
create policy "invoices: staff write" on storage.objects for insert with check (bucket_id = 'invoices' and public.is_staff());

-- Un ordine di ESEMPIO per l'amministratore, così l'area personale si può provare subito (si può cancellare).
do $$
declare uid uuid; oid uuid;
begin
  select id into uid from public.profiles where role = 'admin' order by created_at limit 1;
  if uid is null then return; end if;
  if exists (select 1 from public.orders where number = 'SP-0001') then return; end if;
  insert into public.orders (user_id, number, product_slug, product_name, forma, materiale, finitura, width_mm, height_mm, qty, total_net, total_gross, credit_earned, status, preview_url, notes, created_at)
  values (uid, 'SP-0001', 'adesivi_personalizzati', 'Adesivi personalizzati', 'sagomato', 'bianco', 'lucida', 50, 50, 500, 119.40, 145.67, 5.97, 'consegnato', '/images/prodotti/adesivi-personalizzati/1.webp', 'Ordine di esempio', now() - interval '20 days')
  returning id into oid;
  insert into public.invoices (user_id, order_id, number, issued_at, amount_gross) values (uid, oid, 'FT-2026-0001', current_date - 20, 145.67);
  insert into public.credit_transactions (user_id, amount, kind, order_ref, note, expires_at, created_at)
  values (uid, 5.97, 'earn', 'SP-0001', 'Credito 5% sull''ordine SP-0001', now() + interval '6 months', now() - interval '20 days');
end $$;
