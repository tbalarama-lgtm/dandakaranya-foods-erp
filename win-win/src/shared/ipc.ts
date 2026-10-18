export const IpcChannel = {
  platform: "winwin:platform",
  appInfo: "winwin:appInfo",
  settingsGet: "winwin:settingsGet",
  settingsUpdate: "winwin:settingsUpdate",
  dashboardCounts: "winwin:dashboardCounts",
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
  demoStatus: "winwin:demoStatus"
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
