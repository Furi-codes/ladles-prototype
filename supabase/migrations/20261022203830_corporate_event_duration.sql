-- Corporate hours now mean the duration of the event, recorded once per group booking.
-- Keep historical combined hours intact; they cannot be safely converted to duration.
begin;
alter table public.corporate_group_attendance add column event_hours integer check(event_hours between 0 and 24);
alter table public.corporate_group_attendance drop constraint corporate_group_attendance_check;
alter table public.corporate_group_attendance add constraint corporate_attendance_event_hours_count_check check(attendance_count>0 or event_hours is null or event_hours=0);
comment on column public.corporate_group_attendance.group_hours is 'Legacy combined person-hours. Not event duration; retained for historical records.';
comment on column public.corporate_group_attendance.event_hours is 'Whole event hours, independent of group size. Null means not yet recorded.';

create or replace function corporate_private.booking_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform corporate_private.require_user();
  return(select jsonb_build_object('booking_schema_version',booking_schema_version,'booking_enabled',booking_enabled,
    'booking_contact_email',booking_contact_email,'booking_contact_phone',booking_contact_phone,
    'changes_schema_version',changes_schema_version,'changes_enabled',changes_enabled,'outcomes_schema_version',outcomes_schema_version,'event_hours_schema_version',1)
    from public.corporate_rollout_settings where id=1);
end $$;

create function corporate_private.record_event_attendance(p_booking_id uuid,p_version integer,p_request_key uuid,p_count integer,p_hours numeric,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); b public.corporate_reservations; e public.corporate_events;
  v_payload jsonb; v_previous jsonb; v_before jsonb; v_actor text;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform corporate_private.lock_workflow();
  if p_request_key is null or p_version is null or p_count is null or p_count<0 or
    (p_hours is not null and (p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<0 or p_hours>24 or trunc(p_hours)<>p_hours or p_count=0 and p_hours>0)) or
    length(btrim(coalesce(p_note,''))) not between 1 and 800 then raise exception 'Check actual attendees, optional whole event hours (0–24) and the required note.' using errcode='22023'; end if;
  select * into b from public.corporate_reservations where id=p_booking_id for update;
  if not found then raise exception 'Booking not available.' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('hours_kind','event','version',p_version,'count',p_count,'hours',p_hours,'note',btrim(p_note));
  select payload into v_previous from corporate_private.attendance_requests where booking_id=b.id and request_key=p_request_key;
  if found then
    if v_previous<>v_payload then raise exception 'This retry key belongs to different attendance details.' using errcode='23505'; end if;
    return corporate_private.booking_json(b);
  end if;
  if b.version<>p_version then raise exception 'This booking changed. Refresh and review before recording attendance.' using errcode='40001'; end if;
  select * into e from public.corporate_events where id=b.event_id;
  if b.status not in ('Confirmed','Completed') or e.cancelled_at is not null or e.ends_at>now() or
    exists(select 1 from public.corporate_booking_changes where booking_id=b.id and status='Requested') then
    raise exception 'Only ended confirmed/completed bookings without unresolved changes can have attendance recorded.' using errcode='23514'; end if;
  if p_count>b.group_size then raise exception 'Actual attendees cannot exceed the booked group size.' using errcode='23514'; end if;
  v_before:=corporate_private.booking_json(b);
  v_actor:=coalesce((select full_name from public.profiles where id=v_user),'Administrator');
  insert into public.corporate_group_attendance(booking_id,attendance_count,event_hours,note,recorded_by,recorded_by_name)
    values(b.id,p_count,p_hours,btrim(p_note),v_user,v_actor)
    on conflict(booking_id) do update set attendance_count=excluded.attendance_count,event_hours=excluded.event_hours,note=excluded.note,
      recorded_by=excluded.recorded_by,recorded_by_name=excluded.recorded_by_name,updated_at=now();
  update public.corporate_reservations set status='Completed',version=version+1,updated_at=now() where id=b.id returning * into b;
  -- Completion retains accepted places and receipts; corrections retain the earlier totals in history.
  insert into public.corporate_workflow_history(account_id,event_id,booking_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(b.account_id,b.event_id,b.id,v_user,v_actor,case when v_before->'attendance' is null or v_before->'attendance'='null'::jsonb then 'Group attendance recorded' else 'Group attendance corrected' end,
      v_before,corporate_private.booking_json(b),btrim(p_note));
  insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id)
    values(b.account_id,'corporate','Group attendance updated','Booking '||b.id||' — '||p_count||' actual attendees. Open the booking to review the attendance and event hours.','booking',b.id);
  insert into corporate_private.attendance_requests values(b.id,p_request_key,v_payload);
  return corporate_private.booking_json(b);
