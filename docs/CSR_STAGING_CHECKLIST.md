# Staging verification checklist

This checklist has **not** been executed against Supabase. The migration remains **REQUIRES DATABASE ADMIN REVIEW — NOT YET APPLIED**. A DBA must independently review and choose whether to apply it to a disposable staging database. Do not run destructive fixture setup or concurrency tests in production.

Use separate admin and volunteer accounts, two volunteers, two companies and two future slots with small known capacities. Keep an ended event with known attendance as a separate reporting fixture. Record all results and SQL errors.

## Database preflight

- Inspect actual column types, RLS enabled flags, policies, function ownership, definer search paths and function grants.
- Compare current `pg_get_functiondef` for both existing RPCs to the supplied definitions and proposed replacement.
- Resolve the omitted `events.description` and suspicious `profiles.role` default independently; this feature must not change them.
- Check migration parsing and transactional rollback behaviour in staging, then check the exposed RPC signatures/schema cache. Do not apply the feature migration twice.
- Confirm no existing individual bookings exceed their slot capacity; audit legacy NULL-slot bookings separately without arbitrary backfills.

## RLS and privilege checks

- Anonymous and volunteer accounts cannot read company contacts/CSR figures, corporate bookings, notes or organisation settings.
- A volunteer cannot invoke `save_corporate_booking`; the RPC rejects the caller using `is_admin()`.
- Authenticated admins can select/edit companies and append notes but cannot forge another note creator.
- Direct corporate booking INSERT/UPDATE/DELETE as authenticated admin must fail; RPC saves must succeed when valid.
- Check effective sequence privileges: no anon/PUBLIC access or authenticated sequence UPDATE/setval, no authenticated corporate-booking sequence access, only company/note USAGE as documented.
- Internal helpers/trigger functions cannot be called directly by authenticated/anon roles.
- `get_slot_availability()` returns only slot id and combined remaining capacity, never contact information or separate company data.
- Profile/consent policies still prevent volunteer role escalation. No account Settings payload contains role changes.

## Capacity and update scenarios

For each test, verify both the RPC result and the committed aggregate:

```sql
-- Read-only postcondition on each test slot, run with an authorised staging admin.
select s.id, s.capacity,
  (select count(*) from public.bookings b where b.event_slot_id = s.id)
  + (select coalesce(sum(c.team_size),0) from public.corporate_bookings c
     where c.event_slot_id = s.id and c.status <> 'Cancelled') as reserved
from public.event_slots s
where s.id = :staging_slot_id;
```

- Two concurrent volunteers compete for one place: exactly one succeeds.
- Two concurrent corporate groups compete for insufficient combined capacity: at most one succeeds.
- A volunteer and group compete for the last places: the second committed reservation must observe the first and be rejected when full.
- Hold the first transaction open after its booking RPC; verify the second blocks on the same `event_slots` row. Commit the first; verify the second recalculates from committed data.
- Repeat the capacity-writing entry points under REPEATABLE READ and SERIALIZABLE: expect SQLSTATE 25000, with no committed reservation/capacity change. Restart a fresh READ COMMITTED transaction before retrying. READ UNCOMMITTED is accepted as PostgreSQL maps it to READ COMMITTED semantics.
- Test multi-row direct admin INSERT/slot UPDATE in one statement; preceding own changes must be included in later checks.
- For two individual bookings by the same volunteer in different slots of one event, the unique constraint still prevents the second event booking.
- Cancel a group: retain its row, clear attendance results, and restore availability. Reactivate it after another booking fills the slot: reject reactivation.
- Increase team size beyond remaining capacity: reject. Decrease it: release only the difference.
- Move a group into a full slot: reject without losing the original reservation. Move successfully into another slot: event id must be derived from the new slot.
- Opposing moves between the two slots: no overbooking or lost reservation; retry any transaction-abort errors.
- Direct admin individual INSERT/slot update cannot exceed shared capacity. Status-only Present/Confirmed changes still work.
- Direct capacity reduction below individual + corporate reservations fails. Increasing capacity succeeds.
- Directly moving a booked slot to another event fails.
- Individual cancellation still physically deletes the booking; no Cancelled individual status is introduced.
- Past dates/cancelled events reject new reservations. Missing company, invalid slot, NULL/zero/negative team size and invalid status are rejected.
- Event slot replacement fails for individual bookings and for corporate history including Cancelled records. Metadata edits still use the unchanged metadata RPC.

## Attendance constraints

- Completed requires an ended shift on a non-cancelled event.
- Count/hour NULL combinations, negative values, count above team size, and numeric NaN fail.
- Test raw RPC hours -0.001 and zero attendance with +0.001: both must fail before numeric(12,2) rounding. Positive attendance with zero hours is intentionally valid.
- Zero attendance and zero hours is valid; zero attendance with positive hours fails.
- Pending/Confirmed/Cancelled must have both attendance fields NULL.
- Completed identity/company/slot/team size cannot be rewritten through the RPC; corrected valid attendance can be saved.
- Corporate attendance never writes `attendance_records`.

## Charity count

- NULL means unknown; zero means no other charities supported. Verify blank UI input saves NULL and zero round-trips as zero. Negative, fractional and out-of-integer-range counts must not be accepted as such; inspect API coercion and error behaviour.

## Reports and CSV

- Compare known worked minutes (including NULL) directly with individual hours; changing scheduled shift duration must not change verified hours.
- Confirm capacities come from slots, even when `events.total_slots` is deliberately inconsistent in staging.
- Compare non-cancelled group team totals, completed attendance and corporate hours to stored rows.
- Combine all four event filters; test inclusive boundaries, invalid range, empty report and zero-booking events.
- Select individual company/date ranges and validate participation instances, distinct supported events, attendance and hours.
- Confirm cancelled events remain historical report rows, while cancelled group bookings do not contribute group totals.
- Export CSV; verify it matches visible filtered event rows, quotes commas/newlines/quotes, preserves UTF-8, and neutralizes formula-like company/event names.
- Test more than the server's maximum response page size and confirm the report does not silently truncate.

## Settings and authenticated regression matrix

- Save organisation/preferences, reload and confirm persistence; verify switches do not send messages or alter cancellation notifications.
- Confirm singleton restriction and Africa/Johannesburg timezone.
- Admin listing contains only admin profiles; account name changes affect only the current profile; no role assignment exists.
- Volunteer/admin login and role redirects.
- Google OAuth round trip and password-reset completion with disposable test accounts.
- Volunteer Dashboard, event list, slot selection, capacity error and cancellation.
- Admin Dashboard, Events, event creation/editing/cancellation.
- QR display/scanner, valid/early/late clock-in, clock-out and stored minutes.
- No-show processing and event cancellation notifications.
- Sidebar/navigation, error/retry states and dark/light themes.
- New and existing screens at 390px, 768px and desktop; keyboard navigation, form labels, table scrolling and long text.

A compiled build and static migration tests do not establish any of these live database results. Record this matrix after staging verification before production rollout.
