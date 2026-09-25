-- Domande frequenti: ogni domanda sceglie in quali pagine prodotto comparire (spunte in dashboard).
-- Senza spunte resta solo nella pagina Supporto. Le categorie "collegate a un prodotto" continuano a valere come prima.
alter table public.faq_items add column if not exists products text[] not null default '{}';
create index if not exists faq_items_products_idx on public.faq_items using gin (products);
