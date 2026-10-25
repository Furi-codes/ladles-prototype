-- Adds corporate sessions, booking requests, payment records and workflow history.
-- This is the original capacity-based workflow; later migrations change sessions to exclusive
-- company reservations.

-- Corporate booking workflow. Requires the account foundation; not applied by Next.js.
-- New corporate UUIDs/capacity have no foreign keys to volunteer events, slots or legacy CSR bookings.
begin;
alter table public.corporate_rollout_settings
  add column booking_schema_version integer not null default 1 check (booking_schema_version=1),
  add column booking_enabled boolean not null default false,
  add column booking_contact_email text not null default '',
  add column booking_contact_phone text not null default '';

create table public.corporate_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(btrim(title)) between 1 and 180),
  description text not null check(length(btrim(description)) between 1 and 2000),
  location text not null check(length(btrim(location)) between 1 and 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check(capacity>0),
  min_group_size integer not null default 1 check(min_group_size>0),
  max_group_size integer not null,
  is_published boolean not null default false,
  reserved_places integer not null default 0 check(reserved_places>=0 and reserved_places<=capacity),
  version integer not null default 1 check(version>0),
  creation_key uuid not null unique,
  creation_payload jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at),
  check((starts_at at time zone 'Africa/Johannesburg')::date=(ends_at at time zone 'Africa/Johannesburg')::date),
  check(max_group_size>=min_group_size and max_group_size<=capacity)
);
create index corporate_events_schedule_idx on public.corporate_events(starts_at,id);

create table public.corporate_reservations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.corporate_accounts(id) on delete restrict,
  event_id uuid not null references public.corporate_events(id) on delete restrict,
  group_size integer not null check(group_size>0),
  status text not null default 'Requested' check(status in ('Requested','Pending payment','Pending additional payment','Confirmed','Rejected','Cancelled','Completed')),
  notes text not null default '' check(length(notes)<=800),
  contact_snapshot jsonb not null,
  event_snapshot jsonb not null,
  request_key uuid not null,
  request_payload jsonb not null,
  payment_due_at timestamptz,
  decision_reason text,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id,request_key),
  check(status not in ('Pending payment','Pending additional payment') or payment_due_at is not null)
);
create index corporate_reservations_event_idx on public.corporate_reservations(event_id,status);
create index corporate_reservations_account_idx on public.corporate_reservations(account_id,created_at desc,id);
create index corporate_reservations_review_idx on public.corporate_reservations(status,payment_due_at,created_at desc,id);

create table public.corporate_payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.corporate_reservations(id) on delete restrict,
  request_key uuid not null,
  reference text not null check(length(btrim(reference)) between 1 and 180),
  received_on date not null,
  note text not null default '' check(length(note)<=800),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_name text not null,
  created_at timestamptz not null default now(),
  unique(booking_id,request_key)
);
create index corporate_payment_records_booking_idx on public.corporate_payment_records(booking_id,created_at,id);

create table public.corporate_workflow_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.corporate_accounts(id) on delete restrict,
  event_id uuid references public.corporate_events(id) on delete restrict,
  booking_id uuid references public.corporate_reservations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  before_values jsonb,
  after_values jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);
create index corporate_workflow_history_booking_idx on public.corporate_workflow_history(booking_id,created_at desc,id);
create index corporate_workflow_history_event_idx on public.corporate_workflow_history(event_id,created_at desc,id);
create index corporate_workflow_history_account_idx on public.corporate_workflow_history(account_id,created_at desc,id);
alter table public.corporate_account_notifications add column target_kind text not null default 'account' check(target_kind in ('account','booking')),
  add column target_id uuid;

-- Check whether the current identity owns an approved, verified business account.
create function corporate_private.approved_owner() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.corporate_accounts a join auth.users u on u.id=a.owner_user_id
    where a.owner_user_id=auth.uid() and a.status='Approved' and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
