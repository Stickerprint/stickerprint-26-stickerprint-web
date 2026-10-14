-- Aggiunte al carrello (14/10/2026): ogni "Aggiungi al carrello" del sito scrive una riga, cosi' la Panoramica marketing
-- conta le aggiunte di oggi, ieri, 7 e 30 giorni senza dipendere da Google Analytics (che non e' collegato) o da Klaviyo.
-- Niente dati personali: il visitatore e' un codice casuale salvato nel browser. Scrive solo il sito (chiave di servizio), legge lo staff.

create table if not exists public.carrello_eventi (
  id            uuid primary key default gen_random_uuid(),
  creato_il     timestamptz not null default now(),
  visitatore    text not null,                   -- codice anonimo del browser (localStorage sp-vid)
  user_id       uuid references auth.users (id) on delete set null,
  prodotto      text not null,                   -- slug (adesivi_personalizzati, kit, fogli_adesivi, campioni...)
  nome          text not null default '',
  forma         text,
  materiale     text,
  finitura      text,
  larghezza_mm  numeric(8,2),
  altezza_mm    numeric(8,2),
  qta           int not null default 1,
  netto         numeric(10,2) not null default 0,
  lordo         numeric(10,2) not null default 0,
  sorgente      text not null default 'sito',    -- configuratore | riordino | campioni | offerta
  promo         text,
  pagina        text,                            -- percorso della pagina da cui e' stato aggiunto
  dispositivo   text                             -- mobile | desktop | tablet
);
create index if not exists carrello_eventi_creato on public.carrello_eventi (creato_il desc);
alter table public.carrello_eventi enable row level security;
create policy "carrello eventi: staff legge" on public.carrello_eventi for select using (public.is_staff());
-- nessuna policy di insert: scrive solo il server del sito con la chiave di servizio (POST /api/carrello)
