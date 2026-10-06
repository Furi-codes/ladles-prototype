import type { CorporateBooking, EventSlot } from './types';

/** Match the database lifecycle: Completed retains places; Cancelled releases them. */
export function corporateRemaining(slot: Pick<EventSlot, 'id' | 'corporate_capacity'>, bookings: Pick<CorporateBooking, 'id' | 'event_slot_id' | 'status' | 'team_size'>[], excludeId?: number) {
  if (!Number.isInteger(slot.corporate_capacity) || slot.corporate_capacity < 0) {
    throw new Error('Corporate capacity is unavailable. Ask your database administrator to install the separate-capacity migration.');
  }
  const reserved = bookings.filter(b => b.event_slot_id === slot.id && b.id !== excludeId && b.status !== 'Cancelled')
    .reduce((sum, b) => sum + b.team_size, 0);
  return Math.max(0, slot.corporate_capacity - reserved);
}

/** UI preflight only; the locked database RPC remains authoritative. */
export function validateCorporateTeamSize(teamSize: number, remaining: number) {
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 2147483647) throw new Error('Team size must be a positive integer.');
  if (teamSize > remaining) throw new Error('The team exceeds the remaining corporate capacity of this time slot.');
}
