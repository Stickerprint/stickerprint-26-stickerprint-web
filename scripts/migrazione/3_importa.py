"""Passo 3: importa nel nuovo progetto. Le mappature (nomi colonne del vecchio sito) si completano
dopo il passo 1: i punti da adattare sono marcati con  # MAPPA .
Idempotente: utenti per email, ordini per numero, contatti per email/P.IVA."""
from comune import *
import uuid, datetime
k = chiavi(); NEW, NK = k['NEW_URL'], k['NEW_SERVICE']

def utenti_nuovi_per_email():
    out = {}; page = 1
    while True:
        data, st, _ = req(f'{NEW}/auth/v1/admin/users?page={page}&per_page=1000', NK)
        if st != 200: sys.exit(f'admin/users: {st} {str(data)[:200]}')
        for u in data.get('users', []): out[(u.get('email') or '').lower()] = u['id']
        if len(data.get('users', [])) < 1000: break
        page += 1
    return out

# ---------- 1. utenti con hash password ----------
users = carica('auth_users'); profili_vecchi = {p['id']: p for p in carica('profiles')}
esistenti = utenti_nuovi_per_email()
mappa_id = {}   # id vecchio -> id nuovo
creati = 0; errori = []
for u in users:
    email = (u.get('email') or '').lower().strip()
    if not email: continue
    p = profili_vecchi.get(u['id'], {})
    meta = u.get('raw_user_meta_data') or {}
    full_name = p.get('full_name') or p.get('name') or meta.get('full_name') or meta.get('name') or ''   # MAPPA
    if email in esistenti:
        mappa_id[u['id']] = esistenti[email]; continue
    body = {'email': email, 'email_confirm': True, 'user_metadata': {'full_name': full_name, 'migrato_da': 'stickerprint.it'}}
    if u.get('encrypted_password'): body['password_hash'] = u['encrypted_password']
    else: body['password'] = uuid.uuid4().hex   # nessuna password: fara' "password dimenticata"
    if u.get('phone'): body['phone'] = u['phone']
    data, st, _ = req(f'{NEW}/auth/v1/admin/users', NK, 'POST', body)
    if st in (200, 201): mappa_id[u['id']] = data['id']; creati += 1
    else: errori.append(f'{email}: {st} {str(data)[:160]}')
print(f'utenti: {creati} creati, {len(mappa_id) - creati} gia\' presenti, {len(errori)} errori'); [print('  ', e) for e in errori[:20]]
salva('mappa_id', mappa_id)

# ---------- 2. profili (campi extra) ----------
righe = []
for old_id, new_id in mappa_id.items():
    p = profili_vecchi.get(old_id, {})
    righe.append({'id': new_id, 'email': (p.get('email') or next((u['email'] for u in users if u['id'] == old_id), '')).lower(),
        'full_name': p.get('full_name') or p.get('name'), 'phone': p.get('phone'), 'company_name': p.get('company_name') or p.get('company'),   # MAPPA
        'vat_number': p.get('vat_number') or p.get('vat') or p.get('piva'), 'fiscal_code': p.get('fiscal_code') or p.get('cf'),
        'sdi_code': p.get('sdi_code') or p.get('sdi'), 'pec': p.get('pec'), 'marketing_opt_in': bool(p.get('marketing_opt_in') or p.get('newsletter')),
        'customer_type': 'azienda' if (p.get('vat_number') or p.get('vat') or p.get('piva')) else 'privato', 'created_at': p.get('created_at')})
righe = [{a: b for a, b in r.items() if b is not None} for r in righe]
print('profili:', rest_upsert(NEW, NK, 'profiles', righe, on_conflict='id'))

# ---------- 3. indirizzi ----------
addr = []
for a in carica('addresses'):
    nid = mappa_id.get(a.get('user_id'))
    if not nid: continue
    addr.append({'user_id': nid, 'kind': 'billing' if (a.get('type') or a.get('kind')) == 'billing' else 'shipping',   # MAPPA
        'first_name': a.get('first_name') or '', 'last_name': a.get('last_name') or '', 'company': a.get('company'),
        'street': ' '.join(filter(None, [a.get('street') or a.get('address') or a.get('address1'), a.get('address2')])) or '',
        'city': a.get('city') or '', 'zip': a.get('zip') or a.get('postal_code') or a.get('cap') or '', 'province': (a.get('province') or a.get('state') or '')[:2].upper(),
        'country': a.get('country') or 'IT', 'phone': a.get('phone'), 'is_default': bool(a.get('is_default'))})
