-- Recensioni tradotte nelle lingue del sito: stessa colonna tr di FAQ/blog/offerte (vedi 0060), riempita dal traduttore
alter table public.reviews add column if not exists tr jsonb;
