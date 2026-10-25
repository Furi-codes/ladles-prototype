-- Adds corporate accounts, account review, notices and the searchable volunteer directory.
-- These are additive changes to an existing VMS database. Ownership checks and restricted
-- functions protect company records.

-- Corporate account/contact foundation. Version matches the hosted migration history.
-- Existing volunteer events, slots, bookings, CSR tables, WMS RPCs and profile roles are retained.
-- Both rollout controls start OFF so applying this before the new app does not block old bookings.
begin;

create schema if not exists corporate_private;
revoke all on schema corporate_private from public, anon;
grant usage on schema corporate_private to authenticated;

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists volunteer_enabled boolean not null default true;
alter table public.profiles add constraint profiles_phone_format check (
  phone is null or (length(phone) <= 25 and phone ~ '^\+?[0-9][0-9(). -]*[0-9]$'
  and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15)
);

create table public.corporate_rollout_settings (
  id integer primary key default 1 check (id = 1),
  schema_version integer not null default 1 check (schema_version = 1),
  registration_enabled boolean not null default false,
  volunteer_phone_required boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.corporate_rollout_settings(id) values (1);

-- One main contact per company in this release. Membership is separate from profiles.role,
-- so an existing volunteer retains their profile and individual bookings.
create table public.corporate_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  company_name text not null check (length(btrim(company_name)) between 1 and 180),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 180),
  contact_email text not null check (length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  contact_phone text not null check (length(contact_phone) <= 25 and contact_phone ~ '^\+?[0-9][0-9(). -]*[0-9]$' and length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) between 7 and 15),
  billing_address text not null check (length(btrim(billing_address)) between 1 and 1000),
  status text not null default 'Awaiting approval' check (status in ('Awaiting approval','Approved','Rejected')),
  review_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index corporate_accounts_review_idx on public.corporate_accounts(status,created_at desc,id);

create table public.corporate_account_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.corporate_accounts(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  before_values jsonb,
  after_values jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);
create index corporate_account_history_account_idx on public.corporate_account_history(account_id,created_at desc,id);

-- These notices do not need a volunteer event_id and are not controlled by shift-reminder preferences.
create table public.corporate_account_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.corporate_accounts(id) on delete restrict,
  audience text not null check (audience in ('admin','corporate')),
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index corporate_account_notifications_account_idx on public.corporate_account_notifications(account_id,created_at desc,id);
create index corporate_account_notifications_audience_idx on public.corporate_account_notifications(audience,created_at desc,id);
-- Read state is per person. One admin reading a notice must not clear every other admin's inbox.
create table public.corporate_account_notification_reads (
  notification_id uuid not null references public.corporate_account_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(user_id,notification_id)
);

alter table public.corporate_accounts enable row level security;
alter table public.corporate_rollout_settings enable row level security;
alter table public.corporate_account_history enable row level security;
alter table public.corporate_account_notifications enable row level security;
alter table public.corporate_account_notification_reads enable row level security;

-- Read access is narrow; all workflow writes use checked functions below, never arbitrary table updates.
revoke all on public.corporate_accounts, public.corporate_rollout_settings, public.corporate_account_history,
  public.corporate_account_notifications, public.corporate_account_notification_reads from public,anon,authenticated;
grant select on public.corporate_accounts, public.corporate_rollout_settings, public.corporate_account_history,
  public.corporate_account_notifications, public.corporate_account_notification_reads to authenticated;
