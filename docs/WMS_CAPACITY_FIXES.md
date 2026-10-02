# WMS capacity consistency fixes — 2 October 2026

- Admin dashboard capacity now sums the current `event_slots` rows for each event. It no longer reads the legacy `events.total_slots` field, which can be stale after direct WMS capacity updates. An event without slots displays zero capacity. This change does not repair or write the legacy field.
- Both WMS bookings GET and capacity PATCH count every non-cancelled corporate group, including Completed groups, matching the database's `csr_reserved_spaces` rule. Individual reservations and database capacity enforcement are unchanged.
- Added regressions for mixed corporate statuses, completed-group capacity reduction protection and rendered dashboard capacity with stale legacy values and changed slot capacity.
- Existing quarter-hour options and rejection of false capacity-update success remain in place.
- No schema migrations, live record updates, push or deployment are part of this fix.

## Deployment and live verification

Deploy these changes, then ask WMS to update the designated test slot from 5 to 6 and fetch the event bookings again. Both responses must show 6. Confirm the intended test time: the last read-only database check showed 11:00–12:00 rather than the team's stated 09:15–10:15. Continue booking and attendance testing using designated test data. Local regression tests do not constitute live end-to-end sign-off.
