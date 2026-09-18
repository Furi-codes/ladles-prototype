-- Run in Supabase SQL Editor to enable the attendance-based monthly statistic.
-- Works whether or not the earlier registration-statistics function was installed.
begin;

create or replace function public.get_monthly_volunteer_participation()
returns table (month_start date, volunteered_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := date_trunc('month', now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Only administrators can view volunteer statistics.'
      using errcode = '42501';
  end if;

  return query
  select v_month_start, count(distinct booking.user_id)
  from public.attendance_records as attendance
  join public.bookings as booking on booking.id = attendance.booking_id
  join public.profiles as profile on profile.id = booking.user_id
  where profile.role = 'volunteer'
    and attendance.clocked_in_at >= (v_month_start::timestamp at time zone 'Africa/Johannesburg')
    and attendance.clocked_in_at < ((v_month_start + interval '1 month') at time zone 'Africa/Johannesburg')
    and attendance.clocked_in_at <= now();
end;
$function$;

revoke all on function public.get_monthly_volunteer_participation() from public, anon;
grant execute on function public.get_monthly_volunteer_participation() to authenticated;

commit;