$$;
alter table public.corporate_events enable row level security;
alter table public.corporate_reservations enable row level security;
alter table public.corporate_payment_records enable row level security;
alter table public.corporate_workflow_history enable row level security;
revoke all on public.corporate_events,public.corporate_reservations,public.corporate_payment_records,public.corporate_workflow_history from public,anon,authenticated;
grant select on public.corporate_events,public.corporate_reservations,public.corporate_payment_records,public.corporate_workflow_history to authenticated;
create policy corporate_reservations_read on public.corporate_reservations for select to authenticated using(
  (select public.is_admin()) or exists(select 1 from public.corporate_accounts a where a.id=account_id and a.owner_user_id=(select auth.uid())));
create policy corporate_events_read on public.corporate_events for select to authenticated using(
  (select public.is_admin()) or (is_published and starts_at>now() and (select corporate_private.approved_owner())) or
  exists(select 1 from public.corporate_reservations b join public.corporate_accounts a on a.id=b.account_id where b.event_id=corporate_events.id and a.owner_user_id=(select auth.uid())));
create policy corporate_payments_read on public.corporate_payment_records for select to authenticated using(
  (select public.is_admin()) or exists(select 1 from public.corporate_reservations b join public.corporate_accounts a on a.id=b.account_id where b.id=booking_id and a.owner_user_id=(select auth.uid())));
create policy corporate_workflow_history_read on public.corporate_workflow_history for select to authenticated using(
  (select public.is_admin()) or exists(select 1 from public.corporate_accounts a where a.id=account_id and a.owner_user_id=(select auth.uid())));

-- One capacity owner: this trigger maintains the event counter for every status change.
-- UPDATE rechecks the predicate on the locked row: two acceptances cannot both spend the same places.
-- With stricter transaction isolation, PostgreSQL can raise a serialization error instead of overbooking.
create function corporate_private.reservation_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare old_hold integer:=0; new_hold integer:=0; delta integer;
begin
  if tg_op='DELETE' then raise exception 'Retain booking history; use a checked booking decision.' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    if new.account_id<>old.account_id or new.event_id<>old.event_id or new.group_size<>old.group_size or new.request_key<>old.request_key
      or new.request_payload<>old.request_payload or new.contact_snapshot<>old.contact_snapshot or new.event_snapshot<>old.event_snapshot then
      raise exception 'Booking identity, submitted details and snapshots cannot be rewritten. A checked amendment workflow is required.' using errcode='23514';
    end if;
    if old.status in ('Pending payment','Pending additional payment','Confirmed','Completed') then old_hold:=old.group_size; end if;
  end if;
  if new.status in ('Pending payment','Pending additional payment','Confirmed','Completed') then new_hold:=new.group_size; end if;
  delta:=new_hold-old_hold;
  if delta<>0 then
    update public.corporate_events set reserved_places=reserved_places+delta
      where id=new.event_id and reserved_places::bigint+delta between 0 and capacity;
    if not found then raise exception 'Insufficient corporate capacity. No booking decision was saved.' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger corporate_reservation_capacity before insert or update or delete on public.corporate_reservations for each row execute function corporate_private.reservation_capacity();

-- Return the saved workflow settings and supported schema versions.
create function corporate_private.booking_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.require_user();
  return (select jsonb_build_object('booking_schema_version',booking_schema_version,'booking_enabled',booking_enabled,
    'booking_contact_email',booking_contact_email,'booking_contact_phone',booking_contact_phone) from public.corporate_rollout_settings where id=1);
end $$;
-- Stop new booking/acceptance operations when requests are closed.
create function corporate_private.require_bookings_open() returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.corporate_rollout_settings where id=1 and booking_enabled and booking_contact_email<>'' and booking_contact_phone<>'') then
    raise exception 'Corporate requests are not open yet. Admin must configure booking contact details and enable this workflow.' using errcode='55000';
  end if;
