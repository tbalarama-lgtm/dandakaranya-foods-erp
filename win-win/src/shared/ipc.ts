export const IpcChannel = {
  platform: "winwin:platform",
  appInfo: "winwin:appInfo",
  settingsGet: "winwin:settingsGet",
  settingsUpdate: "winwin:settingsUpdate",
  dashboardCounts: "winwin:dashboardCounts",
  dashboardAttention: "winwin:dashboardAttention",
  geoDashboard: "winwin:geoDashboard",
  boundaryList: "winwin:boundaryList",
  boundaryCreate: "winwin:boundaryCreate",
  boundaryUpdate: "winwin:boundaryUpdate",
  constituencyList: "winwin:constituencyList",
  constituencyCreate: "winwin:constituencyCreate",
  constituencyUpdate: "winwin:constituencyUpdate",
  constituencyArchive: "winwin:constituencyArchive",
  mandalList: "winwin:mandalList",
  mandalCreate: "winwin:mandalCreate",
  mandalUpdate: "winwin:mandalUpdate",
  mandalArchive: "winwin:mandalArchive",
  gpList: "winwin:gpList",
  gpCreate: "winwin:gpCreate",
  gpUpdate: "winwin:gpUpdate",
  gpArchive: "winwin:gpArchive",
  villageList: "winwin:villageList",
  villageCreate: "winwin:villageCreate",
  villageUpdate: "winwin:villageUpdate",
  villageArchive: "winwin:villageArchive",
  ulbList: "winwin:ulbList",
  ulbCreate: "winwin:ulbCreate",
  ulbUpdate: "winwin:ulbUpdate",
  ulbArchive: "winwin:ulbArchive",
  wardList: "winwin:wardList",
  wardGet: "winwin:wardGet",
  wardCreate: "winwin:wardCreate",
  wardUpdate: "winwin:wardUpdate",
  wardArchive: "winwin:wardArchive",
  villageWardList: "winwin:villageWardList",
  villageWardSet: "winwin:villageWardSet",
  villageWardDelete: "winwin:villageWardDelete",
  coverageList: "winwin:coverageList",
  coverageSet: "winwin:coverageSet",
  coverageDelete: "winwin:coverageDelete",
  scopeGet: "winwin:scopeGet",
  electionList: "winwin:electionList",
  electionGet: "winwin:electionGet",
  electionCreate: "winwin:electionCreate",
  electionUpdate: "winwin:electionUpdate",
  electionArchive: "winwin:electionArchive",
  auditList: "winwin:auditList",
  backupCreate: "winwin:backupCreate",
  backupRestore: "winwin:backupRestore",
  demoLoad: "winwin:demoLoad",
  demoStatus: "winwin:demoStatus",
  personList: "winwin:personList",
  personCreate: "winwin:personCreate",
  personUpdate: "winwin:personUpdate",
  personArchive: "winwin:personArchive",
  contactList: "winwin:contactList",
  contactCreate: "winwin:contactCreate",
  contactUpdate: "winwin:contactUpdate",
  contactArchive: "winwin:contactArchive",
  teamList: "winwin:teamList",
  teamCreate: "winwin:teamCreate",
  teamUpdate: "winwin:teamUpdate",
  issueList: "winwin:issueList",
  issueGet: "winwin:issueGet",
  issueCreate: "winwin:issueCreate",
  issueUpdate: "winwin:issueUpdate",
  taskList: "winwin:taskList",
  taskCreate: "winwin:taskCreate",
  taskUpdate: "winwin:taskUpdate",
  wardOverview: "winwin:wardOverview",
  editionList: "winwin:editionList",
  editionCreate: "winwin:editionCreate",
  editionArchive: "winwin:editionArchive",
  editionCounts: "winwin:editionCounts",
  voterList: "winwin:voterList",
  voterGet: "winwin:voterGet",
  voterCreate: "winwin:voterCreate",
  voterUpdate: "winwin:voterUpdate",
  voterArchive: "winwin:voterArchive",
  voterAssignBulk: "winwin:voterAssignBulk",
  voterExport: "winwin:voterExport",
  importOpen: "winwin:importOpen",
  importSelectSheet: "winwin:importSelectSheet",
  importSetEdition: "winwin:importSetEdition",
  importSetMapping: "winwin:importSetMapping",
  importValidate: "winwin:importValidate",
  importListStaged: "winwin:importListStaged",
  importReviewIdentifiers: "winwin:importReviewIdentifiers",
  importAssignStaged: "winwin:importAssignStaged",
  importCommit: "winwin:importCommit",
  importCancel: "winwin:importCancel",
  importTemplate: "winwin:importTemplate",
  importErrorReport: "winwin:importErrorReport",
  duplicateList: "winwin:duplicateList",
  duplicateReview: "winwin:duplicateReview",
  reservationOpen: "winwin:reservationOpen",
  reservationSelectSheet: "winwin:reservationSelectSheet",
  reservationSetContext: "winwin:reservationSetContext",
  reservationApproveMandal: "winwin:reservationApproveMandal",
  reservationGeoPlan: "winwin:reservationGeoPlan",
  reservationCreateGeo: "winwin:reservationCreateGeo",
  reservationSetPartial: "winwin:reservationSetPartial",
  reservationCommit: "winwin:reservationCommit",
  reservationCancel: "winwin:reservationCancel",
  reservationSession: "winwin:reservationSession",
  reservationProposals: "winwin:reservationProposals",
  reservationNotificationList: "winwin:reservationNotificationList",
  reservationNotificationCreate: "winwin:reservationNotificationCreate",
  reservationVerify: "winwin:reservationVerify",
  reservationSupersede: "winwin:reservationSupersede",
  reservationList: "winwin:reservationList",
  reservationSummary: "winwin:reservationSummary",
  reservationMatrix: "winwin:reservationMatrix",
  reservationExport: "winwin:reservationExport",
  reservationHistory: "winwin:reservationHistory",
  reservationForUnit: "winwin:reservationForUnit"
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export interface WinWinApi {
  platform: () => Promise<import("./types").PlatformInfo>;
  appInfo: () => Promise<import("./types").AppInfo>;
  settingsGet: () => Promise<import("./types").AppSettings>;
  settingsUpdate: (input: Partial<import("./types").AppSettings>) => Promise<import("./types").AppSettings>;
  dashboardCounts: (input: {
    constituencyId: string;
    boundaryVersionId: string;
  }) => Promise<import("./types").DashboardCounts>;
  dashboardAttention: (input: { constituencyId: string }) => Promise<import("./types").DashboardAttention>;
  geoDashboard: (input: import("./types").GeoDashboardQuery) => Promise<import("./types").GeoDashboard>;
  boundaryList: () => Promise<import("./types").BoundaryVersion[]>;
  boundaryCreate: (input: {
    name: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    notes?: string;
    status?: import("./types").BoundaryStatus;
  }) => Promise<import("./types").BoundaryVersion>;
  boundaryUpdate: (input: {
    id: string;
    name?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    notes?: string;
    status?: import("./types").BoundaryStatus;
  }) => Promise<import("./types").BoundaryVersion>;
  constituencyList: (includeArchived?: boolean) => Promise<import("./types").AssemblyConstituency[]>;
  constituencyCreate: (input: NamedInput) => Promise<import("./types").AssemblyConstituency>;
  constituencyUpdate: (input: NamedInput & { id: string; archived?: boolean }) => Promise<import("./types").AssemblyConstituency>;
  constituencyArchive: (id: string) => Promise<void>;
  mandalList: (input?: { constituencyId?: string; boundaryVersionId?: string; includeArchived?: boolean }) => Promise<import("./types").Mandal[]>;
  mandalCreate: (input: NamedInput) => Promise<import("./types").Mandal>;
  mandalUpdate: (input: NamedInput & { id: string }) => Promise<import("./types").Mandal>;
  mandalArchive: (id: string) => Promise<void>;
  gpList: (input?: {
    mandalId?: string;
    constituencyId?: string;
    boundaryVersionId?: string;
    includeArchived?: boolean;
  }) => Promise<import("./types").GramPanchayat[]>;
  gpCreate: (input: NamedInput & { mandalId: string }) => Promise<import("./types").GramPanchayat>;
  gpUpdate: (input: NamedInput & { id: string; mandalId?: string }) => Promise<import("./types").GramPanchayat>;
  gpArchive: (id: string) => Promise<void>;
  villageList: (input?: {
    gramPanchayatId?: string;
    constituencyId?: string;
    boundaryVersionId?: string;
    includeArchived?: boolean;
  }) => Promise<import("./types").Village[]>;
  villageCreate: (input: NamedInput & { gramPanchayatId: string }) => Promise<import("./types").Village>;
  villageUpdate: (input: NamedInput & { id: string; gramPanchayatId?: string }) => Promise<import("./types").Village>;
  villageArchive: (id: string) => Promise<void>;
  ulbList: (input?: {
    constituencyId?: string;
    boundaryVersionId?: string;
    includeArchived?: boolean;
  }) => Promise<import("./types").UrbanLocalBody[]>;
  ulbCreate: (input: NamedInput & {
    bodyType: import("./types").UrbanBodyType;
    administrativeMandalId?: string | null;
  }) => Promise<import("./types").UrbanLocalBody>;
  ulbUpdate: (input: NamedInput & {
    id: string;
    bodyType?: import("./types").UrbanBodyType;
    administrativeMandalId?: string | null;
  }) => Promise<import("./types").UrbanLocalBody>;
  ulbArchive: (id: string) => Promise<void>;
  wardList: (input: import("./types").WardFilters) => Promise<import("./types").PagedResult<import("./types").WardListItem>>;
  wardGet: (id: string) => Promise<import("./types").WardDetail>;
  wardCreate: (input: WardWriteInput) => Promise<import("./types").Ward>;
  wardUpdate: (input: WardWriteInput & { id: string }) => Promise<import("./types").Ward>;
  wardArchive: (id: string) => Promise<void>;
  villageWardList: (wardId: string) => Promise<import("./types").VillageWardMapping[]>;
  villageWardSet: (input: {
    villageId: string;
    wardId: string;
    coverageKind: import("./types").CoverageKind;
    notes?: string;
  }) => Promise<import("./types").VillageWardMapping>;
  villageWardDelete: (id: string) => Promise<void>;
  coverageList: (input: {
    constituencyId: string;
    boundaryVersionId: string;
  }) => Promise<import("./types").ConstituencyCoverage[]>;
  coverageSet: (input: {
    constituencyId: string;
    boundaryVersionId: string;
    unitType: import("./types").UnitType;
    unitId: string;
    coverageKind: import("./types").CoverageKind;
    notes?: string;
  }) => Promise<import("./types").ConstituencyCoverage>;
  coverageDelete: (id: string) => Promise<void>;
  scopeGet: (input: {
    constituencyId: string;
    boundaryVersionId: string;
  }) => Promise<import("./types").ResolvedScope>;
  electionList: (input?: {
    constituencyId?: string;
    includeArchived?: boolean;
  }) => Promise<import("./types").ElectionWorkspace[]>;
  electionGet: (id: string) => Promise<{
    election: import("./types").ElectionWorkspace;
    wards: import("./types").ElectionWardLink[];
    coverage: import("./types").ElectionCoverageLink[];
  }>;
  electionCreate: (input: ElectionWriteInput) => Promise<import("./types").ElectionWorkspace>;
  electionUpdate: (input: ElectionWriteInput & { id: string }) => Promise<import("./types").ElectionWorkspace>;
  electionArchive: (id: string) => Promise<import("./types").ElectionWorkspace>;
  auditList: (input?: { page?: number; pageSize?: number }) => Promise<import("./types").PagedResult<import("./types").AuditRecord>>;
  backupCreate: () => Promise<import("./types").BackupResult>;
  backupRestore: () => Promise<import("./types").RestoreResult>;
  demoLoad: () => Promise<{ loaded: boolean }>;
  demoStatus: () => Promise<{ dataKind: import("./types").DataKind; canLoadDemo: boolean }>;
  personList: (input?: { query?: string; includeArchived?: boolean }) => Promise<import("./types").Person[]>;
  personCreate: (input: PersonWriteInput) => Promise<import("./types").Person>;
  personUpdate: (input: PersonWriteInput & { id: string }) => Promise<import("./types").Person>;
  personArchive: (id: string) => Promise<void>;
  contactList: (input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<import("./types").PagedResult<import("./types").WardContact>>;
  contactCreate: (input: ContactWriteInput) => Promise<import("./types").WardContact>;
  contactUpdate: (input: ContactWriteInput & { id: string }) => Promise<import("./types").WardContact>;
  contactArchive: (input: { id: string; constituencyId: string }) => Promise<void>;
  teamList: (input: {
    wardId: string;
    constituencyId: string;
    includeInactive?: boolean;
  }) => Promise<import("./types").TeamAssignment[]>;
  teamCreate: (input: AssignmentWriteInput) => Promise<import("./types").TeamAssignment>;
  teamUpdate: (input: AssignmentWriteInput & { id: string }) => Promise<import("./types").TeamAssignment>;
  issueList: (input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    category?: string;
    status?: import("./types").IssueStatus | "";
    priority?: import("./types").IssuePriority | "";
    responsiblePersonId?: string | "";
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<import("./types").PagedResult<import("./types").Issue>>;
  issueGet: (input: {
    id: string;
    constituencyId: string;
  }) => Promise<{ issue: import("./types").Issue; history: import("./types").IssueStatusHistory[] }>;
  issueCreate: (input: IssueWriteInput) => Promise<import("./types").Issue>;
  issueUpdate: (input: IssueWriteInput & { id: string }) => Promise<import("./types").Issue>;
  taskList: (input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    status?: import("./types").TaskStatus | "";
    assignedPersonId?: string | "";
    filter?: "overdue" | "upcoming" | "completed" | "open" | "";
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<import("./types").PagedResult<import("./types").TaskItem>>;
  taskCreate: (input: TaskWriteInput) => Promise<{ task: import("./types").TaskItem; warning: string | null }>;
  taskUpdate: (input: TaskWriteInput & { id: string }) => Promise<{
    task: import("./types").TaskItem;
    warning: string | null;
  }>;
  wardOverview: (input: { wardId: string; constituencyId: string }) => Promise<import("./types").WardOverview>;
  editionList: (input: { constituencyId: string; includeArchived?: boolean }) => Promise<import("./types").RollEdition[]>;
  editionCreate: (input: {
    constituencyId: string;
    boundaryVersionId: string;
    name: string;
    revisionCode?: string;
    publishedOn?: string | null;
    notes?: string;
  }) => Promise<import("./types").RollEdition>;
  editionArchive: (input: { id: string; constituencyId: string }) => Promise<import("./types").RollEdition>;
  editionCounts: (input: {
    constituencyId: string;
    rollEditionId: string;
  }) => Promise<import("./types").RollEditionCounts>;
  voterList: (input: import("./types").VoterFilters) => Promise<import("./types").PagedResult<import("./types").VoterListItem>>;
  voterGet: (input: { id: string; constituencyId: string }) => Promise<import("./types").VoterDetail>;
  voterCreate: (input: VoterWriteInput) => Promise<import("./types").VoterEntry>;
  voterUpdate: (input: VoterUpdateInput) => Promise<import("./types").VoterEntry>;
  voterArchive: (input: { id: string; constituencyId: string; reason: string }) => Promise<import("./types").VoterEntry>;
  voterAssignBulk: (input: {
    constituencyId: string;
    voterIds: string[];
    wardId: string | null;
    reason: string;
    verificationSource?: string;
  }) => Promise<{ updated: number }>;
  voterExport: (input: {
    filters: import("./types").VoterFilters;
    fields: string[];
    format: "csv" | "xlsx";
  }) => Promise<{ cancelled: boolean; path?: string; count?: number }>;
  importOpen: (input: { constituencyId: string }) => Promise<
    | { cancelled: true }
    | (import("./types").ImportPreview & { cancelled?: false })
  >;
  importSelectSheet: (input: { sessionId: string; sheetName: string }) => Promise<import("./types").ImportPreview>;
  importSetEdition: (input: { sessionId: string; rollEditionId: string }) => Promise<import("./types").ImportPreview>;
  importSetMapping: (input: {
    sessionId: string;
    mapping: import("./types").ImportColumnMapping;
  }) => Promise<import("./types").ImportColumnMapping>;
  importValidate: (input: { sessionId: string }) => Promise<import("./types").ImportValidateResult>;
  importListStaged: (input: {
    sessionId: string;
    kind?: "review" | "identifier" | "rejected" | "unassigned" | "all";
    page?: number;
    pageSize?: number;
  }) => Promise<{
    items: import("./types").StagedImportRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  importReviewIdentifiers: (input: {
    sessionId: string;
    items: Array<{
      sourceRowNumber: number;
      field: "electoralId" | "rollSerial" | "wardNumber";
      action: "accept-raw" | "correct";
      value?: string;
    }>;
  }) => Promise<import("./types").ImportValidateResult>;
  importAssignStaged: (input: {
    sessionId: string;
    sourceRowNumbers: number[];
    wardId: string | null;
  }) => Promise<import("./types").ImportValidateResult>;
  importCommit: (input: {
    sessionId: string;
    acknowledgeRepeat?: boolean;
  }) => Promise<import("./types").ImportCommitResult>;
  importCancel: (input: { sessionId: string }) => Promise<void>;
  importTemplate: (input: { format: "csv" | "xlsx" }) => Promise<{ cancelled: boolean; path?: string }>;
  importErrorReport: (input: {
    sessionId?: string;
    issues?: import("./types").ImportValidationIssue[];
  }) => Promise<{
    cancelled: boolean;
    path?: string;
  }>;
  onImportProgress: (
    handler: (progress: { phase: string; processed: number; total: number; message: string }) => void
  ) => () => void;
  duplicateList: (input: {
    constituencyId: string;
    rollEditionId: string;
  }) => Promise<import("./types").DuplicatePair[]>;
  duplicateReview: (input: {
    id: string;
    constituencyId: string;
    status: import("./types").DuplicatePairStatus;
  }) => Promise<void>;
  reservationOpen: (input: { constituencyId: string }) => Promise<
    | { cancelled: true }
    | import("./types").ReservationImportSession
  >;
  reservationSelectSheet: (input: { sessionId: string; sheetName: string }) => Promise<import("./types").ReservationImportSession>;
  reservationSetContext: (input: {
    sessionId: string;
    electionId: string;
    notificationId?: string;
    notificationName?: string;
    year?: number;
  }) => Promise<import("./types").ReservationImportSession>;
  reservationApproveMandal: (input: {
    sessionId: string;
    proposed: string;
    mandalId: string | null;
  }) => Promise<import("./types").ReservationImportSession>;
  reservationGeoPlan: (input: { sessionId: string }) => Promise<import("./types").ReservationImportSession>;
  reservationCreateGeo: (input: { sessionId: string; confirm: boolean }) => Promise<import("./types").ReservationImportSession>;
  reservationSetPartial: (input: { sessionId: string; allowPartial: boolean }) => Promise<import("./types").ReservationImportSession>;
  reservationCommit: (input: { sessionId: string; allowPartial?: boolean }) => Promise<import("./types").ReservationCommitResult>;
  reservationCancel: (input: { sessionId: string }) => Promise<void>;
  reservationSession: (input: { sessionId: string }) => Promise<import("./types").ReservationImportSession>;
  reservationProposals: (input: { sessionId: string }) => Promise<import("./types").ReservationMandalProposal[]>;
  reservationNotificationList: (input: {
    constituencyId: string;
    electionId?: string;
  }) => Promise<import("./types").ReservationNotification[]>;
  reservationNotificationCreate: (input: {
    constituencyId: string;
    electionId: string;
    name: string;
    year?: number;
    notificationReference?: string;
    notificationDate?: string | null;
    notes?: string;
  }) => Promise<import("./types").ReservationNotification>;
  reservationVerify: (input: {
    id: string;
    constituencyId: string;
    notificationReference: string;
    notes: string;
  }) => Promise<import("./types").ReservationNotification>;
  reservationSupersede: (input: { id: string; constituencyId: string }) => Promise<import("./types").ReservationNotification>;
  reservationList: (input: {
    constituencyId: string;
    notificationId?: string;
    electionId?: string;
    year?: number;
    mandalId?: string;
    gramPanchayatId?: string;
    category?: string;
    womenReserved?: boolean | "";
    reviewStatus?: string;
    seatType?: import("./types").ReservationSeatType | "";
    page?: number;
    pageSize?: number;
  }) => Promise<import("./types").PagedResult<import("./types").ReservationSeat>>;
  reservationSummary: (input: {
    constituencyId: string;
    notificationId?: string;
    electionId?: string;
  }) => Promise<import("./types").ReservationSummary>;
  reservationMatrix: (input: {
    constituencyId: string;
    notificationId: string;
  }) => Promise<{ wardNumbers: string[]; rows: import("./types").ReservationMatrixRow[] }>;
  reservationExport: (input: {
    constituencyId: string;
    notificationId: string;
    kind: "sarpanch" | "ward_member" | "matrix" | "review";
    format: "csv" | "xlsx";
  }) => Promise<{ cancelled: boolean; path?: string }>;
  reservationHistory: (input: { seatId: string }) => Promise<import("./types").ReservationHistoryItem[]>;
  reservationForUnit: (input: {
    constituencyId: string;
    electionId?: string;
    gramPanchayatId?: string;
    wardId?: string;
  }) => Promise<import("./types").ReservationSeat[]>;
}

export interface NamedInput {
  name: string;
  nameTe?: string;
  officialCode?: string | null;
  notes?: string;
}

export interface WardWriteInput {
  classification: import("./types").WardClassification;
  gramPanchayatId?: string | null;
  urbanLocalBodyId?: string | null;
  boundaryVersionId: string;
  wardNumber: string;
  name: string;
  nameTe?: string;
  officialCode?: string | null;
  recordSource?: string;
  lastVerifiedAt?: string | null;
  notes?: string;
}

export interface ElectionWriteInput {
  name: string;
  electionType: import("./types").ElectionType;
  year: number;
  constituencyId: string;
  boundaryVersionId: string;
  status?: import("./types").WorkspaceStatus;
  notes?: string;
  wardIds: string[];
  coverage: Array<{
    unitType: import("./types").UnitType;
    unitId: string;
    coverageKind: import("./types").CoverageKind;
  }>;
}

export interface PersonWriteInput {
  name: string;
  nameTe?: string;
  phone?: string;
  email?: string;
  consentStatus: import("./types").ConsentStatus;
  consentDate?: string | null;
  consentSource?: string;
}

export interface ContactWriteInput {
  personId?: string;
  person?: PersonWriteInput;
  wardId: string;
  constituencyId: string;
  organization?: string;
  publicRole?: string;
  areaServed?: string;
  recordSource?: string;
  lastVerifiedAt?: string | null;
  coordinationNotes?: string;
}

export interface AssignmentWriteInput {
  personId: string;
  wardId: string;
  constituencyId: string;
  operationalRole: string;
  responsibilities?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: import("./types").AssignmentStatus;
}

export interface IssueWriteInput {
  wardId: string;
  constituencyId: string;
  title: string;
  category: string;
  location?: string;
  description?: string;
  reportedAt: string;
  responsiblePersonId?: string | null;
  priority: import("./types").IssuePriority;
  dueDate?: string | null;
  status?: import("./types").IssueStatus;
  resolutionNotes?: string;
  complainantName?: string;
}

export interface VoterWriteInput {
  rollEditionId: string;
  constituencyId: string;
  sourceName?: string;
  sourceNameEn?: string;
  sourceElectoralId?: string;
  sourceRollSerial?: string;
  sourceAge?: string;
  sourceAgeReferenceDate?: string;
  sourceAddress?: string;
  sourceSection?: string;
  sourcePage?: string;
  assignedWardId?: string | null;
  verificationStatus?: import("./types").VerificationStatus;
}

export interface VoterUpdateInput {
  id: string;
  constituencyId: string;
  localName?: string | null;
  localNameEn?: string | null;
  localElectoralId?: string | null;
  localRollSerial?: string | null;
  localAge?: string | null;
  localAgeReferenceDate?: string | null;
  localAddress?: string | null;
  assignedWardId?: string | null;
  verificationStatus?: import("./types").VerificationStatus;
  verifiedAt?: string | null;
}

export interface TaskWriteInput {
  wardId: string;
  constituencyId: string;
  title: string;
  assignedPersonId?: string | null;
  relatedIssueId?: string | null;
  dueDate?: string | null;
  status?: import("./types").TaskStatus;
  description?: string;
  completedAt?: string | null;
  completionNotes?: string;
  allowInactiveAssignee?: boolean;
}
