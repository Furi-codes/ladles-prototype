-- DBA REVIEW REQUIRED - NOT APPLIED. Run as postgres after reviewing live schema.
-- Baseline: the CSR/Reports/Settings migration has already been applied.
-- No existing policy, is_admin(), table, or historical migration is replaced.
begin;

-- The invoker trigger below trusts only the postgres-owned SECURITY DEFINER RPC.
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'DBA must review and run this migration as postgres.';
  end if;
end; $$;

-- Existing profiles_update_admin permits direct role updates. Close that bypass
-- without changing RLS or blocking normal profile/account edits. This is INVOKER:
-- inside the RPC current_user is postgres; a browser cannot choose current_user.
create function public.guard_profile_role_changes() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user <> 'postgres' then
    raise exception 'Use the administrator access RPC to change roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_role_changes() from public, anon, authenticated;
create trigger profiles_guard_role_changes before update on public.profiles
for each row execute function public.guard_profile_role_changes();

create function public.set_profile_admin_access(p_target_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := auth.uid();
  v_old_role text;
begin
  if v_caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'Only administrators can manage access.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'volunteer') then
    raise exception 'Role must be admin or volunteer.' using errcode = '22023';
  end if;
  -- Fresh snapshots after waiting are required for authorization and final-admin checks.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Access changes require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  -- Infrequent access changes serialize with all profile writes, including deletion.
  -- This prevents two concurrent revocations from using the same administrator count.
  lock table public.profiles in share row exclusive mode;
  if not public.is_admin() then
    raise exception 'Administrator access has changed. Sign in again.' using errcode = '42501';
  end if;
  select role into v_old_role from public.profiles where id = p_target_id;
  if not found then
    raise exception 'Target profile does not exist.' using errcode = 'P0002';
  end if;
  if p_target_id = v_caller and p_role = 'volunteer' then
    raise exception 'You cannot revoke your own administrator access.' using errcode = '42501';
  end if;
  if v_old_role = 'admin' and p_role = 'volunteer'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'The final administrator cannot be removed.' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_target_id;
end;
$$;
revoke all on function public.set_profile_admin_access(uuid,text) from public, anon, authenticated;
grant execute on function public.set_profile_admin_access(uuid,text) to authenticated;

-- Bounded, literal substring search; no wildcard/filter-string interpolation.
-- Empty query checks availability/authorization without returning profile data.
create function public.search_admin_access_profiles(p_query text default '')
returns table(id uuid, full_name text, email text, role text)
language plpgsql security definer set search_path = '' as $$
declare v_query text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can search access profiles.' using errcode = '42501';
  end if;
  if pg_catalog.length(v_query) < 2 then return; end if;
  if pg_catalog.length(v_query) > 200 then
    raise exception 'Search must be at most 200 characters.' using errcode = '22023';
  end if;
  return query select p.id, p.full_name, p.email, p.role
    from public.profiles p
    where pg_catalog.strpos(pg_catalog.lower(p.full_name), v_query) > 0
       or pg_catalog.strpos(pg_catalog.lower(coalesce(p.email, '')), v_query) > 0
    order by p.full_name, p.id limit 10;
end;
$$;
revoke all on function public.search_admin_access_profiles(text) from public, anon, authenticated;
grant execute on function public.search_admin_access_profiles(text) to authenticated;

-- Settings uses direct RLS-protected UPDATE, not an RPC. Enforce identity on
-- every write so old clients cannot rename it. Preserve all other settings.
create function public.guard_organisation_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.organisation_name is distinct from 'Ladles of Love' then
    raise exception 'Organisation name is fixed as Ladles of Love.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_organisation_identity() from public, anon, authenticated;
-- Correct only the singleton identity if a previous admin edited it.
update public.organisation_settings set organisation_name = 'Ladles of Love'
where id = 1 and organisation_name is distinct from 'Ladles of Love';
create trigger organisation_settings_fixed_identity before insert or update on public.organisation_settings
for each row execute function public.guard_organisation_identity();

notify pgrst, 'reload schema';
commit;
