-- Programma fedeltà a 3 livelli (Creator, Partner, Ambassador) + foto profilo.
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.loyalty_levels (
  level       text primary key,
  rank        int not null unique,
  name        text not null,
  credit_rate numeric(5,4) not null,      -- quota dell'imponibile che torna come credito
  next_points int,                        -- punti nel periodo per salire al livello successivo (null = ultimo)
  keep_points int not null default 0,     -- punti nell'anno per confermare il livello
  img         text
);
insert into public.loyalty_levels (level, rank, name, credit_rate, next_points, keep_points, img) values
  ('creator', 1, 'Creator', 0.02, 500, 0, '/images/loyalty/creator.png'),
  ('partner', 2, 'Partner', 0.04, 1500, 500, '/images/loyalty/partner.png'),
  ('ambassador', 3, 'Ambassador', 0.06, null, 1500, '/images/loyalty/ambassador.png')
on conflict (level) do update set name = excluded.name, credit_rate = excluded.credit_rate, next_points = excluded.next_points, keep_points = excluded.keep_points, img = excluded.img;

create table if not exists public.loyalty (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  level           text not null default 'creator' references public.loyalty_levels(level),
  level_since     timestamptz not null default now(),   -- inizio dell'anno di validità del livello
  period_points   int not null default 0,               -- punti (1 = 1 € netto, campioni esclusi) nel periodo corrente
  lifetime_points int not null default 0,
  updated_at      timestamptz not null default now()
);
drop trigger if exists loyalty_set_updated_at on public.loyalty;
create trigger loyalty_set_updated_at before update on public.loyalty for each row execute function public.set_updated_at();

alter table public.loyalty_levels enable row level security;
alter table public.loyalty enable row level security;
drop policy if exists "loyalty levels: public read" on public.loyalty_levels;
create policy "loyalty levels: public read" on public.loyalty_levels for select using (true);
drop policy if exists "loyalty levels: staff write" on public.loyalty_levels;
create policy "loyalty levels: staff write" on public.loyalty_levels for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "loyalty: own read" on public.loyalty;
create policy "loyalty: own read" on public.loyalty for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists "loyalty: staff write" on public.loyalty;
create policy "loyalty: staff write" on public.loyalty for all using (public.is_staff()) with check (public.is_staff());

-- Scadenza annuale: conferma o retrocessione di un livello
create or replace function public.loyalty_refresh(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.loyalty%rowtype; keep int; prev text;
begin
  insert into public.loyalty (user_id) values (uid) on conflict (user_id) do nothing;
  select * into r from public.loyalty where user_id = uid for update;
  while r.level_since + interval '1 year' <= now() loop
    select keep_points into keep from public.loyalty_levels where level = r.level;
    if r.period_points >= keep then
      r.level_since := r.level_since + interval '1 year';
    else
      select l.level into prev from public.loyalty_levels l
        where l.rank = (select rank from public.loyalty_levels where level = r.level) - 1;
      r.level := coalesce(prev, r.level);
      r.level_since := r.level_since + interval '1 year';
    end if;
    r.period_points := 0;
  end loop;
  update public.loyalty set level = r.level, level_since = r.level_since, period_points = r.period_points where user_id = uid;
end $$;

-- Aggiunge punti e fa salire di livello quando si raggiunge la soglia
create or replace function public.loyalty_add_points(uid uuid, pts int)
returns void language plpgsql security definer set search_path = public as $$
declare r public.loyalty%rowtype; nxt int; nxt_level text;
begin
  perform public.loyalty_refresh(uid);
  select * into r from public.loyalty where user_id = uid for update;
  r.period_points := r.period_points + greatest(pts, 0);
  r.lifetime_points := r.lifetime_points + greatest(pts, 0);
  loop
    select next_points into nxt from public.loyalty_levels where level = r.level;
    exit when nxt is null or r.period_points < nxt;
    select l.level into nxt_level from public.loyalty_levels l where l.rank = (select rank from public.loyalty_levels where level = r.level) + 1;
    exit when nxt_level is null;
    r.level := nxt_level;
    r.period_points := r.period_points - nxt;
    r.level_since := now();
  end loop;
  update public.loyalty set level = r.level, level_since = r.level_since, period_points = r.period_points, lifetime_points = r.lifetime_points where user_id = uid;
end $$;

-- Stato fedeltà dell'utente corrente (aggiornato alla lettura)
create or replace function public.loyalty_status()
returns json language plpgsql security definer set search_path = public as $$
declare r public.loyalty%rowtype; cur public.loyalty_levels%rowtype; nxt public.loyalty_levels%rowtype;
begin
  if auth.uid() is null then return null; end if;
  perform public.loyalty_refresh(auth.uid());
  select * into r from public.loyalty where user_id = auth.uid();
  select * into cur from public.loyalty_levels where level = r.level;
  select * into nxt from public.loyalty_levels where rank = cur.rank + 1;
  return json_build_object(
    'level', cur.level, 'name', cur.name, 'rank', cur.rank, 'credit_rate', cur.credit_rate, 'img', cur.img,
    'period_points', r.period_points, 'lifetime_points', r.lifetime_points,
    'level_since', r.level_since, 'expires_at', r.level_since + interval '1 year',
    'keep_points', cur.keep_points,
    'next', case when nxt.level is null then null else json_build_object('level', nxt.level, 'name', nxt.name, 'points', cur.next_points, 'credit_rate', nxt.credit_rate, 'img', nxt.img) end,
    'levels', (select json_agg(json_build_object('level', level, 'name', name, 'rank', rank, 'credit_rate', credit_rate, 'img', img, 'next_points', next_points, 'keep_points', keep_points) order by rank) from public.loyalty_levels)
  );
end $$;

-- Nuovo utente: parte da Creator
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  insert into public.loyalty (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- Ogni ordine (campioni esclusi): punti = euro netti, credito = imponibile × quota del livello
create or replace function public.orders_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare rate numeric; earned numeric;
begin
  if new.status = 'annullato' or new.product_slug = 'campioni' then return new; end if;
  perform public.loyalty_refresh(new.user_id);
  select l.credit_rate into rate from public.loyalty y join public.loyalty_levels l on l.level = y.level where y.user_id = new.user_id;
  earned := round(new.total_net * coalesce(rate, 0.02), 2);
  update public.orders set credit_earned = earned where id = new.id;
  insert into public.credit_transactions (user_id, amount, kind, order_ref, note, expires_at)
  values (new.user_id, earned, 'earn', new.number, 'Credito ' || round(coalesce(rate, 0.02) * 100) || '% sull''ordine ' || new.number, now() + interval '6 months');
  perform public.loyalty_add_points(new.user_id, floor(new.total_net)::int);
  return new;
end $$;
drop trigger if exists orders_loyalty on public.orders;
create trigger orders_loyalty after insert on public.orders for each row execute function public.orders_after_insert();

-- Utenti e ordini già esistenti
insert into public.loyalty (user_id) select id from public.profiles on conflict (user_id) do nothing;
do $$
declare r record;
begin
  for r in select user_id, sum(floor(total_net))::int as pts from public.orders where status <> 'annullato' and product_slug <> 'campioni' group by user_id loop
    perform public.loyalty_add_points(r.user_id, r.pts);
  end loop;
end $$;

-- Foto profilo: bucket pubblico, ognuno scrive solo nella propria cartella
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars: own insert" on storage.objects;
create policy "avatars: own insert" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: own update" on storage.objects;
create policy "avatars: own update" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: own delete" on storage.objects;
create policy "avatars: own delete" on storage.objects for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