# evita doppioni: cancella gli indirizzi migrati in precedenza? no: si inseriscono solo se l'utente non ne ha
esist = rest_all(NEW, NK, 'addresses', select='user_id')
con = {r['user_id'] for r in esist}
addr = [a for a in addr if a['user_id'] not in con]
print('indirizzi:', rest_upsert(NEW, NK, 'addresses', addr))

# ---------- 4. ordini (una riga per articolo, stesso numero, gruppo = vecchio ordine) ----------
STATO = {'pending': 'attesa_prova', 'awaiting_proof': 'attesa_prova', 'proof_sent': 'approvazione', 'approved': 'in_produzione', 'in_production': 'in_produzione',   # MAPPA
         'processing': 'in_produzione', 'ready': 'pronto', 'shipped': 'spedito', 'delivered': 'consegnato', 'completed': 'consegnato', 'cancelled': 'annullato', 'canceled': 'annullato'}
PRODOTTO = {'adesivi_personalizzati': 'adesivi_personalizzati', 'adesivi_resinati': 'adesivi_resinati', 'adesivi_rilievo': 'adesivi_rilievo', 'etichette': 'etichette',   # MAPPA
            'fogli_adesivi': 'fogli_adesivi', 'fogli': 'fogli_adesivi', 'vetrofanie': 'vetrofanie', 'campioni': 'campioni'}
NOME = {'adesivi_personalizzati': 'Adesivi Personalizzati', 'adesivi_resinati': 'Adesivi Resinati', 'adesivi_rilievo': 'Adesivi in Rilievo', 'etichette': 'Etichette in Fogli', 'fogli_adesivi': 'Fogli di Adesivi', 'vetrofanie': 'Vetrofanie', 'campioni': 'Kit campioni'}
ordini = carica('orders'); items = carica('order_items')
by_order = {}
for it in items: by_order.setdefault(it.get('order_id'), []).append(it)
esist_num = {r['number'] for r in rest_all(NEW, NK, 'orders', select='number')}
righe = []; contatti = {}
for o in ordini:
    num = o.get('order_number') or o.get('number')   # MAPPA
    if not num or num in esist_num: continue
    nid = mappa_id.get(o.get('user_id')); group = str(uuid.uuid4())
    sh = o.get('shipping_address') or o.get('shipping') or {}; bl = o.get('billing_address') or o.get('billing') or sh   # MAPPA
    if isinstance(sh, str):
        try: sh = json.loads(sh)
        except Exception: sh = {}
    if isinstance(bl, str):
        try: bl = json.loads(bl)
        except Exception: bl = {}
    email = (o.get('email') or o.get('customer_email') or sh.get('email') or '').lower()   # MAPPA
    stato = STATO.get(str(o.get('status') or '').lower(), 'consegnato')
    lista = by_order.get(o.get('id')) or [o]
    tot_net = float(o.get('total_net') or o.get('subtotal') or o.get('total') or 0)
    for it in lista:
        slug = PRODOTTO.get(str(it.get('product_type') or it.get('productType') or '').lower(), 'adesivi_personalizzati')   # MAPPA
        qty = int(it.get('quantity') or it.get('qty') or 1)
        net = float(it.get('total_net') or it.get('price') or 0)   # MAPPA (se 'price' e' lordo: net = price/1.22)
        righe.append({'user_id': nid, 'number': num, 'product_slug': slug, 'product_name': NOME.get(slug, slug),
            'forma': it.get('shape') or it.get('forma') or it.get('category'), 'materiale': it.get('material') or it.get('materiale'), 'finitura': it.get('protection') or it.get('finitura'),   # MAPPA
            'width_mm': it.get('width_mm') or it.get('width'), 'height_mm': it.get('height_mm') or it.get('height'), 'qty': qty,
            'total_net': round(net, 2), 'total_gross': round(net * 1.22, 2), 'status': stato, 'email': email or None,
            'shipping': sh or None, 'billing': bl or None, 'payment_method': o.get('payment_method') or o.get('payment_type'), 'payment_status': 'paid',
            'checkout_group': group, 'channel': 'ecommerce', 'customer_name': ' '.join(filter(None, [sh.get('first_name') or sh.get('firstName'), sh.get('last_name') or sh.get('lastName')])) or None,
            'preview_url': it.get('mockup_url') or it.get('preview_url') or it.get('image_url'), 'file_path': it.get('file_path') or it.get('file_url'),   # MAPPA (file copiati dal passo bucket)
            'tracking_url': o.get('tracking_url'), 'tracking_number': o.get('tracking_number'), 'created_at': o.get('created_at'), 'total_paid': float(o.get('total') or 0) if it is lista[0] else 0,
            'notes': 'Ordine migrato da stickerprint.it'})
    if email and (sh or bl):
        contatti[email] = {'kind': 'azienda' if bl.get('vat') or bl.get('piva') or bl.get('vat_number') else 'privato', 'user_id': nid,
            'name': bl.get('company') or bl.get('company_name') or ' '.join(filter(None, [sh.get('first_name') or sh.get('firstName'), sh.get('last_name') or sh.get('lastName')])) or email,
            'first_name': sh.get('first_name') or sh.get('firstName'), 'last_name': sh.get('last_name') or sh.get('lastName'), 'email': email, 'phone': sh.get('phone') or o.get('phone'),
            'street': sh.get('street') or sh.get('address') or sh.get('address1'), 'city': sh.get('city'), 'zip': sh.get('zip') or sh.get('postal_code') or sh.get('postalCode') or sh.get('cap'),
            'province': (sh.get('province') or sh.get('state') or '')[:2].upper() or None, 'country': sh.get('country') or 'IT',
            'vat': bl.get('vat') or bl.get('piva') or bl.get('vat_number'), 'fiscal_code': bl.get('fiscal_code') or bl.get('cf') or bl.get('fiscalCode'), 'sdi': bl.get('sdi') or bl.get('sdi_code'), 'pec': bl.get('pec'),
            'notes': 'Cliente migrato da stickerprint.it'}
