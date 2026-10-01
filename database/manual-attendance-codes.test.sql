-- Transactional integration smoke test: no fixtures or attendance changes are committed.
-- Run against the project containing at least one volunteer and one admin profile.
begin;
create temporary table attendance_code_test_results(results jsonb);
do $test$
declare
 v_user uuid; v_admin uuid; v_event bigint; v_slot bigint; v_booking bigint;
 v_in uuid; v_out uuid; v_code text; v_old text; v_new text; v_result jsonb;
 v_local timestamp := now() at time zone 'Africa/Johannesburg';
 v_checks jsonb := '{}'::jsonb; v_denied boolean := false;
begin
 select id into strict v_user from public.profiles where role='volunteer' limit 1;
 select id into strict v_admin from public.profiles where role='admin' limit 1;
 insert into public.events(title,date,location) values ('Attendance code rollback test',v_local::date,'Test only') returning id into v_event;
 insert into public.event_slots(event_id,start_time,end_time,capacity)
 values(v_event,(v_local-interval '5 minutes')::time,(v_local+interval '5 minutes')::time,2) returning id into v_slot;
 insert into public.bookings(event_id,user_id,event_slot_id) values(v_event,v_user,v_slot) returning id into v_booking;
 select id,entry_code into strict v_in,v_code from public.event_attendance_checkpoints where event_id=v_event and action='clock_in';
 select id into strict v_out from public.event_attendance_checkpoints where event_id=v_event and action='clock_out';
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 delete from attendance_private.code_attempts where user_id=v_user;
 v_result := public.record_event_attendance_code('bad');
 v_checks := v_checks || jsonb_build_object('malformed_rejected',v_result->>'error'='Enter the 10-character code shown by the event organiser.');
 v_result := public.record_event_attendance_code(lower(substr(v_code,1,5)||'-'||substr(v_code,6)));
 v_checks := v_checks || jsonb_build_object('formatted_code_clocks_in', v_result->'attendance'->>'clocked_in_at' is not null);
 v_result := public.record_event_attendance_code(v_code);
 v_checks := v_checks || jsonb_build_object('duplicate_clock_in_rejected',v_result->>'error'='You have already clocked in.');
 select entry_code into v_code from public.event_attendance_checkpoints where id=v_out;
 v_result := public.record_event_attendance_code(v_code);
 v_checks := v_checks || jsonb_build_object('clock_out_saved',v_result->'attendance'->>'clocked_out_at' is not null,
 'booking_completed',exists(select 1 from public.bookings where id=v_booking and status='Completed'));
 begin
  perform public.rotate_attendance_entry_code(v_in);
 exception when others then v_denied := SQLERRM='Administrator access required.';
 end;
 v_checks := v_checks || jsonb_build_object('volunteer_rotation_denied',v_denied);
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 v_result := public.record_event_attendance_code((select entry_code from public.event_attendance_checkpoints where id=v_in));
 v_checks := v_checks || jsonb_build_object('unbooked_user_rejected',v_result->>'error'='You do not have a booking for this event.');
 select entry_code into v_old from public.event_attendance_checkpoints where id=v_in;
 v_new := public.rotate_attendance_entry_code(v_in);
 v_checks := v_checks || jsonb_build_object('admin_rotation_saved',v_new<>v_old and exists(select 1 from public.event_attendance_checkpoints where id=v_in and entry_code=v_new));
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 v_result := public.record_event_attendance_code(v_old);
 v_checks := v_checks || jsonb_build_object('replaced_code_rejected',v_result->>'error'='This attendance code is invalid or no longer active.');
 delete from attendance_private.code_attempts where user_id=v_user;
 for i in 1..10 loop perform public.record_event_attendance_code('bad'); end loop;
 v_result := public.record_event_attendance_code('bad');
 v_checks := v_checks || jsonb_build_object('rate_limit_enforced',v_result->>'error'='Too many code attempts. Please wait 10 minutes before trying again.');
 insert into attendance_code_test_results values(v_checks);
end;
$test$;
select results from attendance_code_test_results;
rollback;

