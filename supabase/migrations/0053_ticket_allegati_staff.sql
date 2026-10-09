-- Allegati nelle risposte dello staff (helpdesk): più file per messaggio, con il nome originale.
alter table public.ticket_messages add column if not exists files jsonb;  -- [{path, name, size, type}]
