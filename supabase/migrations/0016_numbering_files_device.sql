-- Numerazione annuale SP/SPD/SPF, file per articolo (originale, prova generata, impaginato), dispositivo dell'ordine.
alter table public.orders
  add column if not exists device text,           -- mobile | tablet | desktop
  add column if not exists user_agent text,
  add column if not exists proof_url text,        -- file generato dal sistema con tracciato di taglio (quello confermato dal cliente)
  add column if not exists imposition_url text,   -- impaginato sulla griglia di stampa (in arrivo)
  add column if not exists auto_proof boolean not null default false;

-- Contatori per anno: si azzerano il 1° gennaio
create table if not exists public.doc_counters (
  kind text not null,            -- order | ddt | invoice
  year int not null,
  last int not null default 0,
  primary key (kind, year)
);
alter table public.doc_counters enable row level security;
drop policy if exists "counters: staff read" on public.doc_counters;
create policy "counters: staff read" on public.doc_counters for select using (public.is_staff());

create or replace function public.next_doc_number(p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now())::int; n int; prefix text;
begin
  prefix := case p_kind when 'order' then 'SP' when 'ddt' then 'SPD' when 'invoice' then 'SPF' else upper(p_kind) end;
  insert into public.doc_counters (kind, year, last) values (p_kind, y, 1)
    on conflict (kind, year) do update set last = public.doc_counters.last + 1
    returning last into n;
  return prefix || lpad(n::text, 5, '0');
end $$;
revoke execute on function public.next_doc_number(text) from anon, public;
grant execute on function public.next_doc_number(text) to authenticated, service_role;

create or replace function public.next_order_number() returns text language sql security definer set search_path = public as $$ select public.next_doc_number('order'); $$;
create or replace function public.next_invoice_number() returns text language sql security definer set search_path = public as $$ select public.next_doc_number('invoice'); $$;
create or replace function public.next_ddt_number() returns text language sql security definer set search_path = public as $$ select public.next_doc_number('ddt'); $$;
revoke execute on function public.next_ddt_number() from anon, public;
grant execute on function public.next_ddt_number() to authenticated, service_role;

-- i contatori dell'anno partono dai documenti già emessi
insert into public.doc_counters (kind, year, last)
  select 'order', extract(year from now())::int, coalesce(max((regexp_match(number, '(\d+)$'))[1]::int), 0) from public.orders where number ~ '^SP-?\d+$'
  on conflict (kind, year) do update set last = greatest(public.doc_counters.last, excluded.last);
insert into public.doc_counters (kind, year, last)
  select 'invoice', extract(year from now())::int, coalesce(max((regexp_match(number, '(\d+)$'))[1]::int), 0) from public.invoices
  on conflict (kind, year) do update set last = greatest(public.doc_counters.last, excluded.last);

-- DDT (ordini manuali): ordine → DDT → fattura
create table if not exists public.ddts (
  id            uuid primary key default gen_random_uuid(),
  number        text not null unique,
  checkout_group text,
  issued_at     date not null default current_date,
  data          jsonb,            -- righe, colli, peso, causale, trasporto, importi congelati
  invoice_id    uuid references public.invoices(id) on delete set null,
  pdf_path      text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.ddts enable row level security;
drop policy if exists "ddts: staff all" on public.ddts;
create policy "ddts: staff all" on public.ddts for all using (public.is_staff()) with check (public.is_staff());

-- Anteprime generate dal sistema: pubbliche (si vedono in area personale, email, riordini)
insert into storage.buckets (id, name, public) values ('order-previews', 'order-previews', true) on conflict (id) do nothing;
drop policy if exists "previews: public read" on storage.objects;
create policy "previews: public read" on storage.objects for select using (bucket_id = 'order-previews');
drop policy if exists "previews: insert" on storage.objects;
create policy "previews: insert" on storage.objects for insert with check (bucket_id = 'order-previews' and ((storage.foldername(name))[1] = coalesce(auth.uid()::text, 'guest') or public.is_staff()));
drop policy if exists "previews: update" on storage.objects;
create policy "previews: update" on storage.objects for update using (bucket_id = 'order-previews' and ((storage.foldername(name))[1] = coalesce(auth.uid()::text, 'guest') or public.is_staff()));
