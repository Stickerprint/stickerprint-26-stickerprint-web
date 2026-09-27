-- Integrazioni di pagamento: il cliente cambia misura/finitura/quantita' dopo l'ordine, si chiede la differenza,
-- all'incasso si applica la modifica e si emette una fattura a se' (numero progressivo successivo).
alter table public.order_payments
  add column if not exists kind text not null default 'scadenza',   -- scadenza | integrazione
  add column if not exists reason text,                              -- motivo mostrato al cliente (es. "misura 100×100 invece di 70×70")
  add column if not exists changes jsonb,                            -- modifiche da applicare all'incasso: [{order_id, width_mm, height_mm, materiale, finitura, qty, total_net, total_gross, unit_net}]
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
-- stato dell'ordine mentre aspetta l'integrazione: fermo, fuori dalla coda
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'in_attesa', 'attesa_file', 'attesa_prova', 'modifiche_richieste', 'approvazione', 'attesa_pagamento', 'attesa_integrazione',
  'in_produzione', 'pronto', 'in_spedizione', 'spedito', 'in_consegna', 'consegnato', 'annullato'));
