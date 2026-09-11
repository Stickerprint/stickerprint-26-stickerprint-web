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
