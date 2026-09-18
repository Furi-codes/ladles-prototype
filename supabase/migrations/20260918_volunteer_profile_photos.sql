-- Run in Supabase SQL Editor to enable private volunteer profile photos.
begin;

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_owned;
alter table public.profiles add constraint profiles_avatar_path_owned
check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('volunteer-avatars', 'volunteer-avatars', false, 2097152, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];

-- These rules do not change profile or booking access policies.
drop policy if exists volunteer_avatars_read on storage.objects;
create policy volunteer_avatars_read on storage.objects for select to authenticated
using (bucket_id = 'volunteer-avatars' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or (select public.is_admin())
));

drop policy if exists volunteer_avatars_upload on storage.objects;
create policy volunteer_avatars_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'volunteer-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.extension(name) = 'webp'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'volunteer')
);

drop policy if exists volunteer_avatars_remove on storage.objects;
create policy volunteer_avatars_remove on storage.objects for delete to authenticated
using (bucket_id = 'volunteer-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
