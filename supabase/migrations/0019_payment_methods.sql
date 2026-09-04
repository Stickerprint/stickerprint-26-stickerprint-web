-- Metodi di pagamento per gli ordini manuali (con regole di scadenza) e scadenze salvate su ordini e fatture.
create table if not exists public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  xml_code      text not null default 'MP05',      -- ModalitaPagamento FatturaPA: MP05 bonifico, MP12 RIBA, MP08 carta, MP01 contanti
  days          int not null default 0,            -- giorni per rata
  end_of_month  boolean not null default false,    -- "fm": si parte dalla fine del mese
  installments  int not null default 1,            -- numero di rate (importo diviso in parti uguali)
  paid_upfront  boolean not null default false,    -- incassato prima della spedizione (es. bonifico anticipato)
  custom        boolean not null default false,    -- rate inserite a mano sull'ordine
  active        boolean not null default true,
  sort          int not null default 0
);
alter table public.payment_methods enable row level security;
drop policy if exists "payment methods: staff all" on public.payment_methods;
create policy "payment methods: staff all" on public.payment_methods for all using (public.is_staff()) with check (public.is_staff());
insert into public.payment_methods (name, xml_code, days, end_of_month, installments, paid_upfront, custom, sort) values
  ('Bonifico bancario vista fattura', 'MP05', 0, false, 1, false, false, 1),
  ('Bonifico anticipato', 'MP05', 0, false, 1, true, false, 2),
  ('Bonifico 30 gg f.m.', 'MP05', 30, true, 1, false, false, 3),
  ('Ricevuta bancaria 30 gg f.m.', 'MP12', 30, true, 1, false, false, 4),
  ('Ricevuta bancaria 60 gg f.m.', 'MP12', 60, true, 1, false, false, 5),
  ('Ricevuta bancaria 90 gg f.m.', 'MP12', 90, true, 1, false, false, 6),
  ('Ricevuta bancaria 30/60 gg f.m.', 'MP12', 30, true, 2, false, false, 7),
  ('Personalizzato', 'MP05', 0, false, 1, false, true, 99)
on conflict (name) do nothing;

alter table public.orders add column if not exists payment_terms jsonb;     -- [{due, amount, method, xml_code}]
alter table public.invoices add column if not exists payment_terms jsonb;
alter table public.ddts add column if not exists payment_terms jsonb;
