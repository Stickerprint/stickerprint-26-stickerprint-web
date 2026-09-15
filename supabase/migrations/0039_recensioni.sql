-- Recensioni: approvazione in dashboard, recensioni inserite dallo staff (ricevute altrove), codice sconto personale per chi recensisce
alter table public.reviews
  add column if not exists status text not null default 'pending' check (status in ('pending','approved','rejected')),
  add column if not exists source text not null default 'cliente' check (source in ('cliente','staff')),
  add column if not exists source_note text,           -- es. "ricevuta su Google", "via WhatsApp"
  add column if not exists product_slug text,
  add column if not exists coupon_code text,
  add column if not exists reviewed_at timestamptz;
alter table public.reviews alter column order_id drop not null;
alter table public.reviews drop constraint if exists reviews_order_id_key;
create unique index if not exists reviews_order_unique on public.reviews(order_id) where order_id is not null;
-- le recensioni gia' presenti restano visibili; il prodotto si copia dall'ordine
update public.reviews set status = 'approved' where status = 'pending' and created_at < now();
update public.reviews r set product_slug = o.product_slug from public.orders o where o.id = r.order_id and r.product_slug is null;
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read" on public.reviews for select using ((is_public = true and status = 'approved') or auth.uid() = user_id or public.is_staff());

-- codici sconto personali: legati a un'email e a una recensione
alter table public.discount_codes
  add column if not exists bound_email text,
  add column if not exists review_id uuid references public.reviews(id) on delete set null;
