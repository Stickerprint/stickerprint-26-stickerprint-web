-- Niente controllo qualita' ne' confezionamento come fasi: finita l'ultima lavorazione l'ordine va in Spedizioni.
-- Le fasi di quei due reparti ancora da fare vengono tolte; quelle gia' fatte restano nella cronologia.
delete from public.production_tasks where stage in ('controllo', 'confezionamento') and status in ('da_fare', 'pronto', 'in_corso', 'bloccato', 'in_attesa');
-- commesse rimaste senza fasi aperte → completate, ordine in spedizione
with done as (
	select j.id, j.checkout_group from public.production_jobs j
	where j.status in ('READY_TO_START', 'IN_PROGRESS', 'WAITING_PASSIVE_TIME', 'READY_FOR_PACKAGING', 'PACKAGING')
	  and not exists (select 1 from public.production_tasks t where t.job_id = j.id and t.status not in ('completato', 'saltata'))
), upd as (
	update public.production_jobs j set status = 'COMPLETED', completed_at = coalesce(j.completed_at, now()), updated_at = now() from done where j.id = done.id returning done.checkout_group
)
update public.orders o set status = 'in_spedizione', prod_stage = null from upd where coalesce(o.checkout_group, o.id::text) = upd.checkout_group and o.status = 'in_produzione';
-- gli stati di confezionamento non esistono piu'
update public.production_jobs set status = 'IN_PROGRESS' where status in ('READY_FOR_PACKAGING', 'PACKAGING');
alter table public.production_jobs drop constraint if exists production_jobs_status_check;
alter table public.production_jobs add constraint production_jobs_status_check check (status in ('READY_TO_START','IN_PROGRESS','WAITING_PASSIVE_TIME','COMPLETED','CANCELLED'));
-- una commessa che ha una fase "pronta" solo perche' la precedente (di controllo) e' sparita: la prima fase aperta deve essere pronta
update public.production_tasks t set status = 'pronto' from (
	select distinct on (job_id) id from public.production_tasks where status in ('da_fare', 'pronto', 'in_corso', 'bloccato', 'in_attesa') order by job_id, seq
) f where t.id = f.id and t.status = 'da_fare';

-- ---------- VELOCITA': il ricalcolo scrive in blocco ----------
-- Prima ogni fase e ogni commessa erano un UPDATE separato (decine di chiamate in fila dal server: 5-6 secondi a clic).
create or replace function public.production_apply_plan(phases jsonb, jobs jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
	update public.production_tasks t set
		latest_start_at = (p->>'latest_start_at')::timestamptz, due_at = (p->>'due_at')::timestamptz,
		planned_start_at = (p->>'planned_start_at')::timestamptz, planned_end_at = (p->>'planned_end_at')::timestamptz,
		machine_id = nullif(p->>'machine_id', '')::uuid, machine = nullif(p->>'machine', ''),
		minutes = coalesce((p->>'minutes')::int, t.minutes), updated_at = now()
	from jsonb_array_elements(phases) p where t.id = (p->>'id')::uuid;
	update public.production_jobs j set
		latest_start_at = (x->>'latest_start_at')::timestamptz, estimated_packaging_at = (x->>'estimated_packaging_at')::timestamptz,
		total_minutes = (x->>'total_minutes')::int, slack_minutes = (x->>'slack_minutes')::int, predicted_delay_minutes = (x->>'predicted_delay_minutes')::int,
		risk_status = x->>'risk_status', status = x->>'status', completed_at = coalesce(j.completed_at, (x->>'completed_at')::timestamptz), updated_at = now()
	from jsonb_array_elements(jobs) x where j.id = (x->>'id')::uuid;
end $$;
revoke all on function public.production_apply_plan(jsonb, jsonb) from public;
grant execute on function public.production_apply_plan(jsonb, jsonb) to authenticated;
