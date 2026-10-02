-- Rollback-only regression checks: leaves no events, bookings or notifications behind.
begin;
create temporary table ownership_checks(result jsonb);
do $test$
declare
 v_admin uuid; v_user uuid; v_event public.events; v_delete public.events;
 v_slot bigint; v_owned_event bigint; v_owned_slot bigint; v_denied boolean;
 v_checks jsonb := '{}';
begin
 select id into strict v_admin from public.profiles where role='admin' limit 1;
 select id into strict v_user from public.profiles where role='volunteer' limit 1;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select * into v_event from public.save_event_with_slots(null,'Trigger create test',current_date+30,'Test only',
  '[{"start_time":"09:00","end_time":"10:00","capacity":5}]'::jsonb);
 select id into strict v_slot from public.event_slots where event_id=v_event.id;
 v_checks := v_checks || jsonb_build_object('event_create_and_summary_saved',v_event.total_slots=5 and v_event.time_slots='09:00-10:00');
 select * into v_event from public.save_event_with_slots(v_event.id,'Trigger edit test',current_date+30,'Updated location',
  jsonb_build_array(jsonb_build_object('id',v_slot,'start_time','09:00','end_time','10:00','capacity',6)));
 v_checks := v_checks || jsonb_build_object('event_edit_saved',v_event.title='Trigger edit test' and v_event.location='Updated location',
 'slot_capacity_saved',exists(select 1 from public.event_slots where id=v_slot and capacity=6));
 insert into public.bookings(event_id,event_slot_id,user_id) values(v_event.id,v_slot,v_user);
 perform public.cancel_event(v_event.id,'Rollback cancellation');
 v_checks := v_checks || jsonb_build_object('event_cancel_saved',exists(select 1 from public.events where id=v_event.id and status='Cancelled'),
 'cancellation_notification_created',exists(select 1 from public.notifications where event_id=v_event.id and user_id=v_user and type='event_cancelled'));
 -- Owned rows are inserted as fixture data; portal changes must still be blocked.
 insert into public.events(title,date,location,external_event_id) values('Owned rollback test',current_date+30,'Test only',gen_random_uuid()::text) returning id into v_owned_event;
 insert into public.event_slots(event_id,start_time,end_time,capacity,external_timeslot_id)
 values(v_owned_event,'09:00','10:00',5,gen_random_uuid()::text) returning id into v_owned_slot;
 v_denied:=false;
 begin update public.events set title='Forbidden' where id=v_owned_event;
 exception when others then v_denied:=SQLERRM='This event is managed by the Warehouse Management System.'; end;
 v_checks:=v_checks||jsonb_build_object('portal_wms_event_edit_blocked',v_denied);
 v_denied:=false;
 begin update public.event_slots set capacity=6 where id=v_owned_slot;
 exception when others then v_denied:=SQLERRM='This time slot is managed by the Warehouse Management System.'; end;
 v_checks:=v_checks||jsonb_build_object('portal_wms_slot_edit_blocked',v_denied);
 v_denied:=false;
 begin delete from public.event_slots where id=v_owned_slot;
 exception when others then v_denied:=SQLERRM='This time slot is managed by the Warehouse Management System.'; end;
 v_checks:=v_checks||jsonb_build_object('portal_wms_slot_delete_blocked',v_denied);
 perform set_config('request.jwt.claim.sub','',true);
 update public.event_slots set capacity=6 where id=v_owned_slot;
 update public.events set title='WMS updated title' where id=v_owned_event;
 v_checks:=v_checks||jsonb_build_object('server_wms_capacity_persists',exists(select 1 from public.event_slots where id=v_owned_slot and capacity=6),
 'server_wms_event_edit_persists',exists(select 1 from public.events where id=v_owned_event and title='WMS updated title'));
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select * into v_delete from public.save_event_with_slots(null,'Delete rollback test',current_date+30,'Test only',
  '[{"start_time":"11:00","end_time":"12:00","capacity":2}]'::jsonb);
 delete from public.event_slots where event_id=v_delete.id;
 delete from public.events where id=v_delete.id;
 v_checks:=v_checks||jsonb_build_object('vms_delete_works',not exists(select 1 from public.events where id=v_delete.id));
 if exists(select 1 from jsonb_each(v_checks) where value <> 'true'::jsonb) then
  raise exception 'Ownership trigger test failed: %',v_checks;
 end if;
 insert into ownership_checks values(v_checks);
end;
$test$;
select result from ownership_checks;
rollback;
