-- Rollback-only integration tests; requires two volunteer profiles.
begin;
create temporary table reminder_checks(result jsonb);
do $test$
declare
 v_user uuid; v_other uuid; v_admin uuid; v_event bigint; v_slot bigint; v_id bigint;
 v_now timestamptz := ((current_date+30)+time '09:00') at time zone 'Africa/Johannesburg';
 v_start timestamptz; v_events bigint[] := '{}'; v_checks jsonb := '{}';
begin
 select id into strict v_user from public.profiles where role='volunteer' limit 1;
 select id into strict v_other from public.profiles where role='volunteer' and id<>v_user limit 1;
 select id into strict v_admin from public.profiles where role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 update public.organisation_settings set shift_reminder_enabled=true where id=1;
 for i in 1..4 loop
  v_start := v_now + case i when 1 then interval '24 hours' when 2 then interval '2 hours' when 3 then interval '30 hours' else interval '1 hour' end;
  insert into public.events(title,date,location) values('Reminder rollback test',(v_start at time zone 'Africa/Johannesburg')::date,'Test only') returning id into v_event;
  v_events := array_append(v_events,v_event);
  insert into public.event_slots(event_id,start_time,end_time,capacity) values(v_event,(v_start at time zone 'Africa/Johannesburg')::time,((v_start+interval '1 hour') at time zone 'Africa/Johannesburg')::time,2) returning id into v_slot;
  insert into public.bookings(event_id,event_slot_id,user_id) values(v_event,v_slot,v_user) returning id into v_id;
  if i=4 then perform public.cancel_event(v_event,'Rollback test cancellation'); end if;
 end loop;
 perform notification_private.generate_shift_reminders(v_now);
 v_checks := jsonb_build_object('24h_reminder_created',exists(select 1 from public.notifications where event_id=v_events[1] and type='shift_reminder_24h'),
 '2h_reminder_created',exists(select 1 from public.notifications where event_id=v_events[2] and type='shift_reminder_2h'),
 'far_future_skipped',not exists(select 1 from public.notifications where event_id=v_events[3]),
 'cancelled_skipped',not exists(select 1 from public.notifications where event_id=v_events[4] and type like 'shift_reminder_%'));
 perform notification_private.generate_shift_reminders(v_now);
 v_checks := v_checks || jsonb_build_object('no_duplicate_reminders',(select count(*)=2 from public.notifications where event_id=any(v_events) and type like 'shift_reminder_%'));
 update public.notifications set is_read=true where event_id=v_events[1];
 perform notification_private.generate_shift_reminders(v_now);
 v_checks := v_checks || jsonb_build_object('read_state_preserved',exists(select 1 from public.notifications where event_id=v_events[1] and is_read));
 update public.organisation_settings set shift_reminder_enabled=false where id=1;
 perform notification_private.generate_shift_reminders(v_now+interval '22 hours');
 v_checks := v_checks || jsonb_build_object('preference_disables_new_reminders',not exists(select 1 from public.notifications where event_id=v_events[1] and type='shift_reminder_2h'));
 update public.organisation_settings set shift_reminder_enabled=true where id=1;
 perform notification_private.generate_shift_reminders(v_now+interval '22 hours');
 v_checks := v_checks || jsonb_build_object('second_threshold_created',exists(select 1 from public.notifications where event_id=v_events[1] and type='shift_reminder_2h'));
 delete from public.bookings where event_id=v_events[1] and user_id=v_user;
 perform notification_private.generate_shift_reminders(v_now+interval '22 hours');
 v_checks := v_checks || jsonb_build_object('cancelled_booking_reminders_cleared',not exists(select 1 from public.notifications where event_id=v_events[1] and not is_read));
 insert into public.notifications(user_id,event_id,type,title,message) values(v_other,v_events[1],'event_cancelled','Other account test','Test only');
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into reminder_checks values(v_checks);
end;
$test$;
grant select,insert on reminder_checks to authenticated;
set local role authenticated;
do $access$
declare v_checks jsonb := '{}'; v_denied boolean := false; v_id bigint;
begin
 v_checks := jsonb_build_object('other_users_hidden',not exists(select 1 from public.notifications where user_id<>auth.uid()));
 select id into v_id from public.notifications where user_id=auth.uid() limit 1;
 update public.notifications set is_read=true where id=v_id;
 v_checks := v_checks || jsonb_build_object('own_read_flag_writable',exists(select 1 from public.notifications where id=v_id and is_read));
 begin update public.notifications set title='forged' where id=v_id;
 exception when insufficient_privilege then v_denied:=true; end;
 v_checks := v_checks || jsonb_build_object('message_tampering_blocked',v_denied,
 'scheduler_not_client_callable',not has_schema_privilege(current_user,'notification_private','usage'));
 insert into reminder_checks values(v_checks);
end;
$access$;
reset role;
select result from reminder_checks;
rollback;
