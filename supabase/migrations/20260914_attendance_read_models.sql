-- Read model for live attendance and actual-hour displays.
-- This function exposes only the caller's records, unless the caller is an admin.

begin;

create or replace function public.get_attendance_records()
returns table (
  booking_id bigint,
  clocked_in_at timestamptz,
  clocked_out_at timestamptz,
  worked_minutes integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    attendance.booking_id,
    attendance.clocked_in_at,
    attendance.clocked_out_at,
    attendance.worked_minutes
  from public.attendance_records attendance
  join public.bookings booking
    on booking.id = attendance.booking_id
  where booking.user_id = (select auth.uid())
     or (select public.is_admin())
  order by attendance.clocked_in_at desc nulls last;
$$;

revoke all on function public.get_attendance_records() from public;
grant execute on function public.get_attendance_records() to authenticated;

commit;