create policy corporate_accounts_read on public.corporate_accounts for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_admin()));
create policy corporate_rollout_read on public.corporate_rollout_settings for select to authenticated using ((select auth.uid()) is not null);
-- Signed-out registration needs only these two non-sensitive capabilities. Do not grant anon
-- SELECT on the whole settings row (which includes the last administrator's identity).
grant select(schema_version,registration_enabled) on public.corporate_rollout_settings to anon;
create policy corporate_registration_status_read on public.corporate_rollout_settings for select to anon using (id=1);
create policy corporate_history_read on public.corporate_account_history for select to authenticated using (
  (select public.is_admin()) or exists(select 1 from public.corporate_accounts a where a.id = account_id and a.owner_user_id = (select auth.uid()))
);
create policy corporate_notifications_read on public.corporate_account_notifications for select to authenticated using (
  (audience = 'admin' and (select public.is_admin())) or
  (audience = 'corporate' and exists(select 1 from public.corporate_accounts a where a.id = account_id and a.owner_user_id = (select auth.uid())))
);
create policy corporate_notification_reads_own on public.corporate_account_notification_reads for select to authenticated using (user_id = (select auth.uid()));

-- Privileged functions live in an unexposed schema. They need elevated rights because clients
-- cannot write approval/history directly or read auth.users. Every callable entry checks the actual user.
create function corporate_private.require_user() returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists(select 1 from auth.users where id = v_user and not coalesce(is_anonymous,false)) then
    raise exception using errcode='42501', message='Please sign in with a registered account.';
  end if;
  return v_user;
end $$;

-- Validate and select the editable company/contact fields before storing them.
create function corporate_private.clean_details(p_details jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v jsonb;
begin
  if jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Enter company details.' using errcode='22023'; end if;
  v := jsonb_build_object(
    'company_name', btrim(coalesce(p_details->>'company_name','')),
    'contact_name', btrim(coalesce(p_details->>'contact_name','')),
    'contact_email', btrim(coalesce(p_details->>'contact_email','')),
    'contact_phone', regexp_replace(btrim(coalesce(p_details->>'contact_phone','')), '[[:space:]]+', ' ', 'g'),
    'billing_address', btrim(coalesce(p_details->>'billing_address',''))
  );
  if length(v->>'company_name') not between 1 and 180 or length(v->>'contact_name') not between 1 and 180
    or length(v->>'billing_address') not between 1 and 1000 then
    raise exception 'Enter the company name, main contact and full billing address.' using errcode='22023';
  end if;
  if length(v->>'contact_email') > 254 or (v->>'contact_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v->>'contact_phone') > 25 or (v->>'contact_phone') !~ '^\+?[0-9][0-9(). -]*[0-9]$'
    or length(regexp_replace(v->>'contact_phone','[^0-9]','','g')) not between 7 and 15 then
    raise exception 'Enter a valid contact email and phone number.' using errcode='22023';
  end if;
  return v;
end $$;

-- Keep the account decision history and its in-app notice with the account change.
create function corporate_private.record_action(p_account public.corporate_accounts, p_actor uuid, p_action text, p_before jsonb, p_reason text, p_audience text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select coalesce(nullif(p.full_name,''),u.email,'Account owner') into v_name
    from auth.users u left join public.profiles p on p.id=u.id where u.id=p_actor;
  insert into public.corporate_account_history(account_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(p_account.id,p_actor,coalesce(v_name,'Account owner'),p_action,p_before,to_jsonb(p_account),p_reason);
  insert into public.corporate_account_notifications(account_id,audience,title,message)
    values(p_account.id,p_audience,p_action,p_account.company_name || coalesce(' — ' || p_reason,''));
end $$;

-- The owner's row is locked to serialize retry/double-submit registration. Same input returns the
-- existing record without duplicate history/notices; different input cannot silently overwrite it.
create function corporate_private.create_account(p_owner uuid,p_details jsonb) returns public.corporate_accounts
language plpgsql security definer set search_path = '' as $$
declare v jsonb := corporate_private.clean_details(p_details); a public.corporate_accounts;
begin
  perform 1 from auth.users where id=p_owner for update;
  if not found then raise exception 'Account no longer exists.' using errcode='42501'; end if;
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

-- Check the current identity and registration rules before creating a business account.
create function corporate_private.register_account(p_details jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); a public.corporate_accounts;
begin
  if not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
    raise exception 'Verify your login email before adding a business account.' using errcode='42501';
  end if;
  a := corporate_private.create_account(v_user,p_details);
  return to_jsonb(a);
end $$;

-- The existing Auth trigger creates profiles first. This later trigger copies only validated
-- contact defaults and signup intent, never a role/approval supplied through editable metadata.
create function corporate_private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text := nullif(regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'phone','')), '[[:space:]]+', ' ', 'g'),''); a public.corporate_accounts;
begin
  if v_phone is not null then update public.profiles set phone=v_phone where id=new.id; end if;
  if new.raw_user_meta_data->>'registration_kind' = 'corporate' then
    a := corporate_private.create_account(new.id,new.raw_user_meta_data->'corporate_details');
    update public.profiles set volunteer_enabled=false where id=new.id;
  end if;
  return new;
end $$;
create trigger zz_corporate_signup_foundation after insert on auth.users for each row execute function corporate_private.on_signup();

-- Gate new INSERTs only. Existing bookings, QR/code attendance and cancellation are untouched.
-- Preserve the deployed booking RPC and its existing CSR/capacity/concurrency protections.
create function corporate_private.check_volunteer_booking_contact() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id=new.user_id;
  if p.volunteer_enabled = false then raise exception 'Open a volunteer profile before booking an individual shift.' using errcode='23514'; end if;
  if (select volunteer_phone_required from public.corporate_rollout_settings where id=1) and nullif(btrim(p.phone),'') is null then
    raise exception 'Add your cellphone number in My profile before making a new booking.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger bookings_require_volunteer_contact before insert on public.bookings for each row execute function corporate_private.check_volunteer_booking_contact();

-- Check account ownership before updating company/contact details and recording the change.
create function corporate_private.update_account(p_account_id uuid,p_details jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); v jsonb := corporate_private.clean_details(p_details); a public.corporate_accounts; v_before jsonb;
begin
  select * into a from public.corporate_accounts where id=p_account_id and owner_user_id=v_user for update;
  if not found then raise exception 'Business account not available.' using errcode='42501'; end if;
  v_before := to_jsonb(a);
  if jsonb_build_object('company_name',a.company_name,'contact_name',a.contact_name,'contact_email',a.contact_email,'contact_phone',a.contact_phone,'billing_address',a.billing_address)=v then return v_before; end if;
  update public.corporate_accounts set company_name=v->>'company_name',contact_name=v->>'contact_name',contact_email=v->>'contact_email',contact_phone=v->>'contact_phone',billing_address=v->>'billing_address',updated_at=now() where id=a.id returning * into a;
  perform corporate_private.record_action(a,v_user,'Corporate profile updated',v_before,'Approval is unchanged; existing booking snapshots must remain unchanged.','admin');
  return to_jsonb(a);
end $$;

-- Apply an admin account decision and record its reason, actor and notification.
create function corporate_private.review_account(p_account_id uuid,p_decision text,p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); a public.corporate_accounts; v_before jsonb; v_status text;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Record a reason for this decision.' using errcode='22023'; end if;
  select * into a from public.corporate_accounts where id=p_account_id for update;
  if not found then raise exception 'Business account not found.' using errcode='22023'; end if;
  v_before := to_jsonb(a);
  if p_decision='reconsider' and a.status='Rejected' then v_status:='Awaiting approval';
  elsif p_decision in ('approve','reject') and a.status='Awaiting approval' then
    if p_decision='approve' and not exists(select 1 from auth.users where id=a.owner_user_id and email_confirmed_at is not null) then
      raise exception 'The business contact must verify their login email first.' using errcode='23514';
    end if;
    v_status:=case p_decision when 'approve' then 'Approved' else 'Rejected' end;
  else raise exception 'This account status has changed. Refresh before reviewing it.' using errcode='23514'; end if;
  update public.corporate_accounts set status=v_status,review_reason=btrim(p_reason),reviewed_by=v_user,reviewed_at=now(),updated_at=now() where id=a.id returning * into a;
  perform corporate_private.record_action(a,v_user,'Corporate account: ' || v_status,v_before,btrim(p_reason),'corporate');
  return to_jsonb(a);
end $$;

-- Return account details and history only to the permitted owner or administrator.
create function corporate_private.account_detail(p_account_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); a public.corporate_accounts;
begin
  select * into a from public.corporate_accounts where id=p_account_id and (owner_user_id=v_user or public.is_admin());
  if not found then raise exception 'Business account not available.' using errcode='42501'; end if;
  return jsonb_build_object('account',to_jsonb(a),'email_verified',exists(select 1 from auth.users where id=a.owner_user_id and email_confirmed_at is not null),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc) from
      (select * from public.corporate_account_history where account_id=a.id order by created_at desc,id desc limit 50) h),'[]'::jsonb));
