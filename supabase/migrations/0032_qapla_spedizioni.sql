-- Stato di spedizione da Qapla' (webhook + sincronizzazione), email di stato inviate, etichetta Qapla'
alter table public.orders
  add column if not exists shipping_status text,
  add column if not exists shipping_status_id int,
  add column if not exists shipping_detail text,
  add column if not exists shipping_place text,
  add column if not exists shipping_updated_at timestamptz,
  add column if not exists shipping_notified jsonb not null default '[]'::jsonb,
  add column if not exists delivered_at timestamptz,
  add column if not exists qapla_label_id int;
create index if not exists orders_tracking_idx on public.orders(tracking_number);

-- Richiesta di recensione 24 ore dopo la consegna, anche per gli ospiti (recensione via link con l'id ordine)
alter table public.orders add column if not exists review_asked_at timestamptz;
alter table public.reviews alter column user_id drop not null;
alter table public.reviews add column if not exists author text, add column if not exists email text;
