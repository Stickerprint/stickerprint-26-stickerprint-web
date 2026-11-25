-- Metodo di pagamento abituale del cliente, solo per le aziende (Mattia, 25/11/2026).
-- Si sceglie nella scheda cliente in Anagrafica fra i metodi di Setup > Metodi di pagamento.
-- Viene proposto quando si sceglie il cliente in un ordine o in un preventivo, e la fattura creata dai DDT
-- lo usa per le scadenze. Si puo' sempre cambiare a mano su ordine, preventivo e fattura.
-- Rieseguibile.
alter table public.contacts add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;
