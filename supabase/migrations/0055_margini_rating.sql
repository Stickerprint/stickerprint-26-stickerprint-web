-- Analisi margini: rating mensile (AAA … D) con il commento in stile report finanziario.
-- Una riga per ogni aggiornamento: provvisorio ogni lunedì, definitivo a mese chiuso (il 1° del mese dopo).
create table if not exists public.margini_rating (
  id             uuid primary key default gen_random_uuid(),
  mese           text not null check (mese ~ '^[0-9]{4}-[0-9]{2}$'),  -- yyyy-mm
  lettera        text not null,
  punteggio      numeric(5,1) not null,
  definitivo     boolean not null default false,
  dati_fino_al   date not null,                                     -- ordini e pubblicita' letti fino a questo giorno
  dati           jsonb not null,                                    -- metriche, componenti del punteggio, riepilogo per il commento
  pro            jsonb not null default '[]'::jsonb,
  contro         jsonb not null default '[]'::jsonb,
  considerazioni text,
  autore         text not null default 'regole' check (autore in ('assistente', 'regole')),
  modello        text,
  generato_il    timestamptz not null default now()
);
create index if not exists margini_rating_mese on public.margini_rating (mese, generato_il desc);
-- un solo definitivo per mese
create unique index if not exists margini_rating_definitivo on public.margini_rating (mese) where definitivo;

alter table public.margini_rating enable row level security;
drop policy if exists "margini rating: staff legge" on public.margini_rating;
create policy "margini rating: staff legge" on public.margini_rating for select using (public.is_staff());
drop policy if exists "margini rating: staff scrive" on public.margini_rating;
create policy "margini rating: staff scrive" on public.margini_rating for insert with check (public.is_staff());
