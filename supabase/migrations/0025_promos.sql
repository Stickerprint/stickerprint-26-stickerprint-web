-- Offerte (pagina /offerte): si modificano dalla dashboard, il cliente le vede subito.
create table if not exists public.promos (
  id            uuid primary key default gen_random_uuid(),
  active        boolean not null default true,
  sort          int not null default 0,
  qty           int not null default 250,               -- pezzi inclusi
  product_slug  text not null default 'adesivi_personalizzati',
  product_label text not null default 'adesivi personalizzati',
  price         numeric(10,2) not null default 79,      -- prezzo dell'offerta (IVA inclusa)
  price_normal  numeric(10,2),                          -- prezzo di listino, per il confronto
  subtitle      text,
  ends_at       timestamptz,                            -- scadenza mostrata come conto alla rovescia
  forma         text not null default 'sagomato',
  materiale     text not null default 'bianco',
  finitura      text,
  chips         jsonb not null default '[]'::jsonb,     -- ["Resistenti all'acqua","Lucidi"]
  includes      jsonb not null default '[]'::jsonb,     -- [{"label":"250 adesivi","normally":"171 €"}]
  perks         jsonb not null default '[]'::jsonb,     -- [{"label":"Anteprima immediata","saves":"5-8 ore"}]
  save_text     text,                                   -- "8-10 giorni e 118 €"
  sizes         jsonb not null default '[]'::jsonb,     -- [{"label":"5 cm","w":50,"h":50,"price":79}]
  cta           text not null default 'Carica il file per continuare',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.promos enable row level security;
drop policy if exists "promos: public read" on public.promos;
create policy "promos: public read" on public.promos for select using (active = true or public.is_staff());
drop policy if exists "promos: staff all" on public.promos;
create policy "promos: staff all" on public.promos for all using (public.is_staff()) with check (public.is_staff());

-- prima offerta di esempio, da modificare in dashboard
insert into public.promos (qty, product_slug, product_label, price, price_normal, subtitle, ends_at, chips, includes, perks, save_text, sizes, sort)
select 250, 'adesivi_personalizzati', 'adesivi personalizzati', 79, 171,
  'Per un periodo limitato: 250 adesivi personalizzati a soli 79 €, anteprima immediata compresa.',
  now() + interval '7 days',
  '["Resistenti all''acqua","Lucidi o opachi"]'::jsonb,
  '[{"label":"250 adesivi personalizzati","normally":"171 €"},{"label":"Anteprima automatica del file","normally":"inclusa"}]'::jsonb,
  '[{"label":"Anteprima immediata","saves":"5-8 ore"},{"label":"Produzione in 5 giorni","saves":"3-4 giorni"},{"label":"Corriere espresso tracciato","saves":"1-2 giorni"}]'::jsonb,
  '8-10 giorni e 92 €',
  '[{"label":"5 cm","w":50,"h":50,"price":79},{"label":"7 cm","w":70,"h":70,"price":99},{"label":"10 cm","w":100,"h":100,"price":129}]'::jsonb,
  0
where not exists (select 1 from public.promos);
