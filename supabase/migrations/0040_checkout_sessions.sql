-- Checkout con pagamento online (Stripe): l'ordine viene registrato "in attesa di pagamento" e i dati per
-- chiudere l'ordine (fattura, email, produzione) restano qui finche' Stripe conferma l'incasso.
create table if not exists public.checkout_sessions (
  checkout_group text primary key,
  provider text not null default 'stripe',
  session_id text,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
alter table public.checkout_sessions enable row level security;
drop policy if exists "checkout_sessions: staff all" on public.checkout_sessions;
create policy "checkout_sessions: staff all" on public.checkout_sessions for all using (public.is_staff()) with check (public.is_staff());
