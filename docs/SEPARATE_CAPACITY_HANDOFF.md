# Separate individual and corporate capacity — 6 October 2026

Implemented locally. No SQL was executed, no shared database was accessed, and no commit or push was made. Secrets were not opened or modified. Next.js loaded its existing environment configuration during the requested build; no values were inspected.

## Exact SQL for teammate review

The complete, executable SQL is [20261006100404_separate_corporate_capacity.sql](../supabase/migrations/20261006100404_separate_corporate_capacity.sql). Review and run the **entire file**, including its transaction, function replacements, trigger replacement, grants and schema-cache notification. It is not a sample or a partial patch. Apply it once, after confirming the existing CSR and admin-access migrations are already installed. Do not rerun historical migrations.

The database change adds only `event_slots.corporate_capacity integer NOT NULL DEFAULT 0 CHECK (corporate_capacity >= 0)`. Existing shifts are backfilled with `greatest(capacity, csr_reserved_spaces(id))`: the previous maximum is copied into an independent corporate limit, raised if necessary to preserve already reserved corporate places. This deliberately gives existing shifts two independent limits and may increase total possible participation. Review those corporate limits with operations; new shifts default to zero corporate places until an administrator configures them. No existing individual capacities or booking records are rewritten by the migration's backfill.

Function replacements retain their signatures, authorization, row locks and lifecycle rules: `save_corporate_booking`, `get_slot_availability`, `book_event_slot`, `save_event_with_slots`, `csr_guard_individual_capacity`, and `csr_guard_slot_capacity`. The existing slot-update trigger is replaced to also fire on corporate-capacity edits. Existing RPC grants are retained; restricted corporate/availability/trigger privileges are reasserted. No tables are dropped or renamed. The existing event-save function still allows removal of unbooked slots; this migration does not itself remove any slots.

## Model and repository audit

Previously, corporate team sizes and individual bookings consumed the same `event_slots.capacity`. Shared calculations occurred in corporate saves, individual booking saves, privacy-safe availability, individual-write guards, event saves, and direct slot-capacity guards. CSR also displayed the individual capacity as the group limit, and reports displayed that limit beside combined reservations.

Now individual availability is `max(0, capacity - count(bookings for the slot))`. Corporate availability is `max(0, corporate_capacity - sum(non-cancelled corporate team sizes for the slot))`. They have no effect on one another. Corporate edits exclude the booking being edited before validating its new team size. The locked database RPC remains authoritative after UI preflight validation. Pending, Confirmed and Completed corporate rows reserve corporate places; Cancelled rows release them. Completed identity and attendance safeguards remain unchanged. Individual cancellation still deletes the user's owned individual booking, releasing only its individual place. Legacy individual rows without a slot retain their existing exemption from slot accounting.

Administrators can create and edit both limits, including changing the limits on existing range IDs without recreating booked slots. Each pool can be reduced only as far as its own reservations. Event date/time/slot identity and history protections are retained. `events.total_slots` continues to sum individual capacity only. Corporate bookings stay in `corporate_bookings`; they are not converted to individual records.

Reports and CSV expose separate individual capacity, corporate capacity, individual reserved, and corporate reserved columns. Combined booked participants, attendance rates, recorded hours and monthly participation charts retain their intentional participation calculations; they are not capacity-utilization metrics. Legacy unslotted individual bookings contribute participation but not slot reservations. Corporate-only/company filters restrict reported activity and reservations; capacities remain the full event limits. Cancelled-event exclusions are preserved. Historical audit documents describing shared capacity are superseded by this handoff and the new migration, not instructions for the new model.

Reviewed `app`, `lib`, all repository SQL migrations, tests and project documentation. This checkout has only the location-search API route, and no WMS capacity implementation or external payload contract. No WMS payload was invented or changed. If WMS lives elsewhere, its owner must clarify whether it needs individual limits, corporate limits, or both; it must not interpret combined participation as reservations against one limit.

## Changed files

