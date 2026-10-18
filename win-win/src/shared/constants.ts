export const APP_ID = "win-win.local.election-admin";
export const APP_NAME = "WIN WIN";
export const APP_VERSION = "1.0.0";
export const SCHEMA_VERSION = 5;
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
