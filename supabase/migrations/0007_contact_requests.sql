-- Richieste dai form del sito: aziende, supporto via email, resi.
create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('aziende', 'support', 'reso')),
  name         text,
  company      text,
  email        text not null,
  phone        text,
  order_number text,
  message      text not null,
  file_path    text,
  status       text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at   timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
drop policy if exists "contact: anyone can insert" on public.contact_requests;
create policy "contact: anyone can insert" on public.contact_requests for insert with check (true);
drop policy if exists "contact: staff all" on public.contact_requests;
create policy "contact: staff all" on public.contact_requests for all using (public.is_staff()) with check (public.is_staff());

-- Allegati dei form (privati: li vede solo lo staff)
insert into storage.buckets (id, name, public) values ('requests', 'requests', false) on conflict (id) do nothing;
drop policy if exists "requests: anyone can upload" on storage.objects;
create policy "requests: anyone can upload" on storage.objects for insert with check (bucket_id = 'requests');
drop policy if exists "requests: staff read" on storage.objects;
create policy "requests: staff read" on storage.objects for select using (bucket_id = 'requests' and public.is_staff());
