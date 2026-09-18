-- Regolazioni del motore di anteprima approvate dal cliente (bordo, zoom, sfondo, "rimuovi sfondo",
-- tracciato): Stickerprint Studio le rimette identiche per generare file di stampa e taglio.
alter table public.orders add column if not exists engine_state jsonb;