righe = [{a: b for a, b in r.items() if b is not None} for r in righe]
print('ordini (righe):', rest_upsert(NEW, NK, 'orders', righe))

# ---------- 5. anagrafica clienti: tutti quelli che hanno ordinato ----------
esist_c = {(r.get('email') or '').lower(): r['id'] for r in rest_all(NEW, NK, 'contacts', select='id,email')}
nuovi = [{a: b for a, b in c.items() if b is not None} for e, c in contatti.items() if e not in esist_c]
print('anagrafica clienti:', rest_upsert(NEW, NK, 'contacts', nuovi))

# ---------- 6. credito (se il vecchio sito lo aveva) ----------
try:
    cred = carica('credit_transactions')   # MAPPA: nome tabella del vecchio sito
    righe = [{'user_id': mappa_id[c['user_id']], 'amount': c['amount'], 'kind': c.get('kind') or ('earn' if float(c['amount']) > 0 else 'spend'), 'order_ref': c.get('order_ref'), 'note': c.get('note') or 'migrato', 'created_at': c.get('created_at')} for c in cred if c.get('user_id') in mappa_id]
    print('credito:', rest_upsert(NEW, NK, 'credit_transactions', righe))
except FileNotFoundError:
    print('credito: nessuna tabella nel vecchio sito, saltato')

# ---------- 7. recensioni ----------
try:
    rev = carica('reviews'); num_to_id = {}
    for r in rest_all(NEW, NK, 'orders', select='id,number,checkout_group'): num_to_id.setdefault(r['number'], r['id'])
    old_num = {o['id']: (o.get('order_number') or o.get('number')) for o in ordini}
    righe = []
    for r in rev:
        oid = num_to_id.get(old_num.get(r.get('order_id')))
        if not oid: continue
        righe.append({'user_id': mappa_id.get(r.get('user_id')), 'order_id': oid, 'rating': r.get('rating') or 5, 'title': r.get('title'), 'comment': r.get('comment') or r.get('text'),
                      'is_public': r.get('is_public', True), 'author': r.get('customer_name') or r.get('guest_name'), 'created_at': r.get('created_at')})
    righe = [{a: b for a, b in x.items() if b is not None} for x in righe]
    print('recensioni:', rest_upsert(NEW, NK, 'reviews', righe, on_conflict='order_id'))
except FileNotFoundError:
    print('recensioni: nessuna tabella, saltato')
