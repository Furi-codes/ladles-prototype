/**
 * Turns saved corporate before/after snapshots into readable changes.
 * The display selects useful fields instead of exposing the whole stored object.
 */

export function corporateHistoryChanges(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const previous = record(before?.booking ?? before), current = record(after.booking ?? after);
  const event = (row: Record<string, unknown>) => record(row.event ?? row.event_snapshot);
  const fields: [string, unknown, unknown][] = [
    ['Status', previous.status, current.status], ['Group size', previous.group_size, current.group_size],
    ['Event', event(previous).title, event(current).title],
    ['Actual attendees', record(previous.attendance).attendance_count, record(current.attendance).attendance_count],
    ['Event hours', record(previous.attendance).event_hours, record(current.attendance).event_hours],
  ];
  return fields.filter(([,oldValue,newValue]) => oldValue !== undefined && newValue !== undefined && oldValue !== newValue &&
    [oldValue,newValue].every(value => value === null || typeof value === 'string' || typeof value === 'number'))
    .map(([label,oldValue,newValue]) => ({ label, before: oldValue === null ? 'Not recorded' : String(oldValue), after: newValue === null ? 'Not recorded' : String(newValue) }));
}
