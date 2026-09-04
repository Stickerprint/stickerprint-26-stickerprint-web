-- Riparazione della 0023: dove la lista era assente e' rimasto solo [15]. Si scrive la lista completa.
update public.pricing_engines set config = jsonb_set(config, '{quantities}', '[15,50,100,200,300,500,1000,2000,3000,5000]'::jsonb)
where slug in ('adesivi_personalizzati','adesivi_resinati') and jsonb_array_length(coalesce(config->'quantities','[]'::jsonb)) < 3;
update public.pricing_engines set config = jsonb_set(config, '{quantities}', '[15,50,100,200,300,500,1000,2000,3000]'::jsonb)
where slug in ('adesivi_rilievo','etichette') and jsonb_array_length(coalesce(config->'quantities','[]'::jsonb)) < 3;
