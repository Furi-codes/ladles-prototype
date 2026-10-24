-- Each corporate event is one exclusive session. Volunteer/WMS tables are untouched.
begin;

-- Fail rather than silently discard real reservations if an older database has shared sessions.
do $$ begin
  if exists(select 1 from public.corporate_reservations where status in ('Pending payment','Pending additional payment','Confirmed','Completed') group by event_id having count(*)>1) then
    raise exception 'Resolve existing shared corporate reservations before enabling exclusive sessions.';
  end if;
end $$;

-- The unique index is the final concurrency guarantee, even for writes outside our RPCs.
-- Completed bookings keep their historical session; rejected/cancelled bookings release it.
create unique index corporate_one_reserved_session on public.corporate_reservations(event_id)
  where status in ('Pending payment','Pending additional payment','Confirmed','Completed');

create or replace function corporate_private.event_json(e public.corporate_events) returns jsonb language sql stable set search_path='' as $$
  select(to_jsonb(e)-'creation_key'-'creation_payload')||jsonb_build_object(
    'remaining',case when e.reserved_places>0 then 0 else e.max_group_size end,
    'state',case when e.cancelled_at is not null then 'Cancelled' when e.starts_at<=now() then 'Started'
      when e.reserved_places>0 then 'Reserved' when not e.is_published then 'Closed' else 'Available' end)
$$;

create or replace function corporate_private.booking_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.require_user();
  return(select jsonb_build_object('booking_schema_version',booking_schema_version,'booking_enabled',booking_enabled,
    'booking_contact_email',booking_contact_email,'booking_contact_phone',booking_contact_phone,
    'changes_schema_version',changes_schema_version,'changes_enabled',changes_enabled,'outcomes_schema_version',outcomes_schema_version,
    'event_hours_schema_version',1,'exclusive_sessions_schema_version',1) from public.corporate_rollout_settings where id=1);
end $$;

-- Keep the old transport fields for compatibility, but there is now only one editable size limit.
-- The existing cleaner still checks timestamps, lengths, booleans and integer group sizes.
alter function corporate_private.clean_event(jsonb) rename to clean_event_before_exclusive;
create function corporate_private.clean_event(p_details jsonb) returns jsonb language plpgsql set search_path='' as $$
begin
  if p_details->>'min_group_size' is distinct from '1' or p_details->>'capacity' is distinct from p_details->>'max_group_size' then
    raise exception 'Exclusive sessions use one maximum group size. Refresh the portal before saving.' using errcode='22023';
  end if;
  return corporate_private.clean_event_before_exclusive(p_details);
end $$;

-- This runs before the existing capacity/snapshot trigger. The counter remains actual booked
-- headcount for historical compatibility, but no other booking can spend its unused places.
create function corporate_private.exclusive_reservation_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.lock_workflow();
  if new.status in ('Requested','Pending payment','Pending additional payment','Confirmed','Completed') and
    exists(select 1 from public.corporate_reservations r where r.event_id=new.event_id and r.id<>new.id
      and r.status in ('Pending payment','Pending additional payment','Confirmed','Completed')) then
    raise exception 'This exclusive session is already reserved. Refresh and choose another available session. Your original booking is unchanged.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger corporate_exclusive_guard before insert or update on public.corporate_reservations for each row execute function corporate_private.exclusive_reservation_guard();

create function corporate_private.exclusive_change_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.lock_workflow();
  if new.kind='Amendment' and new.status in ('Requested','Approved') and
    exists(select 1 from public.corporate_reservations r where r.event_id=new.target_event_id and r.id<>new.booking_id
      and r.status in ('Pending payment','Pending additional payment','Confirmed','Completed')) then
    raise exception 'The proposed exclusive session is already reserved. Choose another session; your original booking is unchanged.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger corporate_exclusive_change_guard before insert or update on public.corporate_booking_changes for each row execute function corporate_private.exclusive_change_guard();

