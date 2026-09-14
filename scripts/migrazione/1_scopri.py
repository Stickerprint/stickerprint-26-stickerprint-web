"""Passo 1: schema del vecchio progetto (tabelle, colonne) e conteggi. Non modifica niente."""
from comune import *
k = chiavi()
spec, status, _ = req(f"{k['OLD_URL']}/rest/v1/", k['OLD_SERVICE'])
if status != 200: sys.exit(f'OpenAPI: HTTP {status} {str(spec)[:200]}')
defs = spec.get('definitions', {})
schema = {}
for t, d in sorted(defs.items()):
    cols = {c: v.get('format', v.get('type', '?')) for c, v in d.get('properties', {}).items()}
    _, st, hdr = req(f"{k['OLD_URL']}/rest/v1/{t}?select=*", k['OLD_SERVICE'], headers={'Range': '0-0', 'Prefer': 'count=exact'})
    n = (hdr.get('content-range', '?/?').split('/')[-1]) if hdr else '?'
    schema[t] = {'rows': n, 'cols': cols}
    print(f'{t:28s} righe={n:>6}  colonne={", ".join(cols)}')
salva('schema_vecchio', schema)
print('\nsalvato export/schema_vecchio.json')
