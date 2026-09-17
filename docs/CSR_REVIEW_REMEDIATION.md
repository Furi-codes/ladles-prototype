# CSR Review Remediation

This document records the changes made on AmienBranch. It does not authorize applying the migration, merging the branch, or deploying it.

## Database changes

The migration keeps the existing booking RPC checks for authentication, volunteer role, cancelled events, duplicate event bookings, slot row locking, and capacity. It extends the capacity calculation with non-cancelled corporate reservations and rejects a slot when its event date is before today or its end time has passed today, using `Africa/Johannesburg`.

Corporate booking saves use the same slot lock and aggregate calculation. Pending, Confirmed, and Completed corporate rows reserve their full `team_size`; Cancelled rows reserve zero and remain as history. Cancellation therefore releases capacity after the transaction commits. Completed rows retain their reservation and require completed attendance values.

Event saves still require an administrator, non-empty event data, at least one valid range, end time after start time, and positive capacity. Existing slot IDs are now sent by the admin UI. Safe title, location, description/category metadata, and capacity changes remain possible. For a slot with booking history, the RPC rejects time changes and removal; capacity cannot fall below active reserved places. An event date cannot change after bookings exist. Cancelled corporate history also prevents deleting its slot. Existing slot rows are locked before reconciliation so event edits serialize with reservation writers.

No SQL was applied to production. No production database was accessed.

## Application changes

Availability keeps the expected missing-RPC migration fallback. Unexpected availability RPC/database failures are logged and surface as `Availability could not be loaded. Please try again.` rather than being treated as zero or unknown availability. The volunteer modal also disables slots whose end time has passed in `Africa/Johannesburg`; the database remains authoritative.

Settings already label notification switches as stored preferences only: automated email/message delivery is not enabled. Event cancellation currently retains historical bookings, stops new bookings through the event status, and creates in-app cancellation notifications through the existing database behavior. The migration does not silently delete historical records.

## Verification status

Static and local checks completed:

- `node --test tests/*.test.mjs`: 13 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.

Not performed: Supabase staging integration tests, actual schema inspection, RLS tests with volunteer/admin accounts, shared-capacity race tests, cancellation release tests against a live database, completed reporting fixtures against staging, event-cancellation live behavior, and injected availability RPC failure testing. No staging URL or credentials were available in the workspace, so these are intentionally not claimed as verified.

Required staging decisions/checks remain: confirm `public.events.description` exists, confirm the actual default for new `public.profiles.role` is `volunteer`, verify the existing live definitions of the two replaced RPCs before applying the migration, and confirm whether capacity/reporting treatment of corporate bookings on a cancelled event matches the team's intended policy.
