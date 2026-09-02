-- ============================================================================
-- Newsletter: iscrizioni dal footer del sito
-- Idempotente. Eseguita a mano il 2/9/2026 nel SQL Editor.
-- ============================================================================

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text not null default 'footer',
  ip          text,
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- chiunque può iscriversi (solo insert); solo lo staff legge l'elenco
drop policy if exists "newsletter: public insert" on public.newsletter_subscribers;
create policy "newsletter: public insert" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "newsletter: staff read" on public.newsletter_subscribers;
create policy "newsletter: staff read" on public.newsletter_subscribers
  for select using (public.is_staff());
