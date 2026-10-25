-- Adds booking amendments, cancellations and event-change handling.
-- The original booking is kept until review, with version checks and a consistent locking order
-- around updates.

-- Corporate booking changes. Requires both earlier migrations; never run from a browser.
begin;
alter table public.corporate_rollout_settings add column changes_schema_version integer not null default 1 check(changes_schema_version=1),
  add column changes_enabled boolean not null default false;
alter table public.corporate_events add column cancelled_at timestamptz, add column cancellation_reason text;
alter table public.corporate_reservations add column additional_payment_amount numeric(12,2) check(additional_payment_amount>0);
alter table public.corporate_payment_records add column additional_amount_snapshot numeric(12,2);

create table public.corporate_booking_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.corporate_reservations(id) on delete restrict,
  account_id uuid not null references public.corporate_accounts(id) on delete restrict,
  kind text not null check(kind in ('Amendment','Cancellation')),
  status text not null default 'Requested' check(status in ('Requested','Approved','Declined','Closed')),
  target_event_id uuid references public.corporate_events(id) on delete restrict,
  target_event_version integer,
  proposed_size integer check(proposed_size>0),
  target_snapshot jsonb,
  original_values jsonb not null,
  reason text not null check(length(btrim(reason)) between 1 and 800),
  request_key uuid not null,
  request_payload jsonb not null,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  additional_amount numeric(12,2) check(additional_amount>0),
  payment_due_at timestamptz,
  unique(booking_id,request_key),
  check((kind='Amendment' and target_event_id is not null and target_event_version is not null and proposed_size is not null and target_snapshot is not null)
    or(kind='Cancellation' and target_event_id is null and target_event_version is null and proposed_size is null and target_snapshot is null))
);
create unique index corporate_booking_one_pending_change on public.corporate_booking_changes(booking_id) where status='Requested';
create index corporate_change_target_idx on public.corporate_booking_changes(target_event_id,status);
create index corporate_change_account_idx on public.corporate_booking_changes(account_id,created_at desc,id);
alter table public.corporate_booking_changes enable row level security;
revoke all on public.corporate_booking_changes from public,anon,authenticated;
grant select on public.corporate_booking_changes to authenticated;
create policy corporate_changes_read on public.corporate_booking_changes for select to authenticated using(
  (select public.is_admin()) or exists(select 1 from public.corporate_accounts a where a.id=account_id and a.owner_user_id=(select auth.uid())));

-- Deliberately serialise the small corporate workflow, not volunteer/WMS traffic.
-- All corporate mutations take this transaction-scoped lock BEFORE event/booking locks. It prevents
-- opposing transfers and event-wide cancellation from taking locks in conflicting orders.
-- No email, payment call or user interaction takes place while holding it. Consider finer locking
-- only with measured traffic and separate-connection race tests; timeouts fail without partial writes.
create function corporate_private.lock_workflow() returns void language sql set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(17364021,3)
$$;
revoke all on function corporate_private.lock_workflow() from public,anon,authenticated;

-- Return the saved workflow settings and supported schema versions.
create or replace function corporate_private.booking_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.require_user();
  return(select jsonb_build_object('booking_schema_version',booking_schema_version,'booking_enabled',booking_enabled,
    'booking_contact_email',booking_contact_email,'booking_contact_phone',booking_contact_phone,
    'changes_schema_version',changes_schema_version,'changes_enabled',changes_enabled) from public.corporate_rollout_settings where id=1);
end $$;
-- Let admin enable or disable new corporate change requests.
create function corporate_private.configure_changes(p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v_before jsonb; v_after jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform corporate_private.lock_workflow();
  if p_enabled is null then raise exception 'Choose whether corporate changes are open.' using errcode='22023'; end if;
  select to_jsonb(s) into v_before from public.corporate_rollout_settings s where id=1 for update;
  update public.corporate_rollout_settings set changes_enabled=p_enabled,updated_by=v_user,updated_at=now() where id=1 returning to_jsonb(corporate_rollout_settings.*) into v_after;
  if not found then raise exception 'Rollout settings are missing.' using errcode='55000'; end if;
  insert into public.corporate_workflow_history(actor_user_id,actor_name,action,before_values,after_values,reason)
    values(v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),'Corporate change controls updated',v_before,v_after,'Change-request availability updated. Existing reservations retained.');
  return corporate_private.booking_settings();
