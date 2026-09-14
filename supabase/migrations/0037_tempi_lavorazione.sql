-- Tempi di lavorazione dichiarati per ordine (testo libero, es. "7-10 giorni lavorativi dall'ok sul file"): compaiono in conferma, preventivo e PDF
alter table public.orders add column if not exists lead_time text;
