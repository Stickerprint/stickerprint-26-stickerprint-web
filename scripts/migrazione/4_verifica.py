"""Passo 4: conteggi vecchio/nuovo e prova di login con un utente migrato."""
from comune import *
k = chiavi(); NEW, NK = k['NEW_URL'], k['NEW_SERVICE']
def conta(base, key, t):
    _, st, hdr = req(f'{base}/rest/v1/{t}?select=*', key, headers={'Range': '0-0', 'Prefer': 'count=exact'})
    return hdr.get('content-range', '?/?').split('/')[-1] if hdr else f'HTTP {st}'
print('utenti vecchi:', len(carica('auth_users')), ' → mappati:', len(carica('mappa_id')))
for t in ['profiles', 'addresses', 'orders', 'contacts', 'reviews', 'credit_transactions']:
    print(f'{t:20s} nuovo: {conta(NEW, NK, t)}')
email = sys.argv[1] if len(sys.argv) > 1 else None; pw = sys.argv[2] if len(sys.argv) > 2 else None
if email and pw:
    data, st, _ = req(f'{NEW}/auth/v1/token?grant_type=password', k['NEW_ANON'], 'POST', {'email': email, 'password': pw})
    print('login di prova:', 'OK' if st == 200 else f'FALLITO {st} {str(data)[:120]}')