end $$;

-- Build the event response, including the current reservation/availability values.
create or replace function corporate_private.event_json(e public.corporate_events) returns jsonb language sql stable set search_path='' as $$
  select(to_jsonb(e)-'creation_key'-'creation_payload')||jsonb_build_object('remaining',e.capacity-e.reserved_places,
    'state',case when e.cancelled_at is not null then 'Cancelled' when e.starts_at<=now() then 'Started' when not e.is_published then 'Closed' when e.capacity-e.reserved_places<e.min_group_size then 'Full' else 'Available' end)
$$;
-- Build the booking response with related event and workflow state.
create or replace function corporate_private.booking_json(b public.corporate_reservations) returns jsonb language sql stable set search_path='' as $$
  select(to_jsonb(b)-'request_payload'-'request_key')||jsonb_build_object('event',(select corporate_private.event_json(e) from public.corporate_events e where e.id=b.event_id),
    'is_overdue',b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now(),
    'pending_change',(select to_jsonb(c)-'request_key'-'request_payload' from public.corporate_booking_changes c where c.booking_id=b.id and c.status='Requested'))
$$;

-- A cancelled event can never be republished or rewritten. Its capacity counter can still be
-- reduced by booking cancellation. Cancelling is distinct from reversibly closing new requests.
create function corporate_private.cancelled_event_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if old.cancelled_at is not null and (to_jsonb(new)-'reserved_places') is distinct from (to_jsonb(old)-'reserved_places') then
    raise exception 'A cancelled corporate event cannot be republished or edited.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger corporate_cancelled_event_guard before update on public.corporate_events for each row execute function corporate_private.cancelled_event_guard();

-- Check the reservation against event capacity under a database lock.
create or replace function corporate_private.reservation_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare old_hold integer:=0; new_hold integer:=0;
begin
  if tg_op='DELETE' then raise exception 'Retain booking history; use a checked booking decision.' using errcode='23514'; end if;
  perform corporate_private.lock_workflow();
  if tg_op='UPDATE' then
    if new.account_id<>old.account_id or new.request_key<>old.request_key or new.request_payload<>old.request_payload
      or new.contact_snapshot<>old.contact_snapshot or new.event_snapshot<>old.event_snapshot then
      raise exception 'Original booking identity and submission snapshots cannot be rewritten.' using errcode='23514';
    end if;
    if exists(select 1 from public.corporate_booking_changes c where c.booking_id=old.id and c.status='Requested') and new.status not in ('Rejected','Cancelled') and
      (new.status<>old.status or new.payment_due_at is distinct from old.payment_due_at or new.group_size<>old.group_size or new.event_id<>old.event_id) then
      raise exception 'Review the outstanding change or cancellation before changing this booking or recording payment.' using errcode='23514';
    end if;
    if old.status in ('Pending payment','Pending additional payment','Confirmed','Completed') then old_hold:=old.group_size; end if;
  end if;
  if new.status in ('Pending payment','Pending additional payment','Confirmed','Completed') then new_hold:=new.group_size; end if;
  if tg_op='UPDATE' and old.event_id=new.event_id then
    if new_hold<>old_hold then
      update public.corporate_events set reserved_places=reserved_places+new_hold-old_hold where id=new.event_id and reserved_places::bigint+new_hold-old_hold between 0 and capacity;
      if not found then raise exception 'Insufficient corporate capacity. No booking change was saved.' using errcode='23514'; end if;
    end if;
  else
    if old_hold>0 then update public.corporate_events set reserved_places=reserved_places-old_hold where id=old.event_id and reserved_places>=old_hold;
      if not found then raise exception 'Original reservation is inconsistent. No change was saved.' using errcode='23514'; end if;
    end if;
    if new_hold>0 then update public.corporate_events set reserved_places=reserved_places+new_hold where id=new.event_id and cancelled_at is null and reserved_places::bigint+new_hold<=capacity;
      if not found then raise exception 'Insufficient corporate capacity. Original booking retained.' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end $$;

