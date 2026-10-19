export const APP_ID = "win-win.local.election-admin";
export const APP_NAME = "WIN WIN";
export const APP_VERSION = "1.0.0";
export const SCHEMA_VERSION = 6;
export const MIN_COMPATIBLE_SCHEMA = 1;
export const BACKUP_MAGIC = "WWINBAK1";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_EXTENSION = ".winwinbak";

export const PAGE_SIZE = 25;

export const URBAN_BODY_TYPES = [
  "municipality",
  "municipal_corporation",
  "nagar_panchayat"
] as const;

export const ELECTION_TYPES = [
  "assembly",
  "gram_panchayat",
  "municipality",
  "municipal_corporation",
  "nagar_panchayat"
] as const;

export const WORKSPACE_STATUSES = ["draft", "active", "archived"] as const;
export const COVERAGE_KINDS = ["complete", "partial"] as const;
export const UNIT_TYPES = [
  "mandal",
  "gram_panchayat",
  "village",
  "urban_local_body",
  "rural_ward",
  "urban_ward"
] as const;

export const CONSENT_STATUSES = ["given", "not_given", "unknown", "withdrawn"] as const;
export const ASSIGNMENT_STATUSES = ["active", "inactive"] as const;
export const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const ISSUE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export const ISSUE_CATEGORIES = [
  "water",
  "roads",
  "sanitation",
  "electricity",
  "health",
  "education",
  "housing",
  "documents",
  "other"
] as const;
export const TEAM_ROLES = [
  "ward_coordinator",
  "field_volunteer",
  "data_volunteer",
  "issue_follow_up",
  "other"
] as const;
export const VERIFICATION_STATUSES = ["unverified", "verified", "needs_review"] as const;
export const DUPLICATE_PAIR_STATUSES = ["flagged", "distinct", "confirmed_duplicate_import"] as const;
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 50_000;
export const VOTER_EXPORT_FIELDS = [
  "displayName",
  "displayNameEn",
  "displayElectoralId",
  "displayRollSerial",
  "publishedAge",
  "ageReferenceDate",
  "displayAddress",
  "ward",
  "rollEdition",
  "verificationStatus",
  "sourceRow",
  "sourceSection",
  "sourcePage"
] as const;
export const VOTER_PERSONAL_EXPORT_FIELDS = [
  "displayName",
  "displayNameEn",
  "displayElectoralId",
  "displayRollSerial",
  "publishedAge",
  "ageReferenceDate",
  "displayAddress"
] as const;
export type VoterExportField = (typeof VOTER_EXPORT_FIELDS)[number];

export const RESERVATION_SHEET_NAME = "PANCHAYAT RESERVATIONS";
export const RESERVATION_EXCLUDED_SHEETS = ["PENSION DATA", "SHEET5"] as const;
export const RESERVATION_CATEGORIES = ["UR", "BC", "SC", "ST"] as const;
export const RESERVATION_SEAT_TYPES = ["sarpanch", "ward_member"] as const;
export const RESERVATION_NOTIFICATION_STATUSES = ["draft", "verified", "superseded"] as const;
export const RESERVATION_REVIEW_STATUSES = [
  "pending",
  "mapped",
  "mandal_needs_review",
  "unmatched",
  "ambiguous",
  "missing_ward",
  "outside_coverage",
  "boundary_mismatch",
  "invalid_category",
  "not_recorded",
  "conflict",
  "excluded"
] as const;
export const RESERVATION_CONTROL_EXPECTATIONS = {
  year: 2026,
  gramPanchayats: 48,
  tanuku: 9,
  attili: 18,
  iragavaram: 21,
  sarpanchReservations: 48,
  declaredWardSeats: 534,
  populatedWardReservations: 534,
  missingReservationCells: 0,
  invalidReservationCodes: 0,
  sarpanchByCode: { UR: 13, "UR(W)": 12, BC: 8, "BC(W)": 7, SC: 5, "SC(W)": 3 },
  wardByCode: { UR: 125, "UR(W)": 157, BC: 82, "BC(W)": 74, SC: 61, "SC(W)": 35 }
} as const;
