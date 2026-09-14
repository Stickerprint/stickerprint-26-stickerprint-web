# Migrazione dal vecchio Supabase (lslqxsvpuzkkxhljgfqx) al nuovo (nhiwiwubecumxuknwxto)

Cosa porta: account clienti CON password (hash bcrypt, nessuno rifa' la password), profili,
indirizzi, storico ordini con anteprime/file, credito, recensioni; tutti i clienti che hanno
ordinato finiscono anche in Anagrafica clienti (tabella contacts).

Passi (li esegue Claude, servono il login al vecchio Supabase in Chrome e le chiavi di servizio
dei due progetti in `scripts/migrazione/.chiavi` — file locale, NON nel repository):

1. `python3 1_scopri.py`     → legge lo schema del vecchio progetto (OpenAPI di PostgREST) e conta le righe
2. `python3 2_esporta.py`    → scarica tutte le tabelle + auth.users (vista temporanea `public.mig_users`,
                               creata e poi rimossa dall'editor SQL) in `export/*.json`; copia i file dei bucket
3. `python3 3_importa.py`    → crea gli utenti nel nuovo progetto con `password_hash` (API admin GoTrue),
                               aggiorna profiles, importa addresses, contacts, orders (una riga per articolo,
                               stesso numero d'ordine, checkout_group = vecchio ordine), credit_transactions,
                               reviews; carica anteprime e file nei bucket nuovi
4. `python3 4_verifica.py`   → confronta i conteggi e prova un login con un utente di test

Idempotente: si puo' rilanciare, aggiorna senza duplicare (chiave: email per gli utenti, numero per gli ordini).
