-- Rollback-only preference/scheduler/RLS checks. Requires two volunteers and an admin.
begin;
create temporary table preference_fixture(user_a uuid,user_b uuid,event_day bigint,event_soon bigint,event_cancel bigint,test_now timestamptz);
create temporary table preference_checks(result jsonb);
grant select on preference_fixture to authenticated;
grant select,insert on preference_checks to authenticated;
do $setup$
declare a uuid; b uuid; admin_id uuid; ev bigint; slot_id bigint; day_id bigint; soon_id bigint; cancel_id bigint;
 t timestamptz:=((current_date+30)+time '09:00') at time zone 'Africa/Johannesburg'; starts timestamptz;
begin
 select id into strict a from public.profiles where role='volunteer' limit 1;
 select id into strict b from public.profiles where role='volunteer' and id<>a limit 1;
 select id into strict admin_id from public.profiles where role='admin' limit 1;
 update public.organisation_settings set shift_reminder_enabled=true where id=1;
 delete from public.volunteer_notification_preferences where user_id in(a,b);
 insert into public.volunteer_notification_preferences(user_id,reminders_enabled) values(b,true);
 for i in 1..3 loop
  starts:=t+case when i=2 then interval '2 hours' else interval '24 hours' end;
  insert into public.events(title,date,location) values('Preference rollback test',(starts at time zone 'Africa/Johannesburg')::date,'Test only') returning id into ev;
  insert into public.event_slots(event_id,start_time,end_time,capacity) values(ev,(starts at time zone 'Africa/Johannesburg')::time,((starts+interval '1 hour') at time zone 'Africa/Johannesburg')::time,2) returning id into slot_id;
  insert into public.bookings(event_id,event_slot_id,user_id) values(ev,slot_id,a);
  if i<>3 then insert into public.bookings(event_id,event_slot_id,user_id) values(ev,slot_id,b); end if;
  if i=1 then day_id:=ev; elsif i=2 then soon_id:=ev; else cancel_id:=ev; end if;
 end loop;
 insert into preference_fixture values(a,b,day_id,soon_id,cancel_id,t);
 perform set_config('request.jwt.claim.sub',a::text,true);
end;
$setup$;
set local role authenticated;
do $user$
declare f record; checks jsonb:='{}'; blocked boolean:=false; affected integer;
begin
 select * into f from preference_fixture;
 perform public.set_volunteer_reminder_preference(false);
 checks:=jsonb_build_object('personal_opt_out_saved',exists(select 1 from public.volunteer_notification_preferences where user_id=auth.uid() and not reminders_enabled),
 'other_preferences_hidden',not exists(select 1 from public.volunteer_notification_preferences where user_id=f.user_b));
 update public.volunteer_notification_preferences set reminders_enabled=false where user_id=f.user_b;
 get diagnostics affected=row_count;
 checks:=checks||jsonb_build_object('other_preference_update_blocked',affected=0);
 begin insert into public.volunteer_notification_preferences(user_id,reminders_enabled) values(f.user_b,false);
 exception when insufficient_privilege then blocked:=true; end;
 checks:=checks||jsonb_build_object('other_preference_insert_blocked',blocked);
 insert into preference_checks values(checks);
end;
$user$;
reset role;
do $generate$
declare f record; admin_id uuid;
begin
 select * into f from preference_fixture;
 perform notification_private.generate_shift_reminders(f.test_now);
 insert into preference_checks select jsonb_build_object(
 'opted_out_has_no_reminders',not exists(select 1 from public.notifications where user_id=f.user_a and event_id in(f.event_day,f.event_soon) and type like 'shift_reminder_%'),
 'other_user_receives_both_thresholds',(select count(*)=2 from public.notifications where user_id=f.user_b and event_id in(f.event_day,f.event_soon)));
 select id into strict admin_id from public.profiles where role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.cancel_event(f.event_cancel,'Rollback cancelled shift');
 perform set_config('request.jwt.claim.sub',f.user_a::text,true);
end;
$generate$;
set local role authenticated;
do $enable$
declare f record;
begin
 select * into f from preference_fixture;
 perform public.set_volunteer_reminder_preference(true);
 insert into preference_checks select jsonb_build_object('personal_opt_in_saved',exists(select 1 from public.volunteer_notification_preferences where user_id=auth.uid() and reminders_enabled),
 'critical_cancellation_still_delivered',exists(select 1 from public.notifications where event_id=f.event_cancel and user_id=auth.uid() and type='event_cancelled' and not is_read));
end;
$enable$;
reset role;
do $repeat$
declare f record;
begin
 select * into f from preference_fixture;
 perform notification_private.generate_shift_reminders(f.test_now);
 perform notification_private.generate_shift_reminders(f.test_now);
 insert into preference_checks select jsonb_build_object('opt_in_restores_due_reminders',(select count(*)=2 from public.notifications where user_id=f.user_a and event_id in(f.event_day,f.event_soon)));
end;
$repeat$;
set local role authenticated;
select public.set_volunteer_reminder_preference(false);
insert into preference_checks select jsonb_build_object('opt_out_marks_old_reminders_read',not exists(select 1 from public.notifications where type like 'shift_reminder_%' and not is_read),
 'opt_out_preserves_cancellation_unread',exists(select 1 from public.notifications where type='event_cancelled' and event_id=(select event_cancel from preference_fixture) and not is_read));
reset role;
select result from preference_checks;
rollback;
