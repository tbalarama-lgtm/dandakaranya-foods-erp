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

export interface ImportPreview {
  sessionId: string;
  fileName: string;
  fileSha256: string;
  columns: string[];
  previewRows: string[][];
  rowCount: number;
  repeatedImport: boolean;
  previousBatchId: string | null;
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
}

export interface ImportValidateResult {
  rows: StagedImportRow[];
  errorCount: number;
  unassignedCount: number;
  ambiguousCount: number;
  assignedCount: number;
  issues: ImportValidationIssue[];
}

export interface ImportCommitResult {
  imported: number;
  batchId: string;
  flaggedDuplicates: number;
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