-- Preserve the audit note verbatim; add next steps to the notification, not the history evidence.
create or replace function corporate_private.write_workflow_action(b public.corporate_reservations,p_actor uuid,p_action text,p_before jsonb,p_reason text,p_audiences text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor text:=coalesce((select full_name from public.profiles where id=p_actor),'Account owner'); v_audience text; v_next text; v_after jsonb:=to_jsonb(b);
begin
  if p_action='Corporate event updated' then
    v_after:=jsonb_build_object('booking',to_jsonb(b),'event',(select corporate_private.event_json(e) from public.corporate_events e where e.id=b.event_id));
  elsif p_action='Proposed corporate event updated' then
    v_after:=jsonb_build_object('booking',to_jsonb(b),'proposed_event',(select corporate_private.event_json(e) from public.corporate_events e join public.corporate_booking_changes c on c.target_event_id=e.id where c.booking_id=b.id and c.status='Requested'));
  end if;
  insert into public.corporate_workflow_history(account_id,event_id,booking_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(b.account_id,b.event_id,b.id,p_actor,v_actor,p_action,p_before,v_after,p_reason);
  v_next:=case
    when b.status='Rejected' then 'This request is closed and does not hold a session. You may request another available session. Discuss any payment/refund with the booking team externally.'
    when b.status='Cancelled' then 'This booking is cancelled. Do not attend on this booking. You may request another available session; arrange any refund externally with the booking team.'
    when p_action in ('Amendment requested','Cancellation requested') then 'Wait for admin review in My bookings. Your original booking is unchanged; an unaccepted request still reserves nothing. Do not assume a proposed session is reserved.'
    when p_action in ('Amendment declined','Cancellation declined','Outstanding request closed') then 'Review the decision in My bookings. Your original booking remains unchanged unless it has been rejected or cancelled.'
    when b.status='Requested' then 'Submitting a request does not reserve the session. Wait for admin acceptance in My bookings before arranging payment or attendance.'
    when b.status in ('Pending payment','Pending additional payment') then 'The whole session is held for your company. Open My bookings and arrange external payment with the booking team by '
      ||to_char(b.payment_due_at at time zone 'Africa/Johannesburg','DD Mon YYYY HH24:MI')||' (South African time). Admin confirms receipt. Overdue bookings remain held until admin decides otherwise.'
    when b.status='Confirmed' then 'Your booking is confirmed and the session is reserved for your company. Check the current date, time, location and group size in My bookings before attending.'
    when b.status='Completed' then 'Admin has recorded attendance. Review the actual attendees and whole event hours in Group reports. Contact the booking team if a correction is needed.'
    else 'Open My bookings to review the latest details.' end;
  foreach v_audience in array string_to_array(p_audiences,',') loop
    insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id)
      values(b.account_id,v_audience,p_action,'Booking '||b.id||coalesce(' — '||p_reason,'')||' '||
        case when v_audience='admin' then 'Open the booking to review the request and contact the company externally as needed. No proposed session is reserved until acceptance.' else v_next end,'booking',b.id);
  end loop;
end $$;

-- Acceptance (including an approved transfer) resolves competing requests atomically.
-- No company is told it has a reservation which another transaction can also take.
create function corporate_private.resolve_exclusive_requests() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.corporate_reservations; c public.corporate_booking_changes; v_before jsonb;
begin
  if new.status not in ('Pending payment','Pending additional payment','Confirmed','Completed') then return new; end if;
  if tg_op='UPDATE' then
    if old.event_id=new.event_id and old.status in ('Pending payment','Pending additional payment','Confirmed','Completed') then return new; end if;
  end if;
  for b in select * from public.corporate_reservations where event_id=new.event_id and id<>new.id and status='Requested' order by id for update loop
    v_before:=to_jsonb(b);
    update public.corporate_reservations set status='Rejected',decision_reason='This exclusive session was reserved when admin accepted another booking. Please choose another available session.',version=version+1,updated_at=now() where id=b.id returning * into b;
    perform corporate_private.write_workflow_action(b,auth.uid(),'Session no longer available',v_before,b.decision_reason,'corporate');
  end loop;
  for c in select * from public.corporate_booking_changes where target_event_id=new.event_id and booking_id<>new.id and status='Requested' order by id for update loop
    update public.corporate_booking_changes set status='Declined',reviewed_by=auth.uid(),reviewed_at=now(),review_note='Proposed session reserved by another booking. Original booking retained; choose another session for a new change request.' where id=c.id;
    update public.corporate_reservations set version=version+1,updated_at=now() where id=c.booking_id returning * into b;
    perform corporate_private.write_workflow_action(b,auth.uid(),'Amendment declined',jsonb_build_object('change',to_jsonb(c)),'Proposed session reserved by another booking. Original booking retained; choose another available session.','corporate');
  end loop;
  return new;
end $$;
create trigger corporate_resolve_exclusive_requests after insert or update on public.corporate_reservations for each row execute function corporate_private.resolve_exclusive_requests();

create or replace function corporate_private.record_action(p_account public.corporate_accounts,p_actor uuid,p_action text,p_before jsonb,p_reason text,p_audience text)
returns void language plpgsql security definer set search_path='' as $$
declare v_name text; v_next text;
begin
  select coalesce(nullif(p.full_name,''),u.email,'Account owner') into v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=p_actor;
  insert into public.corporate_account_history(account_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(p_account.id,p_actor,coalesce(v_name,'Account owner'),p_action,p_before,to_jsonb(p_account),p_reason);
  v_next:=case when p_audience='admin' then 'Open the company account to review its details and contact the main contact externally.'
    when p_account.status='Approved' then 'You can now browse available corporate sessions and submit a request. A request reserves nothing until admin accepts it.'
    when p_account.status='Rejected' then 'Your account is not approved for booking requests. Review the reason in Business profile and contact the team externally if you want reconsideration; do not register a duplicate account.'
    else 'Check Business profile for the review outcome. Verify your sign-in email if needed; booking requests become available after admin approval.' end;
  insert into public.corporate_account_notifications(account_id,audience,title,message)
    values(p_account.id,p_audience,p_action,p_account.company_name||coalesce(' — '||p_reason,'')||' '||v_next);
end $$;

revoke all on function corporate_private.clean_event(jsonb),corporate_private.clean_event_before_exclusive(jsonb),
  corporate_private.exclusive_reservation_guard(),corporate_private.exclusive_change_guard(),corporate_private.resolve_exclusive_requests() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
