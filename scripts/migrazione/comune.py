"""Funzioni comuni: chiamate REST a Supabase (PostgREST + GoTrue admin) senza dipendenze esterne."""
import json, os, sys, urllib.request, urllib.parse, urllib.error, time

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, 'export')
os.makedirs(EXPORT, exist_ok=True)

def chiavi():
    """file .chiavi: OLD_URL, OLD_SERVICE, NEW_URL, NEW_SERVICE (una per riga, NOME=valore)"""
    p = os.path.join(HERE, '.chiavi')
    if not os.path.exists(p):
        sys.exit('manca scripts/migrazione/.chiavi (OLD_URL, OLD_SERVICE, NEW_URL, NEW_SERVICE)')
    k = {}
    for line in open(p):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            a, b = line.split('=', 1); k[a.strip()] = b.strip()
    return k

def req(url, key, method='GET', body=None, headers=None, retry=3):
    h = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    if headers: h.update(headers)
    data = json.dumps(body).encode() if body is not None and not isinstance(body, bytes) else body
    for i in range(retry):
        try:
            r = urllib.request.Request(url, data=data, method=method, headers=h)
            with urllib.request.urlopen(r, timeout=120) as resp:
                raw = resp.read()
                ct = resp.headers.get('content-type', '')
                return (json.loads(raw) if raw and 'json' in ct else raw), resp.status, resp.headers
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors='ignore')
            if e.code in (429, 500, 502, 503, 504) and i < retry - 1:
                time.sleep(2 * (i + 1)); continue
            return raw, e.code, e.headers
    return None, 0, None

def rest_all(base, key, table, select='*', order='id', page=1000, filtro=''):
    """tutte le righe di una tabella (paginazione con Range)"""
    out = []; start = 0
    while True:
        url = f'{base}/rest/v1/{table}?select={urllib.parse.quote(select)}&order={order}{filtro}'
        data, status, hdr = req(url, key, headers={'Range': f'{start}-{start + page - 1}', 'Range-Unit': 'items', 'Prefer': 'count=exact'})
        if status not in (200, 206):
            raise SystemExit(f'{table}: HTTP {status} {str(data)[:300]}')
        out.extend(data)
        if len(data) < page: break
        start += page
    return out

def rest_upsert(base, key, table, rows, on_conflict=None, chunk=200):
    """insert/upsert a blocchi; ritorna (ok, errori)"""
    ok = 0; errs = []
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        url = f'{base}/rest/v1/{table}' + (f'?on_conflict={on_conflict}' if on_conflict else '')
        prefer = 'return=minimal' + (',resolution=merge-duplicates' if on_conflict else '')
        data, status, _ = req(url, key, 'POST', part, headers={'Prefer': prefer})
        if status in (200, 201, 204): ok += len(part)
        else: errs.append(f'{table} blocco {i}: HTTP {status} {str(data)[:300]}')
    return ok, errs

def salva(nome, data):
    p = os.path.join(EXPORT, nome + '.json')
    json.dump(data, open(p, 'w'), ensure_ascii=False, indent=0, default=str)
    return p

def carica(nome):
    return json.load(open(os.path.join(EXPORT, nome + '.json')))
