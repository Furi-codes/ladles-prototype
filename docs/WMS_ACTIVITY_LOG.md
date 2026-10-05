# WMS activity in Settings

The authenticated WMS write routes now append to the existing `admin_audit_log`:

- Event PUT: `WMS_EVENT_PUBLISHED` (create or update), or `WMS_EVENT_CANCELLED`.
- Capacity PATCH: `WMS_CAPACITY_UPDATED`, with the observed capacity before and the persisted capacity after the write.
- Attendance POST: `WMS_ATTENDANCE_UPDATED`, with booking ID, outcome and WMS-recorded timestamp. No hours are fabricated.

The actor is **WMS integration**, not a named warehouse employee: the shared-token API does not verify individual WMS identities. Entries contain source, record IDs and operational values, not bearer tokens or volunteer contact details. Repeated successful write requests can create repeated entries; these are successful API operations, not a deduplicated database change stream. The pre-update capacity is observed separately and is not an atomic before-image under concurrent writes.

Settings displays the latest 20 entries, with South African timestamps and expandable details. Refresh to fetch new entries. This does not add a full-history/export screen.

Logging uses the existing server-only service client and table; no migration or client permission widening is needed. Like the existing VMS activity logger, it is best-effort: an audit error is reported server-side and cannot turn an already-saved operation into a misleading API failure. It is not a guaranteed, transactional compliance audit trail.

Existing WMS changes are not backfilled. Historical event creator identity cannot be inferred when there is no creation audit entry. Deploy the updated API routes and Settings UI to enable future entries. Verify a designated WMS test update and then refresh Settings; no live event or attendance changes were made as part of the local tests.
