-- Multilingua e multivaluta (21/10/2026): ogni ordine ricorda lingua del cliente, valuta pagata, cambio e IVA applicata.
-- I totali in euro (total_net/total_gross) restano la base contabile; total_paid_currency e' quanto ha pagato il cliente nella sua valuta.
alter table public.orders
  add column if not exists locale text not null default 'it',
  add column if not exists currency text not null default 'EUR' check (currency in ('EUR','USD')),
  add column if not exists fx_rate numeric(10,6) not null default 1,
  add column if not exists vat_rate numeric(5,4) not null default 0.22,
  add column if not exists total_paid_currency numeric(10,2),
  add column if not exists zona text not null default 'it' check (zona in ('it','ue','us'));
alter table public.checkout_sessions add column if not exists locale text not null default 'it';
alter table public.checkout_sessions add column if not exists currency text not null default 'EUR';
alter table public.profiles add column if not exists locale text;
alter table public.invoices add column if not exists vat_rate numeric(5,4) not null default 0.22;
alter table public.invoices add column if not exists natura text;   -- N3.1 export, N3.2 cessioni UE, null = IVA ordinaria
alter table public.invoices add column if not exists currency text not null default 'EUR';
