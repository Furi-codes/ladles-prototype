/**
 * Defines the account, review, settings and directory data shapes used by corporate features.
 * Types describe expected data for TypeScript; runtime validation and database permissions are
 * still needed.
 */

export type CorporateAccountStatus = 'Awaiting approval' | 'Approved' | 'Rejected';

export interface CorporateAccountInput {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_address: string;
}

export interface CorporateAccount extends CorporateAccountInput {
  id: string;
  owner_user_id: string;
  status: CorporateAccountStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorporateAccountHistory {
  id: string;
  action: string;
  actor_name: string;
  actor_user_id: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown>;
  reason: string | null;
  created_at: string;
}

export interface CorporateAccountNotice {
  id: string;
  account_id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface CorporateAccountDetail {
  account: CorporateAccount;
  email_verified: boolean;
  // The UI labels these as the latest 50 actions, not the complete database audit log.
  history: CorporateAccountHistory[];
}

export interface CorporateRolloutSettings {
  id: number;
  schema_version: number;
  registration_enabled: boolean;
  volunteer_phone_required: boolean;
  updated_at: string;
}

export interface CorporateAccountListItem extends CorporateAccount {
  email_verified: boolean;
}

export interface VolunteerDirectoryItem {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  booking_count: number;
}

export interface PagedRows<T> { rows: T[]; total: number }