end $$;

-- Return a bounded admin account-search page with its total count.
create function corporate_private.search_accounts(p_query text,p_status text,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_status is null or p_offset < 0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or p_status not in ('','Awaiting approval','Approved','Rejected') then raise exception 'Invalid search parameters.' using errcode='22023'; end if;
  with matched as (
    select a.*, (u.email_confirmed_at is not null) as email_verified from public.corporate_accounts a join auth.users u on u.id=a.owner_user_id
    where (p_status='' or a.status=p_status) and position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',a.company_name,a.contact_name,a.contact_email,a.contact_phone)))>0
  ), paged as (select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Load notices for the allowed account audience with per-user read state.
create function corporate_private.account_notices(p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_offset < 0 or p_limit not between 1 and 100 then raise exception 'Invalid page.' using errcode='22023'; end if;
  with matched as (
    select n.id,n.account_id,n.title,n.message,n.created_at,exists(select 1 from public.corporate_account_notification_reads r where r.user_id=v_user and r.notification_id=n.id) as is_read
    from public.corporate_account_notifications n where (n.audience='admin' and public.is_admin()) or
      (n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=v_user))
  ), paged as (select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Store a read marker for the current user without deleting the notice.
create function corporate_private.read_notice(p_notification_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user();
begin
  if not exists(select 1 from public.corporate_account_notifications n where n.id=p_notification_id and
    ((n.audience='admin' and public.is_admin()) or (n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=v_user)))) then
    raise exception 'Notification not available.' using errcode='42501';
  end if;
  insert into public.corporate_account_notification_reads(notification_id,user_id) values(p_notification_id,v_user) on conflict do nothing;
  return true;
end $$;

-- Let admin save registration availability and the volunteer contact requirement.
create function corporate_private.set_rollout_settings(p_registration_enabled boolean,p_volunteer_phone_required boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_registration_enabled is null or p_volunteer_phone_required is null then raise exception 'Choose both rollout controls.' using errcode='22023'; end if;
  update public.corporate_rollout_settings set registration_enabled=p_registration_enabled,volunteer_phone_required=p_volunteer_phone_required,updated_by=v_user,updated_at=now() where id=1 returning to_jsonb(corporate_rollout_settings.*) into result;
  return result;
end $$;

-- Search volunteer profiles for administrators, including people without bookings.
create function corporate_private.volunteer_directory(p_query text,p_phone_filter text,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_phone_filter is null or p_offset < 0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or p_phone_filter not in ('','missing','provided') then raise exception 'Invalid directory search.' using errcode='22023'; end if;
  with matched as (
    select p.id,p.full_name,p.email,p.phone,p.date_of_birth,(select count(*) from public.bookings b where b.user_id=p.id) as booking_count
    from public.profiles p where p.role='volunteer' and p.volunteer_enabled and
      position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',p.full_name,p.email,p.phone)))>0 and
      (p_phone_filter='' or p_phone_filter='missing' and p.phone is null or p_phone_filter='provided' and p.phone is not null)
  ), paged as (select * from matched order by full_name,id limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.full_name,p.id) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Thin public invoker wrappers are the Data API surface. Do not expose the private schema in PostgREST.
-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.corporate_register_account(p_details jsonb) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.register_account(p_details)$$;
create function public.corporate_update_account(p_account_id uuid,p_details jsonb) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.update_account(p_account_id,p_details)$$;
create function public.corporate_review_account(p_account_id uuid,p_decision text,p_reason text) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.review_account(p_account_id,p_decision,p_reason)$$;
create function public.corporate_account_detail(p_account_id uuid) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.account_detail(p_account_id)$$;
create function public.corporate_search_accounts(p_query text default '',p_status text default '',p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.search_accounts(p_query,p_status,p_offset,p_limit)$$;
create function public.corporate_account_notices(p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.account_notices(p_offset,p_limit)$$;
create function public.corporate_read_account_notice(p_notification_id uuid) returns boolean language sql security invoker set search_path = '' as $$select corporate_private.read_notice(p_notification_id)$$;
create function public.corporate_get_rollout_settings() returns jsonb language sql security invoker set search_path = '' as $$select to_jsonb(s) from public.corporate_rollout_settings s where id=1$$;
create function public.corporate_registration_status() returns jsonb language sql security invoker set search_path = '' as $$select jsonb_build_object('schema_version',schema_version,'registration_enabled',registration_enabled) from public.corporate_rollout_settings$$;
create function public.corporate_set_rollout_settings(p_registration_enabled boolean,p_volunteer_phone_required boolean) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.set_rollout_settings(p_registration_enabled,p_volunteer_phone_required)$$;
create function public.corporate_volunteer_directory(p_query text default '',p_phone_filter text default '',p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path = '' as $$select corporate_private.volunteer_directory(p_query,p_phone_filter,p_offset,p_limit)$$;

revoke all on all functions in schema corporate_private from public,anon,authenticated;
grant execute on function corporate_private.register_account(jsonb),corporate_private.update_account(uuid,jsonb),corporate_private.review_account(uuid,text,text),corporate_private.account_detail(uuid),corporate_private.search_accounts(text,text,integer,integer),corporate_private.account_notices(integer,integer),corporate_private.read_notice(uuid),corporate_private.set_rollout_settings(boolean,boolean),corporate_private.volunteer_directory(text,text,integer,integer) to authenticated;

-- Revoke default PUBLIC execution explicitly, including for anonymous requests.
revoke all on function public.corporate_register_account(jsonb),public.corporate_update_account(uuid,jsonb),public.corporate_review_account(uuid,text,text),public.corporate_account_detail(uuid),public.corporate_search_accounts(text,text,integer,integer),public.corporate_account_notices(integer,integer),public.corporate_read_account_notice(uuid),public.corporate_get_rollout_settings(),public.corporate_set_rollout_settings(boolean,boolean),public.corporate_volunteer_directory(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.corporate_register_account(jsonb),public.corporate_update_account(uuid,jsonb),public.corporate_review_account(uuid,text,text),public.corporate_account_detail(uuid),public.corporate_search_accounts(text,text,integer,integer),public.corporate_account_notices(integer,integer),public.corporate_read_account_notice(uuid),public.corporate_get_rollout_settings(),public.corporate_set_rollout_settings(boolean,boolean),public.corporate_volunteer_directory(text,text,integer,integer) to authenticated;
revoke all on function public.corporate_registration_status() from public,anon,authenticated;
grant execute on function public.corporate_registration_status() to anon,authenticated;

notify pgrst, 'reload schema';
commit;
