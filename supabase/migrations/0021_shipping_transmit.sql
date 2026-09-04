-- Spedizioni: trasmissione al corriere (le etichette si generano per corriere, poi si conclude con DDT)
alter table public.orders add column if not exists transmitted_at timestamptz;
