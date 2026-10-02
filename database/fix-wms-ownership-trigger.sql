begin;
create or replace function public.prevent_wms_owned_record_changes()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  -- Keep the existing ownership rule: signed-in portal callers cannot change WMS records.
  -- Separate branches are essential: OLD has a different row type for each table.
  if auth.uid() is not null then
    if tg_table_name = 'events' then
      if old.external_event_id is not null then
        raise exception 'This event is managed by the Warehouse Management System.';
      end if;
    elsif tg_table_name = 'event_slots' then
      if old.external_timeslot_id is not null then
        raise exception 'This time slot is managed by the Warehouse Management System.';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;
notify pgrst,'reload schema';
commit;
