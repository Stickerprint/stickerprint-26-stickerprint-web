-- Nuova regola degli stati (18/09/2026): in_produzione → in_spedizione → spedito → in_consegna → consegnato.
-- Niente piu' "pronto" (preparazione spedizione) ne' reparto Controllo.

-- corriere vero della spedizione quando passa da Qapla (GLS, BRT, FedEx...): lo scrive il webhook degli stati
alter table public.orders add column if not exists shipping_courier text;

-- gli ordini usciti dalla produzione sono "in spedizione"
update public.orders set status = 'in_spedizione' where status = 'pronto';

-- reparto Controllo tolto: le lavorazioni di controllo aperte si chiudono e parte quella dopo; quelle future si tolgono
with opened as (
	delete from public.production_tasks where stage = 'controllo' and status in ('pronto', 'in_corso', 'bloccato') returning order_id, seq
), nxt as (
	select distinct on (t.order_id) t.id, t.order_id, t.stage
	from public.production_tasks t join opened o on o.order_id = t.order_id and t.seq > o.seq
	where t.status = 'da_fare' order by t.order_id, t.seq
), upd as (
	update public.production_tasks t set status = 'pronto', updated_at = now() from nxt where t.id = nxt.id returning t.order_id, t.stage
)
update public.orders o set prod_stage = upd.stage from upd where o.id = upd.order_id;
delete from public.production_tasks where stage = 'controllo' and status = 'da_fare';

create index if not exists orders_shipped_at_idx on public.orders (shipped_at) where shipped_at is not null;
