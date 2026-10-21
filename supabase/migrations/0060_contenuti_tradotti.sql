-- Traduzioni dei contenuti che vivono nel database (FAQ, articoli del blog, offerte): colonna `tr` jsonb
-- { "en": {...campi tradotti...}, "es": {...}, ..., "_hash": "<impronta dell'italiano>" }.
-- Le riempie il lavoro /api/cron/traduzioni (ogni giorno) o il bottone "Traduci ora" in dashboard; l'impronta
-- serve a ritradurre quando Mattia cambia il testo italiano. Fino ad allora il sito usa src/lib/contenuti-tradotti.
alter table public.faq_items add column if not exists tr jsonb not null default '{}'::jsonb;
alter table public.faq_categories add column if not exists tr jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists tr jsonb not null default '{}'::jsonb;
alter table public.promos add column if not exists tr jsonb not null default '{}'::jsonb;
alter table public.post_categories add column if not exists tr jsonb not null default '{}'::jsonb;
-- slug tradotti del blog: indice per trovare l'articolo dall'URL in lingua
create index if not exists posts_tr_idx on public.posts using gin (tr);