-- If a booking is rejected/cancelled by a different checked workflow, retain and close its
-- outstanding proposal too. The surrounding transaction rolls back both if any step fails.
create function corporate_private.close_booking_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.corporate_booking_changes;
begin
  if new.status in ('Rejected','Cancelled') and old.status is distinct from new.status then
    for c in update public.corporate_booking_changes set status='Closed',reviewed_by=auth.uid(),reviewed_at=now(),review_note='Booking '||lower(new.status)||': '||coalesce(new.decision_reason,'') where booking_id=new.id and status='Requested' returning * loop
      perform corporate_private.write_workflow_action(new,auth.uid(),'Outstanding request closed',jsonb_build_object('change',to_jsonb(c)),c.review_note,'corporate');
    end loop;
  end if;
  return new;
end $$;
create trigger corporate_close_booking_changes after update on public.corporate_reservations for each row execute function corporate_private.close_booking_changes();
-- Preserve the payment amount details used by the change/receipt workflow.
create function corporate_private.payment_amount_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  select additional_payment_amount into new.additional_amount_snapshot from public.corporate_reservations where id=new.booking_id;
  return new;
end $$;
create trigger corporate_payment_amount_snapshot before insert on public.corporate_payment_records for each row execute function corporate_private.payment_amount_snapshot();

-- Store a proposed amendment/cancellation while keeping the current booking unchanged until
-- review.
create function corporate_private.request_change(p_booking_id uuid,p_version integer,p_kind text,p_target_id uuid,p_target_version integer,p_size integer,p_reason text,p_request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; e public.corporate_events; target public.corporate_events; c public.corporate_booking_changes; payload jsonb; credit integer:=0;
begin
  perform corporate_private.lock_workflow();
  select r.* into b from public.corporate_reservations r join public.corporate_accounts a on a.id=r.account_id where r.id=p_booking_id and a.owner_user_id=v_user for update of r;
  if not found or not corporate_private.approved_owner() then raise exception 'An approved business account and your own booking are required.' using errcode='42501'; end if;
  payload:=jsonb_build_object('version',p_version,'kind',p_kind,'target',p_target_id,'target_version',p_target_version,'size',p_size,'reason',btrim(coalesce(p_reason,'')));
  select * into c from public.corporate_booking_changes where booking_id=b.id and request_key=p_request_key;
  if found then
    if c.request_payload<>payload then raise exception 'Change key was already used for different details.' using errcode='23505'; end if;
    return corporate_private.booking_json(b);
  end if;
  if not exists(select 1 from public.corporate_rollout_settings where id=1 and changes_enabled) then raise exception 'New corporate change requests are not open yet.' using errcode='55000'; end if;
  if b.version is distinct from p_version then raise exception 'Booking changed. Refresh before requesting a change.' using errcode='40001'; end if;
  select * into e from public.corporate_events where id=b.event_id for update;
  if b.status not in ('Requested','Pending payment','Pending additional payment','Confirmed') or e.cancelled_at is not null or e.starts_at<=clock_timestamp() then raise exception 'Online changes close when the original event starts or booking closes.' using errcode='23514'; end if;
  if exists(select 1 from public.corporate_booking_changes where booking_id=b.id and status='Requested') then raise exception 'A change or cancellation is already awaiting review.' using errcode='23514'; end if;
  if p_request_key is null or p_kind is null or p_kind not in ('Amendment','Cancellation') or length(btrim(coalesce(p_reason,''))) not between 1 and 800 then raise exception 'Choose a change type, request key and reason.' using errcode='22023'; end if;
  if p_kind='Amendment' then
    select * into target from public.corporate_events where id=p_target_id for update;
    if not found or target.version is distinct from p_target_version then raise exception 'Target event changed. Refresh and review it.' using errcode='40001'; end if;
    if b.event_id=target.id and b.status<>'Requested' then credit:=b.group_size; end if;
    if p_size is null or not target.is_published or target.cancelled_at is not null or target.starts_at<=clock_timestamp() or p_size<target.min_group_size or p_size>target.max_group_size or p_size::bigint>target.capacity-target.reserved_places+credit then raise exception 'Proposed event is unavailable or the group does not fit. Original booking retained.' using errcode='23514'; end if;
    if b.event_id=target.id and p_size=b.group_size then raise exception 'Change the event or group size first.' using errcode='22023'; end if;
  elsif p_target_id is not null or p_target_version is not null or p_size is not null then raise exception 'Cancellation must not include a replacement event or group size.' using errcode='22023';
  end if;
  insert into public.corporate_booking_changes(booking_id,account_id,kind,target_event_id,target_event_version,proposed_size,target_snapshot,original_values,reason,request_key,request_payload,requested_by)
    values(b.id,b.account_id,p_kind,p_target_id,p_target_version,p_size,case when p_kind='Amendment' then corporate_private.event_json(target) end,corporate_private.booking_json(b),btrim(p_reason),p_request_key,payload,v_user) returning * into c;
  update public.corporate_reservations set version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,p_kind||' requested',jsonb_build_object('change',to_jsonb(c)),'Original booking retained. '||btrim(p_reason),'admin,corporate');
  return corporate_private.booking_json(b);