end $$;
-- Check admin access and contact input before changing booking availability.
create function corporate_private.configure_bookings(p_enabled boolean,p_email text,p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v_before jsonb; result jsonb; v_email text:=btrim(coalesce(p_email,'')); v_phone text:=regexp_replace(btrim(coalesce(p_phone,'')),'[[:space:]]+',' ','g');
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_enabled is null or (p_enabled and (v_email='' or v_phone='')) or
    (v_email<>'' and (length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or
    (v_phone<>'' and (length(v_phone)>25 or v_phone !~ '^\+?[0-9][0-9(). -]*[0-9]$' or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 7 and 15)) then
    raise exception 'Enter approved booking email and phone details before opening corporate requests.' using errcode='22023';
  end if;
  select to_jsonb(s) into v_before from public.corporate_rollout_settings s where id=1 for update;
  if not found then raise exception 'Rollout settings are missing.' using errcode='55000'; end if;
  update public.corporate_rollout_settings set booking_enabled=p_enabled,booking_contact_email=v_email,booking_contact_phone=v_phone,updated_by=v_user,updated_at=now() where id=1 returning to_jsonb(corporate_rollout_settings.*) into result;
  insert into public.corporate_workflow_history(actor_user_id,actor_name,action,before_values,after_values,reason)
    values(v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),'Corporate booking controls updated',v_before,result,'External booking contact and request availability configured.');
  return corporate_private.booking_settings();
end $$;

-- Build the event response, including the current reservation/availability values.
create function corporate_private.event_json(e public.corporate_events) returns jsonb language sql stable set search_path='' as $$
  select (to_jsonb(e)-'creation_key'-'creation_payload') || jsonb_build_object('remaining',e.capacity-e.reserved_places,
    'state',case when e.starts_at<=now() then 'Started' when not e.is_published then 'Closed' when e.capacity-e.reserved_places<e.min_group_size then 'Full' else 'Available' end)
$$;
-- Keep booking history and audience-specific in-app updates with the workflow action.
create function corporate_private.write_workflow_action(b public.corporate_reservations,p_actor uuid,p_action text,p_before jsonb,p_reason text,p_audiences text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor text:=coalesce((select full_name from public.profiles where id=p_actor),'Account owner'); v_audience text;
begin
  insert into public.corporate_workflow_history(account_id,event_id,booking_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(b.account_id,b.event_id,b.id,p_actor,v_actor,p_action,p_before,
      case when p_action='Corporate event updated' then jsonb_build_object('booking',to_jsonb(b),'event',(select corporate_private.event_json(e) from public.corporate_events e where e.id=b.event_id)) else to_jsonb(b) end,p_reason);
  foreach v_audience in array string_to_array(p_audiences,',') loop
    insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id)
      values(b.account_id,v_audience,p_action,'Booking '||b.id||coalesce(' — '||p_reason,''),'booking',b.id);
  end loop;
end $$;

-- Validate event fields before a create or edit operation.
create function corporate_private.clean_event(p_details jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v_start timestamptz; v_end timestamptz; v_capacity integer; v_min integer; v_max integer;
begin
  if jsonb_typeof(p_details) is distinct from 'object' or length(btrim(coalesce(p_details->>'title',''))) not between 1 and 180
    or length(btrim(coalesce(p_details->>'description',''))) not between 1 and 2000 or length(btrim(coalesce(p_details->>'location',''))) not between 1 and 300
    or coalesce(p_details->>'starts_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or coalesce(p_details->>'ends_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
    or jsonb_typeof(p_details->'is_published') is distinct from 'boolean' then
    raise exception 'Enter complete event details and explicit South African or UTC timestamps.' using errcode='22023';
  end if;
  v_start:=(p_details->>'starts_at')::timestamptz; v_end:=(p_details->>'ends_at')::timestamptz;
  v_capacity:=(p_details->>'capacity')::integer; v_min:=(p_details->>'min_group_size')::integer; v_max:=(p_details->>'max_group_size')::integer;
  if v_capacity is null or v_min is null or v_max is null or v_capacity<1 or v_min<1 or v_max<v_min or v_max>v_capacity or v_end<=v_start
    or (v_start at time zone 'Africa/Johannesburg')::date<>(v_end at time zone 'Africa/Johannesburg')::date then
    raise exception 'Use same-day times and whole-number group limits within capacity.' using errcode='22023';
  end if;
  return jsonb_build_object('title',btrim(p_details->>'title'),'description',btrim(p_details->>'description'),'location',btrim(p_details->>'location'),
    'starts_at',v_start,'ends_at',v_end,'capacity',v_capacity,'min_group_size',v_min,'max_group_size',v_max,'is_published',(p_details->>'is_published')::boolean);
end $$;

-- Save an event using the expected version or creation key, and notify affected bookings where
-- required.
create function corporate_private.save_event(p_event_id uuid,p_version integer,p_details jsonb,p_creation_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v jsonb:=corporate_private.clean_event(p_details); e public.corporate_events; v_before jsonb; b public.corporate_reservations;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 1 and 800 then raise exception 'Record a reason / message for this event change.' using errcode='22023'; end if;
  if p_event_id is null then
    if p_creation_key is null then raise exception 'An event creation key is required.' using errcode='22023'; end if;
    -- Serialise identical create intents without locking any volunteer or company records.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_creation_key::text,0));
    select * into e from public.corporate_events where creation_key=p_creation_key;
    if found then
      if e.creation_payload<>v then raise exception 'Creation key was already used for different details.' using errcode='23505'; end if;
      return corporate_private.event_json(e);
    end if;
  else
    select * into e from public.corporate_events where id=p_event_id for update;
    if not found or p_version is distinct from e.version then raise exception 'Event changed. Refresh before saving.' using errcode='40001'; end if;
    if e.starts_at<=clock_timestamp() then raise exception 'An event that has started cannot be moved or rewritten.' using errcode='23514'; end if;
    v_before:=to_jsonb(e);
  end if;
  if (v->>'starts_at')::timestamptz<=clock_timestamp() then raise exception 'Choose a future event start.' using errcode='23514'; end if;
  if p_event_id is null then
    insert into public.corporate_events(title,description,location,starts_at,ends_at,capacity,min_group_size,max_group_size,is_published,creation_key,creation_payload,created_by)
      values(v->>'title',v->>'description',v->>'location',(v->>'starts_at')::timestamptz,(v->>'ends_at')::timestamptz,(v->>'capacity')::integer,(v->>'min_group_size')::integer,(v->>'max_group_size')::integer,(v->>'is_published')::boolean,p_creation_key,v,v_user) returning * into e;
  else
    if (v->>'capacity')::integer<e.reserved_places or exists(select 1 from public.corporate_reservations r where r.event_id=e.id and r.status in ('Pending payment','Pending additional payment','Confirmed','Completed') and
      (r.group_size<(v->>'min_group_size')::integer or r.group_size>(v->>'max_group_size')::integer or
      (r.status in ('Pending payment','Pending additional payment') and r.payment_due_at>=(v->>'starts_at')::timestamptz))) then
      raise exception 'Event changes conflict with accepted groups or payment deadlines. Resolve those bookings first.' using errcode='23514';
    end if;
    update public.corporate_events set title=v->>'title',description=v->>'description',location=v->>'location',starts_at=(v->>'starts_at')::timestamptz,ends_at=(v->>'ends_at')::timestamptz,
      capacity=(v->>'capacity')::integer,min_group_size=(v->>'min_group_size')::integer,max_group_size=(v->>'max_group_size')::integer,is_published=(v->>'is_published')::boolean,version=version+1,updated_at=now() where id=e.id returning * into e;
    for b in update public.corporate_reservations set version=version+1,updated_at=now() where event_id=e.id and status in ('Requested','Pending payment','Pending additional payment','Confirmed') returning * loop
      perform corporate_private.write_workflow_action(b,v_user,'Corporate event updated',jsonb_build_object('event',v_before),btrim(p_reason),'corporate');
    end loop;
  end if;
  insert into public.corporate_workflow_history(event_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(e.id,v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),case when p_event_id is null then 'Corporate event created' else 'Corporate event edited' end,v_before,to_jsonb(e),btrim(p_reason));
  return corporate_private.event_json(e);
end $$;

-- Create a booking request after checking the current event and request key; requesting does
-- not itself accept the booking.
create function corporate_private.request_booking(p_event_id uuid,p_event_version integer,p_group_size integer,p_notes text,p_request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); a public.corporate_accounts; e public.corporate_events; b public.corporate_reservations;
  payload jsonb:=jsonb_build_object('event_id',p_event_id,'event_version',p_event_version,'group_size',p_group_size,'notes',btrim(coalesce(p_notes,'')));
begin
  select * into a from public.corporate_accounts where owner_user_id=v_user and status='Approved' for share;
  if not found or not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
    raise exception 'Verify your email and obtain business account approval first.' using errcode='42501';
  end if;
  if p_request_key is null or p_event_id is null or p_group_size is null or p_group_size<1 or length(coalesce(p_notes,''))>800 then raise exception 'Enter valid group details and a request key.' using errcode='22023'; end if;
  -- A receipt remains retryable even after the event closes or profile contact details change.
  select * into b from public.corporate_reservations where account_id=a.id and request_key=p_request_key;
  if found then
    if b.request_payload<>payload then raise exception 'Request key was already used for a different request.' using errcode='23505'; end if;
    return to_jsonb(b);
  end if;
  perform corporate_private.require_bookings_open();
  select * into e from public.corporate_events where id=p_event_id for update;
  if found and p_event_version is distinct from e.version then raise exception 'Event changed. Refresh and review its current details before requesting.' using errcode='40001'; end if;
  if not found or not e.is_published or e.starts_at<=clock_timestamp() or p_group_size<e.min_group_size or p_group_size>e.max_group_size or p_group_size>e.capacity-e.reserved_places then
    raise exception 'Event unavailable, full, or group size outside its limits. No places were reserved.' using errcode='23514';
  end if;
  insert into public.corporate_reservations(account_id,event_id,group_size,notes,contact_snapshot,event_snapshot,request_key,request_payload)
    values(a.id,e.id,p_group_size,btrim(coalesce(p_notes,'')),jsonb_build_object('company_name',a.company_name,'contact_name',a.contact_name,'contact_email',a.contact_email,'contact_phone',a.contact_phone,'billing_address',a.billing_address),corporate_private.event_json(e),p_request_key,payload)
    on conflict(account_id,request_key) do nothing returning * into b;
  if not found then
    select * into b from public.corporate_reservations where account_id=a.id and request_key=p_request_key;
    if b.request_payload<>payload then raise exception 'Request key was already used for a different request.' using errcode='23505'; end if;
    return to_jsonb(b);
  end if;
  perform corporate_private.write_workflow_action(b,v_user,'Booking request received',null,'Requested — no places held. Admin rechecks capacity on acceptance.','admin,corporate');
  return to_jsonb(b);
end $$;

-- Lock order for admin decisions is always event first, booking second. Keep this order in future
-- amendment/cancellation functions too; moving between events must lock both events in ID order.
create function corporate_private.booking_deadline(p_booking_id uuid,p_version integer,p_deadline timestamptz,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); e public.corporate_events; b public.corporate_reservations; event_id uuid; v_before jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select r.event_id into event_id from public.corporate_reservations r where r.id=p_booking_id;
  select * into e from public.corporate_events where id=event_id for update;
  select * into b from public.corporate_reservations where id=p_booking_id for update;
  if not found or b.version is distinct from p_version then raise exception 'Booking changed. Refresh before saving.' using errcode='40001'; end if;
  if b.status not in ('Requested','Pending payment','Pending additional payment') or p_deadline is null or
    p_deadline<=clock_timestamp() or p_deadline>=e.starts_at or length(btrim(coalesce(p_note,''))) not between 1 and 800 then
    raise exception 'Set a future deadline strictly before the event starts and record an external follow-up note.' using errcode='23514';
  end if;
  if b.status='Requested' then
    perform corporate_private.require_bookings_open();
    if not e.is_published or e.starts_at<=clock_timestamp() or b.group_size<e.min_group_size or b.group_size>e.max_group_size then raise exception 'Event is closed or group limits changed. No places were reserved.' using errcode='23514'; end if;
  end if;
  v_before:=to_jsonb(b);
  update public.corporate_reservations set status=case when status='Requested' then 'Pending payment' else status end,payment_due_at=p_deadline,decision_reason=btrim(p_note),version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,case when v_before->>'status'='Requested' then 'Request accepted — payment pending' else 'Payment deadline updated' end,v_before,btrim(p_note),'corporate');
  return to_jsonb(b);
end $$;

-- Close the booking/request with an explanation and release any reservation it held.
create function corporate_private.reject_booking(p_booking_id uuid,p_version integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; event_id uuid; v_before jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select r.event_id into event_id from public.corporate_reservations r where r.id=p_booking_id;
  perform 1 from public.corporate_events where id=event_id for update;
  select * into b from public.corporate_reservations where id=p_booking_id for update;
  if not found or b.version is distinct from p_version then raise exception 'Booking changed. Refresh before rejecting it.' using errcode='40001'; end if;
  if b.status not in ('Requested','Pending payment','Pending additional payment','Confirmed') or length(btrim(coalesce(p_reason,''))) not between 1 and 800 then raise exception 'Only open bookings may be rejected; record a reason and any external payment/refund follow-up.' using errcode='23514'; end if;
  v_before:=to_jsonb(b);
  update public.corporate_reservations set status='Rejected',decision_reason=btrim(p_reason),version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,'Booking rejected',v_before,btrim(p_reason),'corporate');
  return to_jsonb(b);
end $$;

-- Record an external receipt and confirm the eligible booking; no payment is processed by this
-- function.
create function corporate_private.record_payment(p_booking_id uuid,p_version integer,p_request_key uuid,p_reference text,p_received_on date,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; payment public.corporate_payment_records; event_id uuid; v_before jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_request_key is null or p_received_on is null or p_received_on>(clock_timestamp() at time zone 'Africa/Johannesburg')::date
    or length(btrim(coalesce(p_reference,''))) not between 1 and 180 or length(coalesce(p_note,''))>800 then raise exception 'Enter a payment reference, received date no later than today, and a retry key.' using errcode='22023'; end if;
  select r.event_id into event_id from public.corporate_reservations r where r.id=p_booking_id;
  perform 1 from public.corporate_events where id=event_id for update;
  select * into b from public.corporate_reservations where id=p_booking_id for update;
  if not found then raise exception 'Booking not found.' using errcode='22023'; end if;
  select * into payment from public.corporate_payment_records where booking_id=b.id and request_key=p_request_key;
  if found then
    if payment.reference<>btrim(p_reference) or payment.received_on<>p_received_on or payment.note<>btrim(coalesce(p_note,'')) then raise exception 'Payment key was already used for different details.' using errcode='23505'; end if;
    return to_jsonb(b);
  end if;
  if b.version is distinct from p_version then raise exception 'Booking changed. Refresh before recording payment.' using errcode='40001'; end if;
  if b.status not in ('Pending payment','Pending additional payment') then raise exception 'Payment can only confirm a booking that is awaiting payment.' using errcode='23514'; end if;
  v_before:=to_jsonb(b);
  insert into public.corporate_payment_records(booking_id,request_key,reference,received_on,note,recorded_by,recorded_by_name)
    values(b.id,p_request_key,btrim(p_reference),p_received_on,btrim(coalesce(p_note,'')),v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'));
  update public.corporate_reservations set status='Confirmed',version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,'External payment recorded — booking confirmed',v_before,btrim(p_reference)||' — payment processed externally','corporate');
  return to_jsonb(b);
end $$;

-- Build the booking response with related event and workflow state.
create function corporate_private.booking_json(b public.corporate_reservations) returns jsonb language sql stable set search_path='' as $$
  select (to_jsonb(b)-'request_payload'-'request_key') || jsonb_build_object('event',(select corporate_private.event_json(e) from public.corporate_events e where e.id=b.event_id),
    'is_overdue',b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now())
$$;
-- Return a scoped booking review, including its stored workflow details.
create function corporate_private.booking_detail(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations;
begin
  select r.* into b from public.corporate_reservations r join public.corporate_accounts a on a.id=r.account_id where r.id=p_booking_id and (public.is_admin() or a.owner_user_id=v_user);
  if not found then raise exception 'Booking not available.' using errcode='42501'; end if;
  return jsonb_build_object('booking',corporate_private.booking_json(b),'payments',coalesce((select jsonb_agg(to_jsonb(p)-'request_key' order by p.created_at,p.id) from public.corporate_payment_records p where p.booking_id=b.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc) from(select * from public.corporate_workflow_history where booking_id=b.id order by created_at desc,id desc limit 50) h),'[]'::jsonb));
end $$;

-- Apply caller visibility and search/date filters before returning an event page.
create function corporate_private.search_events(p_query text,p_from date,p_to date,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() and not corporate_private.approved_owner() then raise exception 'Approved business account required.' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid event filters.' using errcode='22023'; end if;
  with matched as(select e.* from public.corporate_events e where (public.is_admin() or (e.is_published and e.starts_at>now())) and
    position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',e.title,e.location)))>0 and
    (p_from is null or (e.starts_at at time zone 'Africa/Johannesburg')::date>=p_from) and(p_to is null or (e.starts_at at time zone 'Africa/Johannesburg')::date<=p_to)),
  paged as(select * from matched order by starts_at,id limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(corporate_private.event_json(p) order by p.starts_at,p.id) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;
-- Apply caller visibility and booking/attention filters before returning a booking page.
create function corporate_private.search_bookings(p_query text,p_status text,p_from date,p_to date,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_status is null or p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or
    p_status not in ('','Requested','Pending payment','Pending additional payment','Confirmed','Rejected','Cancelled','Completed','Overdue') or (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid booking filters.' using errcode='22023'; end if;
  with matched as(select b.* from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id join public.corporate_accounts a on a.id=b.account_id where (public.is_admin() or a.owner_user_id=v_user) and
    position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',e.title,a.company_name,b.contact_snapshot->>'company_name',b.contact_snapshot->>'contact_name',b.id::text)))>0 and
    (p_status='' or b.status=p_status or (p_status='Overdue' and b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now())) and
    (p_from is null or (e.starts_at at time zone 'Africa/Johannesburg')::date>=p_from) and(p_to is null or (e.starts_at at time zone 'Africa/Johannesburg')::date<=p_to)),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(corporate_private.booking_json(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Preserve the phase-1 account-notification contract. New booking notices have their own exact destination.
create or replace function corporate_private.account_notices(p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 then raise exception 'Invalid page.' using errcode='22023'; end if;
  with matched as(select n.id,n.account_id,n.title,n.message,n.created_at,exists(select 1 from public.corporate_account_notification_reads r where r.user_id=v_user and r.notification_id=n.id) as is_read
    from public.corporate_account_notifications n where n.target_kind='account' and((n.audience='admin' and public.is_admin()) or(n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=v_user)))),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;
-- Return booking updates for the permitted audience with read state and pagination.
create function corporate_private.workflow_notices(p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 then raise exception 'Invalid page.' using errcode='22023'; end if;
  with matched as(select n.id,n.account_id,n.title,n.message,n.created_at,n.target_id as booking_id,exists(select 1 from public.corporate_account_notification_reads r where r.user_id=v_user and r.notification_id=n.id) as is_read
    from public.corporate_account_notifications n where n.target_kind='booking' and((n.audience='admin' and public.is_admin()) or(n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=v_user)))),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.corporate_booking_settings() returns jsonb language sql security invoker set search_path='' as $$select corporate_private.booking_settings()$$;
create function public.corporate_configure_bookings(p_enabled boolean,p_email text,p_phone text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.configure_bookings(p_enabled,p_email,p_phone)$$;
create function public.corporate_save_event(p_event_id uuid,p_version integer,p_details jsonb,p_creation_key uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.save_event(p_event_id,p_version,p_details,p_creation_key,p_reason)$$;
create function public.corporate_request_booking(p_event_id uuid,p_event_version integer,p_group_size integer,p_notes text,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.request_booking(p_event_id,p_event_version,p_group_size,p_notes,p_request_key)$$;
create function public.corporate_booking_deadline(p_booking_id uuid,p_version integer,p_deadline timestamptz,p_note text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.booking_deadline(p_booking_id,p_version,p_deadline,p_note)$$;
create function public.corporate_reject_booking(p_booking_id uuid,p_version integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.reject_booking(p_booking_id,p_version,p_reason)$$;
create function public.corporate_record_payment(p_booking_id uuid,p_version integer,p_request_key uuid,p_reference text,p_received_on date,p_note text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.record_payment(p_booking_id,p_version,p_request_key,p_reference,p_received_on,p_note)$$;
create function public.corporate_booking_detail(p_booking_id uuid) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.booking_detail(p_booking_id)$$;
create function public.corporate_search_events(p_query text default '',p_from date default null,p_to date default null,p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.search_events(p_query,p_from,p_to,p_offset,p_limit)$$;
create function public.corporate_search_bookings(p_query text default '',p_status text default '',p_from date default null,p_to date default null,p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.search_bookings(p_query,p_status,p_from,p_to,p_offset,p_limit)$$;
create function public.corporate_workflow_notices(p_offset integer default 0,p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.workflow_notices(p_offset,p_limit)$$;

-- Internal helpers/triggers cannot be called by clients. Existing phase-1 grants remain intact.
revoke all on function corporate_private.approved_owner(),corporate_private.reservation_capacity(),corporate_private.booking_settings(),corporate_private.require_bookings_open(),corporate_private.configure_bookings(boolean,text,text),corporate_private.event_json(public.corporate_events),corporate_private.write_workflow_action(public.corporate_reservations,uuid,text,jsonb,text,text),corporate_private.clean_event(jsonb),corporate_private.save_event(uuid,integer,jsonb,uuid,text),corporate_private.request_booking(uuid,integer,integer,text,uuid),corporate_private.booking_deadline(uuid,integer,timestamptz,text),corporate_private.reject_booking(uuid,integer,text),corporate_private.record_payment(uuid,integer,uuid,text,date,text),corporate_private.booking_json(public.corporate_reservations),corporate_private.booking_detail(uuid),corporate_private.search_events(text,date,date,integer,integer),corporate_private.search_bookings(text,text,date,date,integer,integer),corporate_private.workflow_notices(integer,integer) from public,anon,authenticated;
grant execute on function corporate_private.approved_owner(),corporate_private.booking_settings(),corporate_private.configure_bookings(boolean,text,text),corporate_private.save_event(uuid,integer,jsonb,uuid,text),corporate_private.request_booking(uuid,integer,integer,text,uuid),corporate_private.booking_deadline(uuid,integer,timestamptz,text),corporate_private.reject_booking(uuid,integer,text),corporate_private.record_payment(uuid,integer,uuid,text,date,text),corporate_private.booking_detail(uuid),corporate_private.search_events(text,date,date,integer,integer),corporate_private.search_bookings(text,text,date,date,integer,integer),corporate_private.workflow_notices(integer,integer) to authenticated;
revoke all on function public.corporate_booking_settings(),public.corporate_configure_bookings(boolean,text,text),public.corporate_save_event(uuid,integer,jsonb,uuid,text),public.corporate_request_booking(uuid,integer,integer,text,uuid),public.corporate_booking_deadline(uuid,integer,timestamptz,text),public.corporate_reject_booking(uuid,integer,text),public.corporate_record_payment(uuid,integer,uuid,text,date,text),public.corporate_booking_detail(uuid),public.corporate_search_events(text,date,date,integer,integer),public.corporate_search_bookings(text,text,date,date,integer,integer),public.corporate_workflow_notices(integer,integer) from public,anon,authenticated;
grant execute on function public.corporate_booking_settings(),public.corporate_configure_bookings(boolean,text,text),public.corporate_save_event(uuid,integer,jsonb,uuid,text),public.corporate_request_booking(uuid,integer,integer,text,uuid),public.corporate_booking_deadline(uuid,integer,timestamptz,text),public.corporate_reject_booking(uuid,integer,text),public.corporate_record_payment(uuid,integer,uuid,text,date,text),public.corporate_booking_detail(uuid),public.corporate_search_events(text,date,date,integer,integer),public.corporate_search_bookings(text,text,date,date,integer,integer),public.corporate_workflow_notices(integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
