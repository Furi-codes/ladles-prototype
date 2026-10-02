# Part 7: release checks

## Local regression pass

- Event expiry and attendance display use Africa/Johannesburg, irrespective of the volunteer's device timezone.
- Home and certificate totals share finalised, completed attendance calculations scoped to the volunteer. Missing timestamps, invalid dates and negative/non-finite minutes do not contribute.
- Booking errors release the submitting state and show an actionable error. Repeated submissions are guarded; slot ownership, cancellation, expiry and known capacity are checked before submission. Database validation remains authoritative.
- Booking dialogs keep focus stable on data refresh, contain keyboard focus and restore body scrolling on close. Open dialogs resolve the current event rather than an old snapshot.
- Certificate-only print visibility no longer hides ordinary pages. Long names and history text can wrap.
- Regression command: `node --test tests/*.test.mjs`; also run lint, TypeScript and production build.

## Signed-in checks still required

These are not substitutes for the automated tests. Use a designated test event/account; do not alter real attendance to fabricate certificate eligibility.

1. Desktop and narrow mobile: inspect Home, My impact, Attendance, Profile and Notifications in light/dark mode. Check bottom navigation, long event names, form errors and keyboard focus.
2. Reserve a test shift: confirm the roster entry and remaining capacity change once. Refresh and confirm no duplicate reservation. Confirm full, ended and cancelled shifts cannot be booked.
3. Within the allowed attendance windows, clock in/out through QR and typed codes. Check repeated/wrong codes, camera failure and a rotated code. Confirm recorded minutes and Completed status after clock-out.
4. My impact: compare hours/completed shifts with the recorded attendance. An account with no finalised positive hours must not be able to print a certificate.
5. Download certificate: Save as PDF; inspect the logo, volunteer name, totals and issue date. Check one-page output with a long name, cancel the dialog, retry, and confirm ordinary printing still works.
6. Profile reminder toggle: save, reload and confirm persistence. Check unread bell/inbox, mark read/all read, another tab and cancellation messages. Personal opt-out must suppress new reminders, not cancellation updates.
7. Verify the deployed five-minute scheduler around the 24-hour and 2-hour windows using test bookings. Confirm each reminder appears once and cancelled shifts receive none. Email/SMS/push are not implemented.
8. Admin: inspect Events, Rosters, CSR and Settings; verify permissions, filters and form save/error states. Confirm CSR branch/staging work is present in the intended release.
9. Reports: compare filtered event totals with records, check heatmap/full-screen/contained scrolling and inspect exported CSV values.
10. With WMS, test authenticated health, event/slot publishing, capacity persistence on fetch, bookings and attendance on the actual deployment.

## Release

- Review outstanding checks before calling Part 7 complete.
- Push/deploy only when requested. Confirm deployment branch and environment variables without sharing secrets.
- Repeat the critical volunteer and WMS smoke tests against the deployed URL.
