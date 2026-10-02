-- User selected reminders at 24 hours and 2 hours before shifts.
begin;
update public.organisation_settings set shift_reminder_enabled = true, updated_at = now() where id = 1;
commit;