end $$;

create function corporate_private.event_outcome_report(p_query text,p_status text,p_from date,p_to date,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v_admin boolean:=public.is_admin(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_status is null or p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or
    p_status not in ('','Requested','Pending payment','Pending additional payment','Confirmed','Rejected','Cancelled','Completed','Overdue','Change requested','Cancellation requested') or
    (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid report filters.' using errcode='22023'; end if;
  -- One statement snapshot: rows, exact count, summary and revision all cover the same authorised scope.
  with matched as materialized (
    select b.id,b.created_at,corporate_private.booking_json(b) body,b.status,b.group_size,g.attendance_count,g.event_hours,
      e.cancelled_at is null and b.status not in ('Cancelled','Rejected') as eligible,
      b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now() as overdue,
      to_jsonb(a)::text account_revision
    from public.corporate_reservations b join public.corporate_accounts a on a.id=b.account_id join public.corporate_events e on e.id=b.event_id
    left join public.corporate_group_attendance g on g.booking_id=b.id
    where (v_admin or a.owner_user_id=v_user) and
      position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',e.title,a.company_name,b.contact_snapshot->>'company_name',b.contact_snapshot->>'contact_name',b.id::text)))>0 and
      (p_status='' or b.status=p_status or (p_status='Overdue' and b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now()) or
       (p_status in ('Change requested','Cancellation requested') and exists(select 1 from public.corporate_booking_changes c where c.booking_id=b.id and c.status='Requested' and c.kind=case when p_status='Change requested' then 'Amendment' else 'Cancellation' end))) and
      (p_from is null or (e.starts_at at time zone 'Africa/Johannesburg')::date>=p_from) and
      (p_to is null or (e.starts_at at time zone 'Africa/Johannesburg')::date<=p_to)
  ), paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(body order by created_at desc,id desc) from paged),'[]'::jsonb),'total',count(*),
    'summary',jsonb_build_object('bookings',count(*),
      'accepted_places',coalesce(sum(group_size) filter(where eligible and status in ('Pending payment','Pending additional payment','Confirmed','Completed')),0),
      'completed_groups',count(*) filter(where eligible and status='Completed'),
      'attendance_instances',coalesce(sum(attendance_count) filter(where eligible and status='Completed'),0),
      'event_hours',coalesce(sum(event_hours) filter(where eligible and status='Completed'),0),
      'groups_without_hours',count(*) filter(where eligible and status='Completed' and event_hours is null),
      'overdue_bookings',count(*) filter(where eligible and overdue)),
    'snapshot',md5(coalesce(string_agg(body::text||account_revision,'' order by id),''))) into result from matched;
  return result;
end $$;

-- Older clients must not submit combined hours as an event duration.
create or replace function corporate_private.record_attendance(p_booking_id uuid,p_version integer,p_request_key uuid,p_count integer,p_hours numeric,p_note text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin raise exception 'Please refresh or update the corporate portal to record event hours.' using errcode='22023'; end $$;

create function public.corporate_record_event_attendance(p_booking_id uuid,p_version integer,p_request_key uuid,p_count integer,p_hours numeric,p_note text)
returns jsonb language sql security invoker set search_path='' as $$select corporate_private.record_event_attendance(p_booking_id,p_version,p_request_key,p_count,p_hours,p_note)$$;
create function public.corporate_event_outcome_report(p_query text default '',p_status text default '',p_from date default null,p_to date default null,p_offset integer default 0,p_limit integer default 10)
returns jsonb language sql security invoker set search_path='' as $$select corporate_private.event_outcome_report(p_query,p_status,p_from,p_to,p_offset,p_limit)$$;

revoke all on function corporate_private.record_event_attendance(uuid,integer,uuid,integer,numeric,text),corporate_private.event_outcome_report(text,text,date,date,integer,integer),
  public.corporate_record_event_attendance(uuid,integer,uuid,integer,numeric,text),public.corporate_event_outcome_report(text,text,date,date,integer,integer) from public,anon,authenticated;
grant execute on function corporate_private.record_event_attendance(uuid,integer,uuid,integer,numeric,text),corporate_private.event_outcome_report(text,text,date,date,integer,integer),
  public.corporate_record_event_attendance(uuid,integer,uuid,integer,numeric,text),public.corporate_event_outcome_report(text,text,date,date,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
