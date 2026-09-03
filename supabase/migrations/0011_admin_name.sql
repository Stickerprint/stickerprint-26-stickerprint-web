-- Nome e cognome dell'amministratore (l'account è stato creato senza nome)
update public.profiles set full_name = 'Mattia Boccotti' where email = 'mattia@stickerprint.it' and coalesce(full_name, '') = '';
