-- Offerte a ciclo: alla scadenza il conto alla rovescia riparte da solo di `cycle_days` giorni
-- (0 = scade e basta). La regola vale finche' non la si cambia dalla dashboard.
alter table public.promos add column if not exists cycle_days int not null default 0;

-- l'offerta attiva riparte stasera da zero: 7 giorni, fine giornata italiana
update public.promos
   set cycle_days = 7,
       ends_at = (date_trunc('day', now() at time zone 'Europe/Rome') + interval '7 days' + interval '23 hours 59 minutes 59 seconds') at time zone 'Europe/Rome',
       updated_at = now()
 where active;
