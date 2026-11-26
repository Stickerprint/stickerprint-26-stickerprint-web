-- Lingua del cliente su ticket e richieste (26/11/2026, regola di Mattia: tutto quello che arriva al cliente e' nella sua lingua).
-- I moduli del sito conoscono la lingua della pagina da cui il cliente scrive: la si salva, cosi' anche le risposte dello staff
-- partono con la cornice dell'email e la pagina della conversazione in quella lingua. Senza questa colonna il sito ripiega
-- sulla lingua dell'ultimo ordine di quell'indirizzo email (e sull'italiano se non ha ordini).
alter table public.tickets add column if not exists lang text;
alter table public.contact_requests add column if not exists lang text;
