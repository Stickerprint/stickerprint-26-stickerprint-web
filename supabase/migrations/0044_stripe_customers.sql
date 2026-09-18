-- Carta salvata: a ogni account corrisponde un "cliente Stripe". I dati della carta restano su Stripe,
-- qui c'e' solo l'identificativo. La tabella si legge e si scrive SOLO dal server (chiave di servizio):
-- RLS attiva e nessuna policy, cosi' un cliente non puo' agganciarsi al cliente Stripe di un altro.
create table if not exists public.stripe_customers (
	user_id uuid primary key references auth.users(id) on delete cascade,
	customer_id text not null unique,
	created_at timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
