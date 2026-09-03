-- Il numero d'ordine si genera solo da utenti autenticati (non dal ruolo anon)
revoke execute on function public.next_order_number() from anon, public;
grant execute on function public.next_order_number() to authenticated, service_role;
