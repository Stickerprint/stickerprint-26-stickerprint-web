-- Adesivi ed etichette: si parte da 15 pezzi (via il 10). Vale per i listini salvati in dashboard.
update public.pricing_engines
set config = jsonb_set(config, '{quantities}', (
  select coalesce(jsonb_agg(v order by v), '[15]'::jsonb) from (
    select 15 as v
    union
    select (e)::int from jsonb_array_elements_text(coalesce(config->'quantities','[]'::jsonb)) e where (e)::int > 15
  ) q))
where slug in ('adesivi_personalizzati','adesivi_resinati','adesivi_rilievo','etichette');
