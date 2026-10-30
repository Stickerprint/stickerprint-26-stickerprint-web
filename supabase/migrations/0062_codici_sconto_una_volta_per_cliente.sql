-- Codici sconto: una volta sola per cliente (30/10/2026).
-- Un cliente (Ciro Di Sarno) ha usato STICKER10 su due ordini: il checkout controllava solo
-- validita', scadenza e usi totali del codice, mai chi lo aveva gia' usato. Da ora ogni codice
-- vale una volta per cliente, riconosciuto dall'account o dall'email dell'ordine (vale anche
-- per gli ospiti). Dalla dashboard un codice puo' essere reso "ripetibile" (once_per_customer = false).

alter table public.discount_codes
  add column if not exists once_per_customer boolean not null default true;

-- Quante volte un cliente ha gia' usato un codice: ordini con quel codice dello stesso account
-- o con la stessa email, esclusi gli annullati e quelli ancora in attesa di pagamento (sono
-- i tentativi di checkout non conclusi, anche dello stesso cliente che sta ordinando adesso).
-- security definer: il cliente non puo' leggere gli ordini degli altri, la funzione si'.
create or replace function public.discount_code_customer_uses(p_code text, p_email text, p_user uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(distinct coalesce(o.checkout_group, o.id::text))::integer
  from public.orders o
  where o.discount_code is not null
    and upper(o.discount_code) = upper(p_code)
    and o.status not in ('annullato', 'attesa_pagamento')
    and (
      (p_user is not null and o.user_id = p_user)
      or (p_email is not null and p_email <> '' and lower(o.email) = lower(p_email))
    );
$$;

revoke all on function public.discount_code_customer_uses(text, text, uuid) from public;
grant execute on function public.discount_code_customer_uses(text, text, uuid) to anon, authenticated, service_role;
