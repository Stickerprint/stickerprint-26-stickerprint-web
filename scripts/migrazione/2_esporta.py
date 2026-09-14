"""Passo 2: esporta tutte le tabelle pubbliche + utenti auth (vista temporanea public.mig_users) + file dei bucket.
Prima di lanciarlo, nell'editor SQL del VECCHIO progetto:
  create or replace view public.mig_users as
    select id, email, encrypted_password, email_confirmed_at, phone, created_at, last_sign_in_at, raw_user_meta_data
    from auth.users;
Dopo l'esportazione:  drop view public.mig_users;
"""
from comune import *
k = chiavi()
schema = carica('schema_vecchio')
TABELLE = [t for t in schema if not t.startswith('mig_')]
for t in TABELLE:
    try:
        rows = rest_all(k['OLD_URL'], k['OLD_SERVICE'], t)
        salva(t, rows); print(f'{t:28s} {len(rows):>6} righe')
    except SystemExit as e:
        print(f'{t:28s} SALTATA: {e}')
try:
    users = rest_all(k['OLD_URL'], k['OLD_SERVICE'], 'mig_users')
    salva('auth_users', users); print(f'{"auth.users":28s} {len(users):>6} righe (con hash password)')
except SystemExit as e:
    print('auth.users NON esportati: crea prima la vista public.mig_users (vedi intestazione).', e)
