-- ============================================================================
-- Ruolo amministratore per l'account del titolare.
-- Crea il profilo se manca (utente creato prima del trigger) e lo rende admin.
-- Idempotente.
-- ============================================================================
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', 'Mattia'), 'admin'
from auth.users u
where lower(u.email) = 'mattia@stickerprint.it'
on conflict (id) do update set role = 'admin', email = excluded.email;

-- se l'utente è stato creato senza conferma email, confermalo
update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = 'mattia@stickerprint.it';