| File | Change |
| --- | --- |
| `supabase/migrations/20261006100404_separate_corporate_capacity.sql` | Additive schema change, backfill, six function replacements and trigger coverage |
| `lib/types.ts` | Required corporate capacity on slots; individual capacity documented |
| `lib/capacity.ts` | Corporate-only remaining places and team-size preflight validation |
| `lib/actions/admin.ts` | Corporate capacity included in event-slot input |
| `lib/actions/corporate.ts` | Explain missing corporate-capacity migration instead of using the old shared limit |
| `app/admin/components/EventsManager.tsx` | Separate fields/totals, validation and existing-range capacity editing |
| `app/admin/admin.module.css` | Fit the extra capacity field and wrap range controls using existing styling |
| `app/admin/components/CorporateBookingForm.tsx` | Corporate-only capacity display and validation |
| `lib/reporting.ts` | Separate capacities/reservations and CSV columns; preserve participation totals |
| `app/admin/components/ReportsManager.tsx` | Separate report columns and accounting explanation |
| `app/admin/components/ReportCharts.tsx` | Label combined monthly activity as participants, not a shared capacity pool |
| `tests/separate-capacity.test.mjs` | Ten new capacity/lifecycle/reporting regressions |
| `tests/admin-audit.test.mjs` | Updated CSV expectation and identify historical shared-capacity test as superseded |
| `docs/SEPARATE_CAPACITY_HANDOFF.md` | SQL review, complete change inventory and verification instructions |

Volunteer display/action files need no calculation change: their existing aggregate availability call now returns individual-only places, and their booking/cancellation calls retain the same signatures.

## Checks

- Relevant capacity tests: passed (10 tests, also included in the full run).
- Full suite: `node --test --experimental-test-isolation=none tests/*.test.mjs` — 62 passed, zero failed. The initial isolated runner was blocked by sandbox `spawn EPERM`; in-process mode succeeded without escalation.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed, no warnings or errors.
- `npm run build` — passed on the final application changes; all 15 pages generated.
- `git diff --check` — passed.

SQL coverage is static source-contract verification, not executed PostgreSQL integration testing. Executable tests cover corporate arithmetic/validation and report/CSV results. No live authentication, database race, lifecycle transaction or visual browser check is claimed.

## Manual verification after SQL review and application

1. Before applying, compare the six replaced function definitions and trigger with the deployed schema so any changes made outside this repository can be reconciled. Confirm PostgreSQL supports `CREATE OR REPLACE TRIGGER` (14+), existing grants/RLS and the existing CSR helper/lifecycle definitions match the prerequisites. Apply the migration before using this UI with shared users.
2. Confirm every existing slot retained its individual limit and got the reviewed corporate limit. Set a future test shift to individual 30/corporate 40. With 25 individual reservations and corporate teams totalling 20, expect individual remaining 5 and corporate remaining 20 in UI and RPC results.
3. Add/cancel an individual: only individual remaining changes. Add/resize/move/cancel/reactivate a corporate group: only the relevant corporate pool changes. Confirm Pending/Confirmed reserve, Completed retains places and identity, cancellation releases places, and recorded attendance corrections still work.
4. Reject the 31st individual and any team exceeding corporate remaining. For capacity 1/corporate capacity 1, concurrent individual-1 and corporate-team-1 should both succeed. Two individuals racing for one individual place must produce one success; two teams racing for one corporate place must produce one success. Also verify resizing, moves and capacity-shrink races under READ COMMITTED.
5. Edit both limits on an already booked range. Shrinking below either pool's own reservations must fail; a large corporate reservation must not block a valid individual-limit decrease. Confirm event cancellation, notifications, date/time/removal restrictions and Completed history protections still work.
6. Reconcile report table and CSV against known individual and corporate rows, including cancelled groups, Completed attendance, legacy unslotted bookings and corporate-only/company filters. Combined attendance/hours should stay unchanged; the two capacities must remain visibly distinct. Confirm anonymous/volunteer accounts cannot manage corporate records or reveal corporate booking identities.
7. Check the added capacity controls at desktop/mobile widths. Refresh sessions and PostgREST schema cache if needed. Confirm any separately maintained WMS integration with its owner; this repository supplies no WMS contract.