end $$;

-- Apply or decline a proposal after checking the current booking, target session and version.
create function corporate_private.review_change(p_booking_id uuid,p_version integer,p_change_id uuid,p_approve boolean,p_note text,p_amount numeric,p_deadline timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; e public.corporate_events; target public.corporate_events; c public.corporate_booking_changes; v_before jsonb; v_due timestamptz; credit integer:=0;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform corporate_private.lock_workflow();
  select * into b from public.corporate_reservations where id=p_booking_id for update;
  if not found or b.version is distinct from p_version then raise exception 'Booking changed. Refresh before review.' using errcode='40001'; end if;
  select * into c from public.corporate_booking_changes where id=p_change_id and booking_id=b.id and status='Requested' for update;
  if not found then raise exception 'Request is no longer awaiting review.' using errcode='40001'; end if;
  if p_approve is null or length(btrim(coalesce(p_note,''))) not between 1 and 800 or b.status not in ('Requested','Pending payment','Pending additional payment','Confirmed') then raise exception 'Record a decision and external follow-up note for an open booking.' using errcode='22023'; end if;
  if p_amount is not null and(p_amount<=0 or p_amount>9999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity')) then raise exception 'Additional amount must be positive ZAR with at most two decimals.' using errcode='22023'; end if;
  v_before:=corporate_private.booking_json(b); v_due:=b.payment_due_at;
  if p_approve and c.kind='Amendment' then
    if not exists(select 1 from public.corporate_rollout_settings where id=1 and changes_enabled) then raise exception 'Amendment approvals are currently closed.' using errcode='55000'; end if;
    select * into e from public.corporate_events where id=b.event_id for update;
    select * into target from public.corporate_events where id=c.target_event_id for update;
    if target.version is distinct from c.target_event_version then raise exception 'Proposed event changed since submission. Decline this proposal and ask for a fresh reviewed request.' using errcode='40001'; end if;
    if e.starts_at<=clock_timestamp() or e.cancelled_at is not null or target.starts_at<=clock_timestamp() or target.cancelled_at is not null or not target.is_published then raise exception 'Original or proposed event is started, closed or cancelled. Original booking retained.' using errcode='23514'; end if;
    if b.event_id=target.id and b.status<>'Requested' then credit:=b.group_size; end if;
    if c.proposed_size<target.min_group_size or c.proposed_size>target.max_group_size or c.proposed_size::bigint>target.capacity-target.reserved_places+credit then raise exception 'Insufficient corporate capacity or changed limits. Original booking retained.' using errcode='23514'; end if;
    if p_amount is not null then
      if b.status<>'Confirmed' or p_deadline is null or p_deadline<=clock_timestamp() or p_deadline>=target.starts_at then raise exception 'Additional payment requires a confirmed booking and future deadline before the proposed event starts.' using errcode='23514'; end if;
      v_due:=p_deadline;
    elsif b.status in ('Pending payment','Pending additional payment') then
      v_due:=coalesce(p_deadline,b.payment_due_at);
      if v_due<=clock_timestamp() or v_due>=target.starts_at then raise exception 'Set a future payment deadline strictly before the proposed event starts.' using errcode='23514'; end if;
    elsif p_deadline is not null then raise exception 'No payment deadline is needed for this change.' using errcode='22023'; end if;
  elsif p_amount is not null or p_deadline is not null then raise exception 'Only an approved amendment can adjust payment.' using errcode='22023'; end if;
  -- Close the pending proposal before updating the booking, so its guard allows this checked decision.
  update public.corporate_booking_changes set status=case when p_approve then 'Approved' else 'Declined' end,reviewed_by=v_user,reviewed_at=now(),review_note=btrim(p_note),additional_amount=p_amount,payment_due_at=case when p_approve and c.kind='Amendment' then v_due end where id=c.id;
  update public.corporate_reservations set event_id=case when p_approve and c.kind='Amendment' then c.target_event_id else event_id end,
    group_size=case when p_approve and c.kind='Amendment' then c.proposed_size else group_size end,
    status=case when p_approve and c.kind='Cancellation' then 'Cancelled' when p_approve and p_amount is not null then 'Pending additional payment' else status end,
    payment_due_at=case when p_approve and c.kind='Amendment' then v_due else payment_due_at end,
    additional_payment_amount=case when p_approve and p_amount is not null then p_amount else additional_payment_amount end,
    decision_reason=btrim(p_note),version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,c.kind||case when p_approve then ' approved' else ' declined' end,jsonb_build_object('booking',v_before,'change',to_jsonb(c)),btrim(p_note),'corporate');
  return corporate_private.booking_json(b);
end $$;

-- Cancel the event and handle its affected bookings with a recorded explanation.
create function corporate_private.cancel_event(p_event_id uuid,p_version integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); e public.corporate_events; b public.corporate_reservations; c public.corporate_booking_changes; v_before jsonb; v_booking_before jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform corporate_private.lock_workflow();
  select * into e from public.corporate_events where id=p_event_id for update;
  if not found or e.version is distinct from p_version then raise exception 'Event changed. Refresh before cancelling.' using errcode='40001'; end if;
  if e.cancelled_at is not null or e.ends_at<=clock_timestamp() or length(btrim(coalesce(p_reason,''))) not between 1 and 800 then raise exception 'Only an active, unfinished event can be cancelled; record a reason and external follow-up.' using errcode='23514'; end if;
  v_before:=to_jsonb(e);
  update public.corporate_events set cancelled_at=now(),cancellation_reason=btrim(p_reason),is_published=false,version=version+1,updated_at=now() where id=e.id;
  for b in select * from public.corporate_reservations where event_id=e.id and status in ('Requested','Pending payment','Pending additional payment','Confirmed') order by id for update loop
    v_booking_before:=to_jsonb(b);
    update public.corporate_reservations set status='Cancelled',decision_reason='Event cancelled: '||btrim(p_reason),version=version+1,updated_at=now() where id=b.id returning * into b;
    perform corporate_private.write_workflow_action(b,v_user,'Corporate event cancelled',jsonb_build_object('booking',v_booking_before,'event',v_before),btrim(p_reason)||' Any refund is handled externally.','corporate');
  end loop;
  -- A booking proposing this cancelled event, but still reserved elsewhere, keeps its original.
  for c in select * from public.corporate_booking_changes where target_event_id=e.id and status='Requested' order by booking_id for update loop
    update public.corporate_booking_changes set status='Declined',reviewed_by=v_user,reviewed_at=now(),review_note='Proposed event cancelled. Original booking retained.' where id=c.id;
    update public.corporate_reservations set version=version+1,updated_at=now() where id=c.booking_id returning * into b;
    perform corporate_private.write_workflow_action(b,v_user,'Amendment declined',jsonb_build_object('change',to_jsonb(c)),'Proposed event cancelled. Original booking retained.','corporate');
  end loop;
  select * into e from public.corporate_events where id=p_event_id;
  insert into public.corporate_workflow_history(event_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(e.id,v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),'Corporate event cancelled',v_before,to_jsonb(e),btrim(p_reason));
  return corporate_private.event_json(e);
end $$;

-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.corporate_configure_changes(p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.configure_changes(p_enabled)$$;
create function public.corporate_request_change(p_booking_id uuid,p_version integer,p_kind text,p_target_id uuid,p_target_version integer,p_size integer,p_reason text,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.request_change(p_booking_id,p_version,p_kind,p_target_id,p_target_version,p_size,p_reason,p_request_key)$$;
create function public.corporate_review_change(p_booking_id uuid,p_version integer,p_change_id uuid,p_approve boolean,p_note text,p_amount numeric default null,p_deadline timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.review_change(p_booking_id,p_version,p_change_id,p_approve,p_note,p_amount,p_deadline)$$;
create function public.corporate_cancel_event(p_event_id uuid,p_version integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select corporate_private.cancel_event(p_event_id,p_version,p_reason)$$;

revoke all on function corporate_private.configure_changes(boolean),corporate_private.cancelled_event_guard(),corporate_private.close_booking_changes(),corporate_private.payment_amount_snapshot(),corporate_private.request_change(uuid,integer,text,uuid,integer,integer,text,uuid),corporate_private.review_change(uuid,integer,uuid,boolean,text,numeric,timestamptz),corporate_private.cancel_event(uuid,integer,text),public.corporate_configure_changes(boolean),public.corporate_request_change(uuid,integer,text,uuid,integer,integer,text,uuid),public.corporate_review_change(uuid,integer,uuid,boolean,text,numeric,timestamptz),public.corporate_cancel_event(uuid,integer,text) from public,anon,authenticated;
grant execute on function corporate_private.configure_changes(boolean),corporate_private.request_change(uuid,integer,text,uuid,integer,integer,text,uuid),corporate_private.review_change(uuid,integer,uuid,boolean,text,numeric,timestamptz),corporate_private.cancel_event(uuid,integer,text),public.corporate_configure_changes(boolean),public.corporate_request_change(uuid,integer,text,uuid,integer,integer,text,uuid),public.corporate_review_change(uuid,integer,uuid,boolean,text,numeric,timestamptz),public.corporate_cancel_event(uuid,integer,text) to authenticated;

-- Check admin access and contact input before changing booking availability.
create or replace function corporate_private.configure_bookings(p_enabled boolean,p_email text,p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v_before jsonb; result jsonb; v_email text:=btrim(coalesce(p_email,'')); v_phone text:=regexp_replace(btrim(coalesce(p_phone,'')),'[[:space:]]+',' ','g');
begin
  perform corporate_private.lock_workflow();
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

-- Save an event using the expected version or creation key, and notify affected bookings where
-- required.
create or replace function corporate_private.save_event(p_event_id uuid,p_version integer,p_details jsonb,p_creation_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v jsonb:=corporate_private.clean_event(p_details); e public.corporate_events; v_before jsonb; b public.corporate_reservations;
begin
  perform corporate_private.lock_workflow();
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
    -- Proposed destinations do not hold places, but the company still needs to hear if that
    -- destination changes. Keep its submitted proposal unchanged for review/history.
    for b in update public.corporate_reservations set version=version+1,updated_at=now() where event_id<>e.id and id in
      (select booking_id from public.corporate_booking_changes where target_event_id=e.id and status='Requested') returning * loop
      perform corporate_private.write_workflow_action(b,v_user,'Proposed corporate event updated',jsonb_build_object('event',v_before),btrim(p_reason)||' Original booking retained. Proposed event changed; admin must decline the stale proposal before a fresh request.','corporate');
    end loop;
  end if;
  insert into public.corporate_workflow_history(event_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(e.id,v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),case when p_event_id is null then 'Corporate event created' else 'Corporate event edited' end,v_before,to_jsonb(e),btrim(p_reason));
  return corporate_private.event_json(e);
end $$;

-- Create a booking request after checking the current event and request key; requesting does
-- not itself accept the booking.
create or replace function corporate_private.request_booking(p_event_id uuid,p_event_version integer,p_group_size integer,p_notes text,p_request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); a public.corporate_accounts; e public.corporate_events; b public.corporate_reservations;
  payload jsonb:=jsonb_build_object('event_id',p_event_id,'event_version',p_event_version,'group_size',p_group_size,'notes',btrim(coalesce(p_notes,'')));
begin
  perform corporate_private.lock_workflow();
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

-- Accept or update the payment deadline using the current booking version and decision note.
create or replace function corporate_private.booking_deadline(p_booking_id uuid,p_version integer,p_deadline timestamptz,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); e public.corporate_events; b public.corporate_reservations; event_id uuid; v_before jsonb;
begin
  perform corporate_private.lock_workflow();
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
  if exists(select 1 from public.corporate_booking_changes where booking_id=b.id and status='Requested') then
    raise exception 'Review the outstanding change or cancellation before setting a deadline.' using errcode='23514';
  end if;
  v_before:=to_jsonb(b);
  update public.corporate_reservations set status=case when status='Requested' then 'Pending payment' else status end,payment_due_at=p_deadline,decision_reason=btrim(p_note),version=version+1,updated_at=now() where id=b.id returning * into b;
  perform corporate_private.write_workflow_action(b,v_user,case when v_before->>'status'='Requested' then 'Request accepted — payment pending' else 'Payment deadline updated' end,v_before,btrim(p_note),'corporate');
  return to_jsonb(b);
end $$;

-- Close the booking/request with an explanation and release any reservation it held.
create or replace function corporate_private.reject_booking(p_booking_id uuid,p_version integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; event_id uuid; v_before jsonb;
begin
  perform corporate_private.lock_workflow();
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
create or replace function corporate_private.record_payment(p_booking_id uuid,p_version integer,p_request_key uuid,p_reference text,p_received_on date,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; payment public.corporate_payment_records; event_id uuid; v_before jsonb;
begin
  perform corporate_private.lock_workflow();
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

-- Keep booking history and audience-specific in-app updates with the workflow action.
create or replace function corporate_private.write_workflow_action(b public.corporate_reservations,p_actor uuid,p_action text,p_before jsonb,p_reason text,p_audiences text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor text:=coalesce((select full_name from public.profiles where id=p_actor),'Account owner'); v_audience text; v_after jsonb:=to_jsonb(b);
begin
  if p_action='Corporate event updated' then
    v_after:=jsonb_build_object('booking',to_jsonb(b),'event',(select corporate_private.event_json(e) from public.corporate_events e where e.id=b.event_id));
  elsif p_action='Proposed corporate event updated' then
    v_after:=jsonb_build_object('booking',to_jsonb(b),'proposed_event',(select corporate_private.event_json(e) from public.corporate_events e join public.corporate_booking_changes c on c.target_event_id=e.id where c.booking_id=b.id and c.status='Requested'));
  end if;
  insert into public.corporate_workflow_history(account_id,event_id,booking_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(b.account_id,b.event_id,b.id,p_actor,v_actor,p_action,p_before,v_after,p_reason);
  foreach v_audience in array string_to_array(p_audiences,',') loop
    insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id)
      values(b.account_id,v_audience,p_action,'Booking '||b.id||coalesce(' — '||p_reason,''),'booking',b.id);
  end loop;
end $$;

-- Return a scoped booking review, including its stored workflow details.
create or replace function corporate_private.booking_detail(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations;
begin
  select r.* into b from public.corporate_reservations r join public.corporate_accounts a on a.id=r.account_id where r.id=p_booking_id and (public.is_admin() or a.owner_user_id=v_user);
  if not found then raise exception 'Booking not available.' using errcode='42501'; end if;
  return jsonb_build_object('booking',corporate_private.booking_json(b),'payments',coalesce((select jsonb_agg(to_jsonb(p)-'request_key' order by p.created_at,p.id) from public.corporate_payment_records p where p.booking_id=b.id),'[]'::jsonb),
    'changes',coalesce((select jsonb_agg(to_jsonb(c)-'request_key'-'request_payload' order by c.created_at desc,c.id desc) from(select * from public.corporate_booking_changes where booking_id=b.id order by created_at desc,id desc limit 50)c),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc) from(select * from public.corporate_workflow_history where booking_id=b.id order by created_at desc,id desc limit 50) h),'[]'::jsonb));
end $$;

-- Apply caller visibility and booking/attention filters before returning a booking page.
create or replace function corporate_private.search_bookings(p_query text,p_status text,p_from date,p_to date,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_status is null or p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or
    p_status not in ('','Requested','Pending payment','Pending additional payment','Confirmed','Rejected','Cancelled','Completed','Overdue','Change requested','Cancellation requested') or (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid booking filters.' using errcode='22023'; end if;
  with matched as(select b.* from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id join public.corporate_accounts a on a.id=b.account_id where (public.is_admin() or a.owner_user_id=v_user) and
    position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',e.title,a.company_name,b.contact_snapshot->>'company_name',b.contact_snapshot->>'contact_name',b.id::text)))>0 and
    (p_status='' or b.status=p_status or (p_status in ('Change requested','Cancellation requested') and exists(select 1 from public.corporate_booking_changes c where c.booking_id=b.id and c.status='Requested' and c.kind=case when p_status='Change requested' then 'Amendment' else 'Cancellation' end)) or (p_status='Overdue' and b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now())) and
    (p_from is null or (e.starts_at at time zone 'Africa/Johannesburg')::date>=p_from) and(p_to is null or (e.starts_at at time zone 'Africa/Johannesburg')::date<=p_to)),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(corporate_private.booking_json(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;
notify pgrst,'reload schema';
commit;
