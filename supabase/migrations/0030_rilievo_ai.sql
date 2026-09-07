-- Cache dell'analisi visiva del rilievo: per ogni immagine (hash) le zone scelte dal modello.
-- Dati innocui (numeri di zona e una frase), scritti dal server con la chiave di servizio.
create table if not exists public.rilievo_ai (
  hash       text primary key,
  zone       jsonb not null,                 -- { rilievo: [numeri], motivo: testo }
  modello    text,
  created_at timestamptz not null default now()
);
alter table public.rilievo_ai enable row level security;
drop policy if exists "rilievo ai: staff read" on public.rilievo_ai;
create policy "rilievo ai: staff read" on public.rilievo_ai for select using (public.is_staff());
