-- Credito Stickerprint a livelli: Creator 2%, Partner 4%, Ambassador 6%.
-- Il preventivatore mostra il credito del livello base (2%): i listini salvati avevano ancora il 5%.
update public.pricing_engines set config = jsonb_set(config, '{creditRate}', '0.02'::jsonb) where config ? 'creditRate';
update public.loyalty_levels set credit_rate = 0.02 where level = 'creator';
update public.loyalty_levels set credit_rate = 0.04 where level = 'partner';
update public.loyalty_levels set credit_rate = 0.06 where level = 'ambassador';
