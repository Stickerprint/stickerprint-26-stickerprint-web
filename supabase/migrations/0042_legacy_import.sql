-- Importazione dal sito precedente (stickerprint.it, progetto Supabase lslqxsvpuzkkxhljgfqx):
-- colonne per ricordare gli id originali, cosi' l'importazione si puo' ripetere senza duplicare.
alter table public.orders   add column if not exists legacy_id int, add column if not exists legacy_item_id int;
alter table public.invoices add column if not exists legacy_id int;
alter table public.reviews  add column if not exists legacy_id int;
alter table public.credit_transactions add column if not exists legacy_id uuid;
create unique index if not exists orders_legacy_item_idx on public.orders (legacy_item_id) where legacy_item_id is not null;
create unique index if not exists invoices_legacy_idx on public.invoices (legacy_id) where legacy_id is not null;
create unique index if not exists reviews_legacy_idx on public.reviews (legacy_id) where legacy_id is not null;
create unique index if not exists credit_tx_legacy_idx on public.credit_transactions (legacy_id) where legacy_id is not null;
