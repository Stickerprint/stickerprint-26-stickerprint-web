-- Resinati: minimo 50 pezzi, misura di partenza 25 mm, sagomato almeno 40 mm.
-- Tutti gli altri: misura di partenza 50 mm. La prima quantita' selezionata e' sempre la piu' bassa (lato sito).
update public.pricing_engines
   set config = jsonb_set(jsonb_set(config, '{quantities}', '[50,100,200,300,500,1000,2000,3000,5000]'::jsonb),
                          '{size}', coalesce(config->'size', '{}'::jsonb) || '{"defaultMm":25,"minMmDiecut":40}'::jsonb)
 where slug = 'adesivi_resinati' and config ? 'quantities';
update public.pricing_engines
   set config = jsonb_set(config, '{size}', coalesce(config->'size', '{}'::jsonb) || '{"defaultMm":50}'::jsonb)
 where slug <> 'adesivi_resinati' and config ? 'size';
