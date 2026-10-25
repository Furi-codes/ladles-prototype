-- Adds separate volunteer/corporate contact settings and their protected operations.
-- Primary contact rules are checked in the database before corporate requests can be opened.

-- One admin-managed contact list per portal. Existing corporate primary fields
-- remain a compatibility projection for older deployments and booking gates.
create table public.portal_contact_settings (
  portal text primary key check (portal in ('volunteer','corporate')),
  contacts jsonb not null default '[]' check (jsonb_typeof(contacts)='array' and jsonb_array_length(contacts)<=12),
  version integer not null default 1 check (version>0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index portal_contact_settings_updated_by_idx on public.portal_contact_settings(updated_by);
alter table public.portal_contact_settings enable row level security;
revoke all on public.portal_contact_settings from public,anon,authenticated;
grant select on public.portal_contact_settings to authenticated;
create policy portal_contacts_admin_read on public.portal_contact_settings for select to authenticated using ((select public.is_admin()));

insert into public.portal_contact_settings(portal) values ('volunteer'),('corporate');
update public.portal_contact_settings set contacts=(
  select coalesce(jsonb_agg(contact),'[]'::jsonb) from (
    select jsonb_build_object('kind','email','label','Corporate bookings','value',booking_contact_email,'is_primary',true) contact
      from public.corporate_rollout_settings where id=1 and booking_contact_email<>''
    union all
    select jsonb_build_object('kind','phone','label','Corporate bookings','value',booking_contact_phone,'is_primary',true)
      from public.corporate_rollout_settings where id=1 and booking_contact_phone<>''
  ) entries
) where portal='corporate';

-- Validate the portal contact entries and their primary selections before saving.
create function corporate_private.clean_portal_contacts(p_contacts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare entry jsonb; clean jsonb:='[]'; kind text; label text; value text;
begin
  if p_contacts is null or jsonb_typeof(p_contacts)<>'array' or jsonb_array_length(p_contacts)>12 then
    raise exception 'Add at most 12 contact methods per portal.' using errcode='22023';
  end if;
  for entry in select jsonb_array_elements(p_contacts) loop
    if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'kind') is distinct from 'string'
      or jsonb_typeof(entry->'label') is distinct from 'string' or jsonb_typeof(entry->'value') is distinct from 'string'
      or jsonb_typeof(entry->'is_primary') is distinct from 'boolean' then
      raise exception 'Complete each contact method.' using errcode='22023';
    end if;
    kind:=entry->>'kind'; label:=btrim(entry->>'label'); value:=regexp_replace(btrim(entry->>'value'),'[[:space:]]+',' ','g');
    if kind not in ('email','phone') or label='' or length(label)>80 or value='' or
      (kind='email' and (length(value)>254 or value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or
      (kind='phone' and (length(value)>25 or value !~ '^\+?[0-9][0-9(). -]*[0-9]$' or length(regexp_replace(value,'[^0-9]','','g')) not between 7 and 15)) then
      raise exception 'Enter a label and a valid email address or phone number.' using errcode='22023';
    end if;
    clean:=clean||jsonb_build_array(jsonb_build_object('kind',kind,'label',label,'value',value,'is_primary',entry->'is_primary'));
  end loop;
  if exists(select 1 from jsonb_array_elements(clean) c group by c->>'kind' having count(*) filter(where (c->>'is_primary')::boolean)<>1) then
    raise exception 'Choose one primary email and one primary phone for each kind you add.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(clean) c group by c->>'kind',case when c->>'kind'='email' then lower(c->>'value') else regexp_replace(c->>'value','[^0-9]','','g') end having count(*)>1) then
    raise exception 'Remove duplicate contact methods.' using errcode='22023';
  end if;
  return clean;
end $$;

-- Return the selected portal's contact methods within the caller's permitted view.
create function corporate_private.portal_contacts(p_portal text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_portal is null or p_portal not in ('volunteer','corporate') then raise exception 'Choose a valid portal.' using errcode='22023'; end if;
  if not public.is_admin() and not (
    p_portal='corporate' and exists(select 1 from public.corporate_accounts where owner_user_id=uid)
    or p_portal='volunteer' and exists(select 1 from public.profiles where id=uid and role='volunteer' and volunteer_enabled)
  ) then raise exception 'You cannot access contacts for this portal.' using errcode='42501'; end if;
  select jsonb_build_object('portal',portal,'contacts',contacts,'version',version) into result from public.portal_contact_settings where portal=p_portal;
  if result is null then raise exception 'Portal contacts are unavailable.' using errcode='55000'; end if;
  return result;
end $$;

-- Let admin save approved portal contacts, with history for the settings change.
create function corporate_private.save_portal_contacts(p_portal text,p_version integer,p_contacts jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=corporate_private.require_user(); clean jsonb; previous public.portal_contact_settings; email text; phone text; enabled boolean;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_portal is null or p_portal not in ('volunteer','corporate') or p_version is null then raise exception 'Choose valid contact settings.' using errcode='22023'; end if;
  clean:=corporate_private.clean_portal_contacts(p_contacts);
  -- Both new and old admin clients take these locks in the same order.
  if p_portal='corporate' then select booking_enabled into enabled from public.corporate_rollout_settings where id=1 for update; end if;
  select * into previous from public.portal_contact_settings where portal=p_portal for update;
  if not found then raise exception 'Portal contacts are unavailable.' using errcode='55000'; end if;
  if previous.version<>p_version then raise exception 'These contacts changed. Reload and review the latest values before saving.' using errcode='40001'; end if;
  select c->>'value' into email from jsonb_array_elements(clean) c where c->>'kind'='email' and (c->>'is_primary')::boolean;
  select c->>'value' into phone from jsonb_array_elements(clean) c where c->>'kind'='phone' and (c->>'is_primary')::boolean;
  if p_portal='corporate' and enabled and (email is null or phone is null) then
    raise exception 'Keep a primary email and phone while corporate requests are open. Close requests before removing them.' using errcode='22023';
  end if;
  update public.portal_contact_settings set contacts=clean,version=version+1,updated_by=uid,updated_at=now() where portal=p_portal;
  if p_portal='corporate' then
    update public.corporate_rollout_settings set booking_contact_email=coalesce(email,''),booking_contact_phone=coalesce(phone,''),updated_by=uid,updated_at=now() where id=1;
  end if;
  insert into public.corporate_workflow_history(actor_user_id,actor_name,action,before_values,after_values,reason)
    values(uid,coalesce((select full_name from public.profiles where id=uid),'Administrator'),'Portal contacts updated',to_jsonb(previous),jsonb_build_object('portal',p_portal,'contacts',clean),'Approved portal contact methods updated.');
  return corporate_private.portal_contacts(p_portal);
end $$;

-- Old deployed clients can still configure a primary contact. Keep optional extra
-- contacts and the central list consistent instead of allowing two sources of truth.
create function corporate_private.sync_legacy_portal_contacts() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_contacts jsonb; email text; phone text;
begin
  select s.contacts into v_contacts from public.portal_contact_settings s where portal='corporate' for update;
  select c->>'value' into email from jsonb_array_elements(v_contacts) c where c->>'kind'='email' and (c->>'is_primary')::boolean;
  select c->>'value' into phone from jsonb_array_elements(v_contacts) c where c->>'kind'='phone' and (c->>'is_primary')::boolean;
  if coalesce(email,'')=new.booking_contact_email and coalesce(phone,'')=new.booking_contact_phone then return new; end if;
  select coalesce(jsonb_agg(c),'[]') into v_contacts from jsonb_array_elements(v_contacts) c where not (c->>'is_primary')::boolean
    and (c->>'kind'<>'email' or new.booking_contact_email<>'' and lower(c->>'value')<>lower(new.booking_contact_email))
    and (c->>'kind'<>'phone' or new.booking_contact_phone<>'' and regexp_replace(c->>'value','[^0-9]','','g')<>regexp_replace(new.booking_contact_phone,'[^0-9]','','g'));
  if new.booking_contact_email<>'' then v_contacts:=v_contacts||jsonb_build_array(jsonb_build_object('kind','email','label','Corporate bookings','value',new.booking_contact_email,'is_primary',true)); end if;
  if new.booking_contact_phone<>'' then v_contacts:=v_contacts||jsonb_build_array(jsonb_build_object('kind','phone','label','Corporate bookings','value',new.booking_contact_phone,'is_primary',true)); end if;
  v_contacts:=corporate_private.clean_portal_contacts(v_contacts);
  update public.portal_contact_settings set contacts=v_contacts,version=version+1,updated_by=new.updated_by,updated_at=now() where portal='corporate';
  return new;
end $$;
create trigger corporate_contacts_compatibility after update of booking_contact_email,booking_contact_phone on public.corporate_rollout_settings
  for each row execute function corporate_private.sync_legacy_portal_contacts();

-- Require valid primary corporate contacts before admin opens new requests.
create function corporate_private.set_contact_booking_availability(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=corporate_private.require_user(); current public.corporate_rollout_settings;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into current from public.corporate_rollout_settings where id=1 for update;
  if p_enabled is null or p_enabled and (current.booking_contact_email='' or current.booking_contact_phone='') then
    raise exception 'Configure a primary corporate email and phone in Settings → Portal contacts before opening requests.' using errcode='22023';
  end if;
  -- Reuse the established audit and request gate without accepting editable contacts here.
  return corporate_private.configure_bookings(p_enabled,current.booking_contact_email,current.booking_contact_phone);
end $$;

-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.get_portal_contacts(p_portal text) returns jsonb language sql stable security invoker set search_path='' as $$select corporate_private.portal_contacts(p_portal)$$;
create function public.save_portal_contacts(p_portal text,p_version integer,p_contacts jsonb) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.save_portal_contacts(p_portal,p_version,p_contacts)$$;
create function public.set_corporate_booking_availability(p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.set_contact_booking_availability(p_enabled)$$;
revoke all on function corporate_private.clean_portal_contacts(jsonb),corporate_private.portal_contacts(text),corporate_private.save_portal_contacts(text,integer,jsonb),corporate_private.sync_legacy_portal_contacts(),corporate_private.set_contact_booking_availability(boolean),public.get_portal_contacts(text),public.save_portal_contacts(text,integer,jsonb),public.set_corporate_booking_availability(boolean) from public,anon,authenticated;
grant execute on function corporate_private.portal_contacts(text),corporate_private.save_portal_contacts(text,integer,jsonb),corporate_private.set_contact_booking_availability(boolean),public.get_portal_contacts(text),public.save_portal_contacts(text,integer,jsonb),public.set_corporate_booking_availability(boolean) to authenticated;
