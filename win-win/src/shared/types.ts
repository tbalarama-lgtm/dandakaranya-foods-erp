import type {
  COVERAGE_KINDS,
  ELECTION_TYPES,
  UNIT_TYPES,
  URBAN_BODY_TYPES,
  WORKSPACE_STATUSES
} from "./constants";

export type CoverageKind = (typeof COVERAGE_KINDS)[number];
export type ElectionType = (typeof ELECTION_TYPES)[number];
export type UnitType = (typeof UNIT_TYPES)[number];
export type UrbanBodyType = (typeof URBAN_BODY_TYPES)[number];
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];
export type WardClassification = "rural" | "urban";
export type BoundaryStatus = "draft" | "active" | "archived";
export type DataKind = "empty" | "demo" | "operational";
export type Locale = "en" | "te";

export interface AppInfo {
  appId: string;
  appName: string;
  version: string;
  schemaVersion: number;
  dataDirectory: string;
  databasePath: string;
  encryptedDatabase: false;
  encryptedBackups: false;
}

export interface AppSettings {
  organizationName: string;
  defaultConstituencyId: string | null;
  locale: Locale;
  dataKind: DataKind;
}

export interface BoundaryVersion {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string;
  status: BoundaryStatus;
  createdAt: string;
}

export interface NamedEntity {
  id: string;
  name: string;
  nameTe: string;
  officialCode: string | null;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssemblyConstituency extends NamedEntity {}

export interface Mandal extends NamedEntity {}

export interface GramPanchayat extends NamedEntity {
  mandalId: string;
}

export interface Village extends NamedEntity {
  gramPanchayatId: string;
}

export interface UrbanLocalBody extends NamedEntity {
  bodyType: UrbanBodyType;
  administrativeMandalId: string | null;
}

export interface Ward {
  id: string;
  classification: WardClassification;
  gramPanchayatId: string | null;
  urbanLocalBodyId: string | null;
  boundaryVersionId: string;
  wardNumber: string;
  name: string;
  nameTe: string;
  officialCode: string | null;
  recordSource: string;
  lastVerifiedAt: string | null;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VillageWardMapping {
  id: string;
  villageId: string;
  wardId: string;
  coverageKind: CoverageKind;
  notes: string;
}

export interface ConstituencyCoverage {
  id: string;
  constituencyId: string;
  boundaryVersionId: string;
  unitType: UnitType;
  unitId: string;
  coverageKind: CoverageKind;
  notes: string;
}

export interface ElectionWorkspace {
  id: string;
  name: string;
  electionType: ElectionType;
  year: number;
  constituencyId: string;
  boundaryVersionId: string;
  status: WorkspaceStatus;
  notes: string;
  snapshotJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ElectionWardLink {
  electionId: string;
  wardId: string;
  wardNumberSnapshot: string;
  wardNameSnapshot: string;
  classificationSnapshot: WardClassification;
}

export interface ElectionCoverageLink {
  id: string;
  electionId: string;
  unitType: UnitType;
  unitId: string;
  coverageKind: CoverageKind;
  unitNameSnapshot: string;
}

export interface AuditRecord {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  recordId: string;
  changedFields: string[];
}

export interface DashboardCounts {
  mandals: number;
  gramPanchayats: number;
  villages: number;
  urbanLocalBodies: number;
  ruralWards: number;
  urbanWards: number;
  electionWorkspaces: number;
}

export interface WardListItem extends Ward {
  parentName: string;
  mandalName: string | null;
  constituencyCoverageKind: CoverageKind | "inherited-complete" | "unmapped";
  villageNames: string[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WardFilters {
  query?: string;
  constituencyId?: string | null;
  classification?: WardClassification | "";
  mandalId?: string | null;
  localBodyId?: string | null;
  boundaryVersionId?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GeoBreadcrumb {
  constituency?: { id: string; name: string };
  mandal?: { id: string; name: string };
  gramPanchayat?: { id: string; name: string };
  urbanLocalBody?: { id: string; name: string; bodyType: UrbanBodyType };
  villages?: Array<{ id: string; name: string; coverageKind: CoverageKind }>;
  ward?: { id: string; name: string; wardNumber: string; classification: WardClassification };
  boundaryVersion?: { id: string; name: string };
}

export interface WardDetail {
  ward: Ward;
  breadcrumb: GeoBreadcrumb;
  villages: Array<Village & { coverageKind: CoverageKind }>;
  parent: GramPanchayat | UrbanLocalBody;
  referencedByElections: Array<{ id: string; name: string; status: WorkspaceStatus }>;
}

export interface BackupResult {
  path: string;
  createdAt: string;
  bytes: number;
}

export interface RestoreResult {
  ok: true;
  recoveredFromFailure: boolean;
  recoveryCopyPath: string | null;
}

export interface AppErrorPayload {
  code: string;
  message: string;
}

export type ConsentStatus = "given" | "not_given" | "unknown" | "withdrawn";
export type AssignmentStatus = "active" | "inactive";
export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type IssuePriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export interface Person {
  id: string;
  name: string;
  nameTe: string;
  phone: string;
  email: string;
  consentStatus: ConsentStatus;
  consentDate: string | null;
  consentSource: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WardContact {
  id: string;
  personId: string;
  wardId: string;
  constituencyId: string;
  organization: string;
  publicRole: string;
  areaServed: string;
  recordSource: string;
  lastVerifiedAt: string | null;
  coordinationNotes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  person: Person;
}

export interface TeamAssignment {
  id: string;
  personId: string;
  wardId: string;
  constituencyId: string;
  operationalRole: string;
  responsibilities: string;
  startDate: string | null;
  endDate: string | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
  person?: Person;
}

export interface Issue {
  id: string;
  wardId: string;
  constituencyId: string;
  referenceNumber: string;
  title: string;
  category: string;
  location: string;
  description: string;
  reportedAt: string;
  responsiblePersonId: string | null;
  priority: IssuePriority;
  dueDate: string | null;
  status: IssueStatus;
  resolutionNotes: string;
  complainantName: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueStatusHistory {
  id: string;
  issueId: string;
  status: IssueStatus;
  note: string;
  changedAt: string;
}

export interface TaskItem {
  id: string;
  wardId: string;
  constituencyId: string;
  title: string;
  assignedPersonId: string | null;
  relatedIssueId: string | null;
  dueDate: string | null;
  status: TaskStatus;
  description: string;
  completedAt: string | null;
  completionNotes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  overdue?: boolean;
}

export interface ActivityItem {
  at: string;
  kind: "contact" | "team" | "issue" | "task";
  summary: string;
  recordId: string;
  wardId?: string;
  wardName?: string;
  action?: string;
  record?: string;
  href?: string;
}

export interface DashboardWorkItem {
  id: string;
  title: string;
  wardId: string;
  wardName: string;
  href: string;
  dueDate?: string | null;
  status?: string;
  referenceNumber?: string;
}

export interface DashboardAttention {
  overdueTasks: DashboardWorkItem[];
  unresolvedIssues: DashboardWorkItem[];
  recentActivity: ActivityItem[];
}

export type GeoDashboardLevel =
  | "assembly"
  | "mandal"
  | "gram_panchayat"
  | "urban_local_body"
  | "rural_ward"
  | "urban_ward";

export interface GeoDashboardQuery {
  constituencyId: string;
  boundaryVersionId: string;
  level: GeoDashboardLevel;
  unitId?: string;
  electionId?: string;
  notificationId?: string;
  rollEditionId?: string;
  includeArchived?: boolean;
}

export interface GeoMetric {
  key: string;
  label: string;
  value: number | null;
  href: string;
  hint: string;
  missing: boolean;
}

export interface GeoDirectoryColumn {
  key: string;
  label: string;
}

export interface GeoDirectoryRow {
  id: string;
  name: string;
  nameTe: string;
  href: string;
  subtitle?: string;
  values: Record<string, string | number | null>;
}

export interface GeoDirectory {
  key: string;
  title: string;
  searchPlaceholder: string;
  columns: GeoDirectoryColumn[];
  rows: GeoDirectoryRow[];
}

export interface GeoReviewItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface GeoReservationSnapshot {
  applicable: boolean;
  message: string;
  sarpanchCode: string | null;
  sarpanchWomen: boolean;
  sarpanchReview: string | null;
  wardMemberByCode: Record<string, number>;
  awaitingReview: number;
  notificationName: string | null;
}

export interface GeoTeamMember {
  id: string;
  name: string;
  role: string;
  href: string;
}

export interface GeoDashboard {
  level: GeoDashboardLevel;
  unitId: string;
  name: string;
  nameTe: string;
  classification: string;
  breadcrumb: Array<{ label: string; href: string }>;
  boundaryName: string;
  electionName: string | null;
  rollEditionName: string | null;
  rollEditionHint: string | null;
  administrativeMandalName: string | null;
  parentName: string | null;
  metrics: GeoMetric[];
  directories: GeoDirectory[];
  overdueTasks: DashboardWorkItem[];
  unresolvedIssues: DashboardWorkItem[];
  recentActivity: ActivityItem[];
  reviewItems: GeoReviewItem[];
  shortcuts: Array<{ label: string; href: string }>;
  reservation: GeoReservationSnapshot | null;
  team: GeoTeamMember[];
  villages: Array<{ id: string; name: string; nameTe: string }>;
}

export interface WardOverview {
  activeContacts: number;
  activeTeamAssignments: number;
  unresolvedIssues: number;
  openTasks: number;
  overdueTasks: number;
  recentActivity: ActivityItem[];
}

export interface PlatformInfo {
  platform: string;
  isMac: boolean;
  modKey: "⌘" | "Ctrl";
}

export type VerificationStatus = "unverified" | "verified" | "needs_review";
export type DuplicatePairStatus = "flagged" | "distinct" | "confirmed_duplicate_import";

export interface RollEdition {
  id: string;
  constituencyId: string;
  boundaryVersionId: string;
  name: string;
  revisionCode: string;
  publishedOn: string | null;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoterEntry {
  id: string;
  rollEditionId: string;
  constituencyId: string;
  importBatchId: string | null;
  sourceRowNumber: number | null;
  sourceName: string;
  sourceNameEn: string;
  sourceElectoralId: string;
  sourceRollSerial: string;
  sourceAge: string;
  sourceAgeReferenceDate: string;
  sourceAddress: string;
  sourceSection: string;
  sourcePage: string;
  sourceWardLabel: string;
  localName: string | null;
  localNameEn: string | null;
  localElectoralId: string | null;
  localRollSerial: string | null;
  localAge: string | null;
  localAgeReferenceDate: string | null;
  localAddress: string | null;
  assignedWardId: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  archived: boolean;
  archiveReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoterListItem extends VoterEntry {
  displayName: string;
  displayNameEn: string;
  displayElectoralId: string;
  displayRollSerial: string;
  displayAddress: string;
  wardLabel: string | null;
  editionName: string;
}

export interface VoterFilters {
  constituencyId: string;
  wardId?: string | null;
  rollEditionId?: string | null;
  verificationStatus?: VerificationStatus | "";
  query?: string;
  unassignedOnly?: boolean;
  assignedOnly?: boolean;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ImportColumnMapping {
  nameOriginal?: string;
  nameEnglish?: string;
  electoralId?: string;
  rollSerial?: string;
  publishedAge?: string;
  ageReferenceDate?: string;
  publishedAddress?: string;
  wardNumber?: string;
  sourceSection?: string;
  sourcePage?: string;
}

export interface RollEditionCounts {
  rollEditionId: string;
  editionName: string;
  revisionCode: string;
  total: number;
  assigned: number;
  unassigned: number;
  archived: number;
  unverified: number;
  verified: number;
  needsReview: number;
}

export interface WardAssignmentHistoryEntry {
  id: string;
  fromWardId: string | null;
  toWardId: string | null;
  reason: string;
  verificationSource: string;
  changedAt: string;
}

export interface VoterChangeHistoryEntry {
  id: string;
  changedAt: string;
  action: string;
  fieldNames: string[];
}

export interface VoterDetail {
  voter: VoterListItem;
  changeHistory: VoterChangeHistoryEntry[];
  assignmentHistory: WardAssignmentHistoryEntry[];
  importBatch: { id: string; fileName: string; fileSha256: string; createdAt: string } | null;
}

export type VoterExportField = import("./constants").VoterExportField;

export interface ImportPreviewCell {
  text: string;
  type: string;
  raw: string;
  displayed: string;
  originalTextEstablished: boolean;
  precisionUnreliable: boolean;
  formula: boolean;
}

export interface ImportWorksheetInfo {
  name: string;
  hidden: boolean;
}

export interface ImportPreview {
  sessionId: string;
  fileName: string;
  fileSha256: string;
  columns: string[];
  previewRows: string[][];
  previewCells: ImportPreviewCell[][];
  rowCount: number;
  emptyRowCount: number;
  formulaCellCount: number;
  numericCoercionCount: number;
  headerWarnings: string[];
  worksheets: ImportWorksheetInfo[];
  selectedSheet: string | null;
  needsSheetSelection: boolean;
  suggestedMapping: ImportColumnMapping;
  repeatedImport: boolean;
  previousBatchId: string | null;
  repeatedInOtherEditions: boolean;
}

export interface ImportValidationIssue {
  sourceRowNumber: number;
  field: string;
  message: string;
}

export interface StagedImportRow {
  sourceRowNumber: number;
  values: Record<string, string>;
  wardMatch: "assigned" | "unassigned" | "ambiguous" | "invalid";
  assignedWardId: string | null;
  wardCandidates: Array<{ id: string; label: string }>;
  errors: string[];
  empty: boolean;
  rejected: boolean;
  identifierReview: "ok" | "needed" | "accepted_raw" | "corrected";
  corrections: Record<string, string>;
  reviewedFields: Record<string, "accepted_raw" | "corrected">;
  cellMeta: Record<
    string,
    {
      type: string;
      raw: string;
      displayed: string;
      originalTextEstablished: boolean;
      precisionUnreliable: boolean;
    }
  >;
}

export interface ImportValidateResult {
  rows: StagedImportRow[];
  rowsTruncated: boolean;
  errorCount: number;
  unassignedCount: number;
  ambiguousCount: number;
  assignedCount: number;
  rejectedCount: number;
  identifierReviewCount: number;
  emptySkipped: number;
  eligibleCount: number;
  excludedCount: number;
  issues: ImportValidationIssue[];
}

export interface ImportCommitResult {
  imported: number;
  batchId: string;
  flaggedDuplicates: number;
  unassigned: number;
  rejected: number;
}

export interface DuplicatePair {
  id: string;
  rollEditionId: string;
  voterAId: string;
  voterBId: string;
  reasons: string[];
  status: DuplicatePairStatus;
  reviewedAt: string | null;
  voterA?: VoterListItem;
  voterB?: VoterListItem;
}

export interface ResolvedScope {
  mandals: Record<string, CoverageKind | "inherited-complete" | "ancestor">;
  gramPanchayats: Record<string, CoverageKind | "inherited-complete" | "ancestor">;
  villages: Record<string, CoverageKind | "inherited-complete">;
  urbanLocalBodies: Record<string, CoverageKind | "inherited-complete">;
  ruralWards: Record<string, CoverageKind | "inherited-complete">;
  urbanWards: Record<string, CoverageKind | "inherited-complete">;
}

export type ReservationCategory = "UR" | "BC" | "SC" | "ST" | "unknown" | "not_recorded";
export type ReservationSeatType = "sarpanch" | "ward_member";
export type ReservationNotificationStatus = "draft" | "verified" | "superseded";
export type ReservationReviewStatus =
  | "pending"
  | "mapped"
  | "mandal_needs_review"
  | "unmatched"
  | "ambiguous"
  | "missing_ward"
  | "outside_coverage"
  | "boundary_mismatch"
  | "invalid_category"
  | "not_recorded"
  | "conflict"
  | "excluded";

export interface ReservationControls {
  year: number | null;
  gramPanchayats: number;
  tanuku: number;
  attili: number;
  iragavaram: number;
  sarpanchReservations: number;
  declaredWardSeats: number;
  populatedWardReservations: number;
  missingReservationCells: number;
  invalidReservationCodes: number;
  sarpanchByCode: Record<string, number>;
  wardByCode: Record<string, number>;
  mandalProposedCounts: Record<string, number>;
}

export interface ReservationControlDiff {
  label: string;
  actual: number;
  expected: number;
}

export interface ReservationParsedWardSeat {
  wardNumber: string;
  cell: string;
  original: string;
  category: ReservationCategory;
  womenReserved: boolean;
  missing: boolean;
  valid: boolean;
  formula: boolean;
}

export interface ReservationParsedRow {
  sourceRow: number;
  sourceMandal: string;
  sourceGp: string;
  proposedMandal: string;
  derivedMandalFromSuffix: boolean;
  sarpanchOriginal: string;
  sarpanchCategory: ReservationCategory;
  sarpanchWomenReserved: boolean;
  sarpanchValid: boolean;
  declaredWardCount: number | null;
  populatedWardCount: number;
  duplicateGp: boolean;
  wardSeats: ReservationParsedWardSeat[];
  issues: string[];
}

export interface ReservationWorkbookPreview {
  fileName: string;
  worksheetName: string;
  districtSource: string;
  year: number | null;
  wardHeaders: string[];
  rows: ReservationParsedRow[];
  controls: ReservationControls;
  expectedControls: ReservationControls;
  controlDiffs: ReservationControlDiff[];
  issues: string[];
  fingerprint: string;
  controlNote: string;
}

export interface ReservationSeatDraft {
  seatType: ReservationSeatType;
  sourceMandal: string;
  sourceGp: string;
  proposedMandal: string;
  derivedMandalFromSuffix: boolean;
  sourceWardNumber: string;
  declaredWardCount: number | null;
  originalCode: string;
  category: ReservationCategory;
  womenReserved: boolean;
  sourceRow: number;
  sourceCell: string;
  issues: string[];
}

export interface ReservationNotification {
  id: string;
  constituencyId: string;
  electionId: string;
  boundaryVersionId: string;
  year: number;
  name: string;
  notificationReference: string;
  notificationDate: string | null;
  districtSource: string;
  status: ReservationNotificationStatus;
  notes: string;
  verifiedAt: string | null;
  verifiedNotes: string;
  createdAt: string;
  updatedAt: string;
  electionName?: string;
}

export interface ReservationSeat {
  id: string;
  notificationId: string;
  importBatchId: string | null;
  electionId: string;
  year: number;
  seatType: ReservationSeatType;
  gramPanchayatId: string | null;
  wardId: string | null;
  sourceMandalLabel: string;
  sourceGpLabel: string;
  sourceWardNumber: string;
  declaredWardCount: number | null;
  originalCode: string;
  category: ReservationCategory;
  womenReserved: boolean;
  reviewStatus: ReservationReviewStatus;
  sourceFilename: string;
  sourceWorksheet: string;
  sourceRow: number | null;
  sourceCell: string;
  verificationNotes: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  gpName?: string;
  wardName?: string;
  mandalName?: string;
}

export interface ReservationHistoryItem {
  id: string;
  seatId: string;
  notificationId: string;
  changedAt: string;
  action: string;
  notes: string;
  fieldNames: string[];
}

export interface ReservationMandalProposal {
  proposed: string;
  sourceLabels: string[];
  derivedFromSuffix: boolean;
  matchStatus: "unmatched" | "matched" | "ambiguous" | "approved";
  mandalId: string | null;
  mandalName: string | null;
  candidates: Array<{ id: string; name: string }>;
  approved: boolean;
  gpCount: number;
}

export interface ReservationGeoCreatePlan {
  mandals: Array<{ name: string; sourceLabels: string[] }>;
  gramPanchayats: Array<{ mandalName: string; name: string }>;
  wards: Array<{ mandalName: string; gpName: string; wardNumber: string }>;
}

export interface ReservationStagedRow {
  draft: ReservationSeatDraft;
  reviewStatus: ReservationReviewStatus;
  mandalId: string | null;
  gramPanchayatId: string | null;
  wardId: string | null;
  issues: string[];
  importable: boolean;
}

export interface ReservationImportSession {
  sessionId: string;
  constituencyId: string;
  fileName: string;
  filePath: string;
  worksheets: Array<{ name: string; hidden: boolean; excluded: boolean }>;
  selectedSheet: string | null;
  preview: ReservationWorkbookPreview | null;
  electionId: string | null;
  notificationId: string | null;
  allowPartial: boolean;
  mandalApprovals: Record<string, { mandalId: string | null; approved: boolean }>;
  staged: ReservationStagedRow[];
  geoPlan: ReservationGeoCreatePlan | null;
  eligibleCount: number;
  unresolvedCount: number;
  excludedCount: number;
}

export interface ReservationSummary {
  notification: ReservationNotification | null;
  sarpanchByCategory: Record<string, number>;
  wardByCategory: Record<string, number>;
  womenReservedBySeatType: Record<ReservationSeatType, number>;
  mandalTotals: Array<{ mandal: string; gps: number; sarpanch: number; wards: number }>;
  unmapped: number;
  unverified: number;
  conflicting: number;
  sourceWideNote: string;
  importedSarpanch: number;
  importedWardMembers: number;
}

export interface ReservationMatrixRow {
  mandal: string;
  gramPanchayat: string;
  gpId: string | null;
  sarpanchCode: string;
  sarpanchWomen: boolean;
  declaredWardCount: number | null;
  wards: Array<{ wardNumber: string; code: string; womenReserved: boolean; applicable: boolean; missing: boolean }>;
}

export interface ReservationCommitResult {
  imported: number;
  unresolved: number;
  excluded: number;
  conflicting: number;
  batchId: string;
  notificationId: string;
}
