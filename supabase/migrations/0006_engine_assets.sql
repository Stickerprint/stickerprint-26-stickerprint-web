-- Immagini dei preventivatori (sagome, materiali) caricate dalla dashboard.
insert into storage.buckets (id, name, public)
values ('engine-assets', 'engine-assets', true)
on conflict (id) do nothing;

drop policy if exists "engine assets: public read" on storage.objects;
create policy "engine assets: public read" on storage.objects
	for select using (bucket_id = 'engine-assets');

drop policy if exists "engine assets: staff insert" on storage.objects;
create policy "engine assets: staff insert" on storage.objects
	for insert with check (bucket_id = 'engine-assets' and public.is_staff());

drop policy if exists "engine assets: staff update" on storage.objects;
create policy "engine assets: staff update" on storage.objects
	for update using (bucket_id = 'engine-assets' and public.is_staff());

drop policy if exists "engine assets: staff delete" on storage.objects;
create policy "engine assets: staff delete" on storage.objects
	for delete using (bucket_id = 'engine-assets' and public.is_staff());
