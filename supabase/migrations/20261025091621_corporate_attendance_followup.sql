-- Adds the outstanding-attendance queue and scheduled admin reminders.
-- A reminder never records attendance automatically; a unique booking/end-time key prevents
-- duplicate notices.

-- Attendance is a manual admin action. This queue/reminder never completes a booking.
alter table public.corporate_account_notifications add column attendance_event_end timestamptz;
create unique index corporate_attendance_notice_once on public.corporate_account_notifications(target_id,attendance_event_end)
  where audience='admin' and attendance_event_end is not null;
create index corporate_attendance_queue_idx on public.corporate_reservations(event_id,id) where status='Confirmed';

-- Identify ended, confirmed sessions that still have no recorded group attendance.
create function corporate_private.attendance_due(b public.corporate_reservations,e public.corporate_events)
returns boolean language sql stable set search_path='' as $$
  select b.status='Confirmed' and e.cancelled_at is null and e.ends_at<=now()
    and not exists(select 1 from public.corporate_group_attendance a where a.booking_id=b.id)
$$;

-- Apply caller visibility and booking/attention filters before returning a booking page.
create or replace function corporate_private.search_bookings(p_query text,p_status text,p_from date,p_to date,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if p_offset is null or p_limit is null or p_status is null or p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_query,''))>180 or
    p_status not in ('','Requested','Pending payment','Pending additional payment','Confirmed','Rejected','Cancelled','Completed','Overdue','Change requested','Cancellation requested','Attendance to record') or
    (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid booking filters.' using errcode='22023'; end if;
  if p_status='Attendance to record' and not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  with matched as (
    select b.* from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id join public.corporate_accounts a on a.id=b.account_id
    where (public.is_admin() or a.owner_user_id=v_user)
      and position(lower(coalesce(p_query,'')) in lower(concat_ws(' ',e.title,a.company_name,b.contact_snapshot->>'company_name',b.contact_snapshot->>'contact_name',b.id::text)))>0
      and (p_status='' or b.status=p_status or
        p_status='Attendance to record' and corporate_private.attendance_due(b,e) or
        p_status in ('Change requested','Cancellation requested') and exists(select 1 from public.corporate_booking_changes c where c.booking_id=b.id and c.status='Requested' and c.kind=case when p_status='Change requested' then 'Amendment' else 'Cancellation' end) or
        p_status='Overdue' and b.status in ('Pending payment','Pending additional payment') and b.payment_due_at<=now())
      and (p_from is null or (e.starts_at at time zone 'Africa/Johannesburg')::date>=p_from)
      and (p_to is null or (e.starts_at at time zone 'Africa/Johannesburg')::date<=p_to)
  ), paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(corporate_private.booking_json(p) order by p.created_at desc,p.id desc) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;

-- Insert one admin attendance reminder per booking/session end; recording remains a manual
-- admin action.
create function corporate_private.enqueue_attendance_notices() returns integer
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
  insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id,attendance_event_end)
    select b.account_id,'admin','Attendance to record',
      e.title||' · '||to_char(e.starts_at at time zone 'Africa/Johannesburg','DD Mon YYYY HH24:MI')||'. '||
      case when exists(select 1 from public.corporate_booking_changes c where c.booking_id=b.id and c.status='Requested')
        then 'Resolve the outstanding change or cancellation request, then record attendance.'
        else 'The session has ended. Record the group attendance.' end,
      'booking',b.id,e.ends_at
    from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id
    where corporate_private.attendance_due(b,e)
    on conflict(target_id,attendance_event_end) where audience='admin' and attendance_event_end is not null do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

-- Return combined admin account/booking notices and the unread total for the current
-- administrator.
create or replace function corporate_private.admin_notices(p_kind text,p_unread boolean,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('','account','booking') or p_unread is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Choose valid notification filters and page.' using errcode='22023'; end if;
  with notices as (
    select n.id,n.account_id,n.title,n.message,n.created_at,n.target_kind,
      case when n.target_kind='account' then n.account_id else n.target_id end target_id,a.company_name,
      n.attendance_event_end is not null attendance_due,
      n.attendance_event_end is not null and exists(select 1 from public.corporate_booking_changes c where c.booking_id=n.target_id and c.status='Requested') attendance_blocked,
      exists(select 1 from public.corporate_account_notification_reads r where r.notification_id=n.id and r.user_id=v_user) is_read
    from public.corporate_account_notifications n join public.corporate_accounts a on a.id=n.account_id
    where n.audience='admin' and (n.attendance_event_end is null or exists(
      select 1 from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id
      where b.id=n.target_id and e.ends_at=n.attendance_event_end and corporate_private.attendance_due(b,e)
    ))
  ), matched as(select * from notices where (p_kind='' or target_kind=p_kind) and (not p_unread or not is_read)),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from paged p),'[]'::jsonb),
    'total',(select count(*) from matched),'unread_total',(select count(*) from notices where not is_read)) into result;
  return result;
end $$;

-- Only the scheduler/database owner can enqueue reminders. Existing inbox RPCs
-- retain their admin checks; businesses cannot read the queue or admin notices.
revoke all on function corporate_private.attendance_due(public.corporate_reservations,public.corporate_events),corporate_private.enqueue_attendance_notices() from public,anon,authenticated;

-- Catch up existing completed sessions once, then check every five minutes.
select corporate_private.enqueue_attendance_notices();
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('vms-corporate-attendance-followup','*/5 * * * *','select corporate_private.enqueue_attendance_notices();');
  end if;
end $$;
notify pgrst,'reload schema';
