-- Separates business registration and access from volunteer membership.
-- Database triggers guard the stored account relationship instead of trusting a
-- browser-selected portal.

-- Strict account types (version matches the hosted migration): business signup creates a business-only identity, never an upgrade
-- of an existing volunteer/admin login. Existing volunteer/WMS bookings are not rewritten.
begin;

-- Do not guess how to split a real mixed account or silently move its booking history.
do $$
begin
  if exists(select 1 from public.corporate_accounts a left join public.profiles p on p.id=a.owner_user_id
    where p.volunteer_enabled is distinct from false or p.role is distinct from 'volunteer'
      or exists(select 1 from public.bookings b where b.user_id=a.owner_user_id)) then
    raise exception 'Mixed volunteer/business accounts require review before account separation can be enabled.' using errcode='23514';
  end if;
end $$;

-- Create the pending business account and its initial history for the supplied owner.
create or replace function corporate_private.create_account(p_owner uuid,p_details jsonb) returns public.corporate_accounts
language plpgsql security definer set search_path='' as $$
declare v jsonb := corporate_private.clean_details(p_details); a public.corporate_accounts; p public.profiles;
begin
  perform 1 from auth.users where id=p_owner for update;
  if not found then raise exception 'Account no longer exists.' using errcode='42501'; end if;
  select * into p from public.profiles where id=p_owner for update;
  if not found or p.volunteer_enabled is distinct from false or p.role is distinct from 'volunteer' then
    raise exception 'Volunteer and business accounts are separate. Register the business using a different email address.' using errcode='42501';
  end if;
  if exists(select 1 from public.bookings where user_id=p_owner) then
    raise exception 'A login with volunteer bookings cannot become a business account.' using errcode='23514';
  end if;
  select * into a from public.corporate_accounts where owner_user_id=p_owner;
  if found then
    if jsonb_build_object('company_name',a.company_name,'contact_name',a.contact_name,'contact_email',a.contact_email,'contact_phone',a.contact_phone,'billing_address',a.billing_address)=v then return a; end if;
    raise exception 'This login already has a business account. Open its profile instead.' using errcode='23505';
  end if;
  if not coalesce((select registration_enabled from public.corporate_rollout_settings where id=1),false) then
    raise exception 'Business registration is not open yet.' using errcode='55000';
  end if;
  insert into public.corporate_accounts(owner_user_id,company_name,contact_name,contact_email,contact_phone,billing_address)
    values(p_owner,v->>'company_name',v->>'contact_name',v->>'contact_email',v->>'contact_phone',v->>'billing_address') returning * into a;
  perform corporate_private.record_action(a,p_owner,'Corporate account requested',null,'Email verification and admin approval are required.','admin');
  return a;
end $$;

-- Read business registration details from signup metadata; this trigger handles the corporate
-- account path.
create or replace function corporate_private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare v_phone text := nullif(regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'phone','')), '[[:space:]]+', ' ', 'g'),''); a public.corporate_accounts;
begin
  if v_phone is not null then update public.profiles set phone=v_phone where id=new.id; end if;
  if new.raw_user_meta_data->>'registration_kind'='corporate' then
    -- This runs only on a new Auth insert. Editing metadata later never changes account type.
    update public.profiles set volunteer_enabled=false where id=new.id;
    a := corporate_private.create_account(new.id,new.raw_user_meta_data->'corporate_details');
  end if;
  return new;
end $$;

-- Check the current identity and registration rules before creating a business account.
create or replace function corporate_private.register_account(p_details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := corporate_private.require_user(); a public.corporate_accounts;
begin
  if not exists(select 1 from public.profiles where id=v_user and role='volunteer' and volunteer_enabled=false) then
    raise exception 'Volunteer and business accounts are separate. Register the business using a different email address.' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
    raise exception 'Verify your business login email before opening the account.' using errcode='42501';
  end if;
  a := corporate_private.create_account(v_user,p_details);
  return to_jsonb(a);
end $$;

-- Check that the account owner meets the separate-business membership rules.
create function corporate_private.check_business_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
  -- Lock the same profile row used by profile updates, so competing writes cannot create a mixed account.
  select * into p from public.profiles where id=new.owner_user_id for update;
  if not found or p.volunteer_enabled is distinct from false or p.role is distinct from 'volunteer'
    or exists(select 1 from public.bookings where user_id=new.owner_user_id) then
    raise exception 'Business accounts require a separate business-only login.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger corporate_accounts_separate_owner before insert or update of owner_user_id on public.corporate_accounts
  for each row execute function corporate_private.check_business_owner();

-- Keep business-only profile membership separate from volunteer access.
create function corporate_private.keep_business_profile_separate() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.volunteer_enabled is distinct from false or new.role is distinct from 'volunteer')
    and exists(select 1 from public.corporate_accounts where owner_user_id=old.id) then
    raise exception 'A business login cannot also be a volunteer or administrator account.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger profiles_keep_business_separate before update of volunteer_enabled,role on public.profiles
  for each row execute function corporate_private.keep_business_profile_separate();

revoke all on function corporate_private.check_business_owner(),corporate_private.keep_business_profile_separate() from public,anon,authenticated;
-- Replacing a function preserves its grants; the internal create/signup functions remain private.
revoke all on function corporate_private.create_account(uuid,jsonb),corporate_private.on_signup() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
