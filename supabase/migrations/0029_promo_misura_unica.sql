-- Offerte: misura unica decisa dal backend (niente scelta di misure), prezzo promo fisso.
alter table public.promos add column if not exists w_mm numeric(7,1) not null default 50;
alter table public.promos add column if not exists h_mm numeric(7,1) not null default 50;
-- le offerte esistenti prendono la prima misura della vecchia lista, se c'era
update public.promos set
  w_mm = coalesce((sizes->0->>'w')::numeric, w_mm),
  h_mm = coalesce((sizes->0->>'h')::numeric, (sizes->0->>'w')::numeric, h_mm),
  price = coalesce((sizes->0->>'price')::numeric, price)
where jsonb_typeof(sizes) = 'array' and jsonb_array_length(sizes) > 0;
