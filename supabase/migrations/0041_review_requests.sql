-- Richieste di recensione inviate via email: chi ha ricevuto la mail, quante volte l'ha aperta, se ha cliccato, se ha recensito.
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  checkout_group text,
  number text not null,
  email text not null,
  name text,
  sent_at timestamptz not null default now(),
  message_id text,
  tracked boolean not null default true,          -- false: inviata prima del tracciamento delle aperture
  opened_count int not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  clicked_at timestamptz,
  review_id uuid references public.reviews(id) on delete set null
);
create index if not exists review_requests_sent_idx on public.review_requests(sent_at desc);
create index if not exists review_requests_group_idx on public.review_requests(checkout_group);
alter table public.review_requests enable row level security;
drop policy if exists "review_requests: staff all" on public.review_requests;
create policy "review_requests: staff all" on public.review_requests for all using (public.is_staff()) with check (public.is_staff());
-- le richieste gia' mandate prima di oggi (senza tracciamento): una riga per ordine
insert into public.review_requests (order_id, checkout_group, number, email, name, sent_at, tracked, review_id)
select distinct on (coalesce(o.checkout_group, o.id::text)) o.id, o.checkout_group, o.number, o.email, o.shipping->>'first_name', o.review_asked_at, false, r.id
from public.orders o left join public.reviews r on r.order_id = o.id
where o.review_asked_at is not null and o.email is not null
order by coalesce(o.checkout_group, o.id::text), o.created_at;
