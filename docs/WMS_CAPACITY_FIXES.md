# WMS capacity consistency fixes — 2 October 2026

- Admin dashboard capacity now sums the current `event_slots` rows for each event. It no longer reads the legacy `events.total_slots` field, which can be stale after direct WMS capacity updates. An event without slots displays zero capacity. This change does not repair or write the legacy field.
- Both WMS bookings GET and capacity PATCH count every non-cancelled corporate group, including Completed groups, matching the database's `csr_reserved_spaces` rule. Individual reservations and database capacity enforcement are unchanged.
- Added regressions for mixed corporate statuses, completed-group capacity reduction protection and rendered dashboard capacity with stale legacy values and changed slot capacity.
- Existing quarter-hour options and rejection of false capacity-update success remain in place.
- No schema migrations, live record updates, push or deployment are part of this fix.

## Deployment and live verification

Deploy these changes, then ask WMS to update the designated test slot from 5 to 6 and fetch the event bookings again. Both responses must show 6. Confirm the intended test time: the last read-only database check showed 11:00–12:00 rather than the team's stated 09:15–10:15. Continue booking and attendance testing using designated test data. Local regression tests do not constitute live end-to-end sign-off.

## Data-loading hardening — 4 October 2026

- All six admin loaders now page table/RPC responses using exact counts and unique sort keys. WMS booking snapshots page slots, individual bookings, corporate reservations and profiles; IN filters use batches of at most 100 IDs. Corporate capacity prechecks also page their reservations.
- The shared helper advances by actual returned rows rather than the requested page size, so reduced server row limits do not skip records. Missing counts, empty/incomplete pages and changes in counts fail without returning partial data as success. This is not a transactional snapshot across tables; live changes can require a retry.
- Admin refreshes use a request sequence. Only the latest request can commit data/errors or finish loading; cleanup invalidates outstanding requests and suppresses queued initial loading after unmount.
- Added tests covering all admin loaders, reduced row limits, batched WMS profiles, incomplete response rejection and out-of-order refresh completions.
- No schema or permission changes, live record writes, push or deployment. After deployment, verify admin refresh/rosters and the WMS booking pull on designated test data.
