-- Un solo numero d'ordine per checkout: le righe (una per prodotto) dello stesso ordine
-- condividono il numero. Il vincolo di unicita' sul numero viene tolto; l'ordine resta
-- identificato dal gruppo (checkout_group) e ogni riga dal suo id.
alter table public.orders drop constraint if exists orders_number_key;
create index if not exists orders_number_idx on public.orders(number);
