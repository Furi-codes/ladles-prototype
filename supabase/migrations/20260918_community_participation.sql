-- Enables the volunteer dashboard chart. Only monthly totals are exposed.
-- Run this file in Supabase SQL Editor; earlier statistics migrations are not required.
begin;

create or replace function public.get_community_participation()
returns table (month_start date, volunteer_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := date_trunc('month', now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('volunteer', 'admin')
  ) then
    raise exception 'Sign in to view community participation.' using errcode = '42501';
  end if;

  return query
  with months as (
    select (v_month_start - make_interval(months => n))::date as starts_on
    from generate_series(0, 5) as series(n)
  ), attendance_totals as (
    select date_trunc('month', a.clocked_in_at at time zone 'Africa/Johannesburg')::date as attended_month,
      count(distinct b.user_id) as total
    from public.attendance_records a
    join public.bookings b on b.id = a.booking_id
    join public.profiles p on p.id = b.user_id
    where p.role = 'volunteer'
      and a.clocked_in_at >= ((v_month_start - interval '5 months') at time zone 'Africa/Johannesburg')
      and a.clocked_in_at <= now()
    group by 1
  )
  select m.starts_on, coalesce(t.total, 0::bigint)
  from months m
  left join attendance_totals t on t.attended_month = m.starts_on
  order by m.starts_on;
end;
$function$;

revoke all on function public.get_community_participation() from public, anon;
grant execute on function public.get_community_participation() to authenticated;

commit;
