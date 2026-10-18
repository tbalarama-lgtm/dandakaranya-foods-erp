import type {
  AssemblyConstituency,
  AssignmentStatus,
  AuditRecord,
  BoundaryVersion,
  ConsentStatus,
  ConstituencyCoverage,
  CoverageKind,
  ElectionCoverageLink,
  ElectionWorkspace,
  ElectionWardLink,
  GramPanchayat,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueStatusHistory,
  Mandal,
  Person,
  TaskItem,
  TaskStatus,
  TeamAssignment,
  UrbanBodyType,
  UrbanLocalBody,
  Village,
  VillageWardMapping,
  Ward,
  WardClassification,
  WardContact,
  WorkspaceStatus
} from "@shared/types";
import { isOverdue } from "@shared/dates";

export function asBool(value: number): boolean {
  return value === 1;
}

export function mapNamed<T extends AssemblyConstituency | Mandal>(row: Record<string, unknown>): T {
  return {
    id: String(row.id),
    name: String(row.name),
    nameTe: String(row.name_te ?? ""),
    officialCode: row.official_code == null || row.official_code === "" ? null : String(row.official_code),
    notes: String(row.notes ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  } as T;
}

export function mapGp(row: Record<string, unknown>): GramPanchayat {
  return { ...mapNamed<Mandal>(row), mandalId: String(row.mandal_id) };
}

export function mapVillage(row: Record<string, unknown>): Village {
  return { ...mapNamed<Mandal>(row), gramPanchayatId: String(row.gram_panchayat_id) };
}

export function mapUlb(row: Record<string, unknown>): UrbanLocalBody {
  return {
    ...mapNamed<Mandal>(row),
    bodyType: String(row.body_type) as UrbanBodyType,
    administrativeMandalId: row.administrative_mandal_id ? String(row.administrative_mandal_id) : null
  };
}

export function mapWard(row: Record<string, unknown>): Ward {
  return {
    id: String(row.id),
    classification: String(row.classification) as WardClassification,
    gramPanchayatId: row.gram_panchayat_id ? String(row.gram_panchayat_id) : null,
    urbanLocalBodyId: row.urban_local_body_id ? String(row.urban_local_body_id) : null,
    boundaryVersionId: String(row.boundary_version_id),
    wardNumber: String(row.ward_number),
    name: String(row.name),
    nameTe: String(row.name_te ?? ""),
    officialCode: row.official_code == null || row.official_code === "" ? null : String(row.official_code),
    recordSource: String(row.record_source ?? ""),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    notes: String(row.notes ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapBoundary(row: Record<string, unknown>): BoundaryVersion {
  return {
    id: String(row.id),
    name: String(row.name),
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
    notes: String(row.notes ?? ""),
    status: String(row.status) as BoundaryVersion["status"],
    createdAt: String(row.created_at)
  };
}

export function mapCoverage(row: Record<string, unknown>): ConstituencyCoverage {
  return {
    id: String(row.id),
    constituencyId: String(row.constituency_id),
    boundaryVersionId: String(row.boundary_version_id),
    unitType: row.unit_type as ConstituencyCoverage["unitType"],
    unitId: String(row.unit_id),
    coverageKind: String(row.coverage_kind) as CoverageKind,
    notes: String(row.notes ?? "")
  };
}

export function mapVillageWard(row: Record<string, unknown>): VillageWardMapping {
  return {
    id: String(row.id),
    villageId: String(row.village_id),
    wardId: String(row.ward_id),
    coverageKind: String(row.coverage_kind) as CoverageKind,
    notes: String(row.notes ?? "")
  };
}

export function mapElection(row: Record<string, unknown>): ElectionWorkspace {
  return {
    id: String(row.id),
    name: String(row.name),
    electionType: row.election_type as ElectionWorkspace["electionType"],
    year: Number(row.year),
    constituencyId: String(row.constituency_id),
    boundaryVersionId: String(row.boundary_version_id),
    status: String(row.status) as WorkspaceStatus,
    notes: String(row.notes ?? ""),
    snapshotJson: row.snapshot_json ? String(row.snapshot_json) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapElectionWard(row: Record<string, unknown>): ElectionWardLink {
  return {
    electionId: String(row.election_id),
    wardId: String(row.ward_id),
    wardNumberSnapshot: String(row.ward_number_snapshot),
    wardNameSnapshot: String(row.ward_name_snapshot),
    classificationSnapshot: String(row.classification_snapshot) as WardClassification
  };
}

export function mapElectionCoverage(row: Record<string, unknown>): ElectionCoverageLink {
  return {
    id: String(row.id),
    electionId: String(row.election_id),
    unitType: row.unit_type as ElectionCoverageLink["unitType"],
    unitId: String(row.unit_id),
    coverageKind: String(row.coverage_kind) as CoverageKind,
    unitNameSnapshot: String(row.unit_name_snapshot)
  };
}

export function mapPerson(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    name: String(row.name),
    nameTe: String(row.name_te ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    consentStatus: String(row.consent_status) as ConsentStatus,
    consentDate: row.consent_date ? String(row.consent_date) : null,
    consentSource: String(row.consent_source ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapContact(row: Record<string, unknown>, person: Person): WardContact {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    wardId: String(row.ward_id),
    constituencyId: String(row.constituency_id),
    organization: String(row.organization ?? ""),
    publicRole: String(row.public_role ?? ""),
    areaServed: String(row.area_served ?? ""),
    recordSource: String(row.record_source ?? ""),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    coordinationNotes: String(row.coordination_notes ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    person
  };
}

export function mapAssignment(row: Record<string, unknown>, person?: Person): TeamAssignment {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    wardId: String(row.ward_id),
    constituencyId: String(row.constituency_id),
    operationalRole: String(row.operational_role),
    responsibilities: String(row.responsibilities ?? ""),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    status: String(row.status) as AssignmentStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    person
  };
}

export function mapIssue(row: Record<string, unknown>): Issue {
  return {
    id: String(row.id),
    wardId: String(row.ward_id),
    constituencyId: String(row.constituency_id),
    referenceNumber: String(row.reference_number),
    title: String(row.title),
    category: String(row.category),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    reportedAt: String(row.reported_at),
    responsiblePersonId: row.responsible_person_id ? String(row.responsible_person_id) : null,
    priority: String(row.priority) as IssuePriority,
    dueDate: row.due_date ? String(row.due_date) : null,
    status: String(row.status) as IssueStatus,
    resolutionNotes: String(row.resolution_notes ?? ""),
    complainantName: String(row.complainant_name ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapIssueHistory(row: Record<string, unknown>): IssueStatusHistory {
  return {
    id: String(row.id),
    issueId: String(row.issue_id),
    status: String(row.status) as IssueStatus,
    note: String(row.note ?? ""),
    changedAt: String(row.changed_at)
  };
}

export function mapTask(row: Record<string, unknown>): TaskItem {
  const status = String(row.status) as TaskStatus;
  const dueDate = row.due_date ? String(row.due_date) : null;
  return {
    id: String(row.id),
    wardId: String(row.ward_id),
    constituencyId: String(row.constituency_id),
    title: String(row.title),
    assignedPersonId: row.assigned_person_id ? String(row.assigned_person_id) : null,
    relatedIssueId: row.related_issue_id ? String(row.related_issue_id) : null,
    dueDate,
    status,
    description: String(row.description ?? ""),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completionNotes: String(row.completion_notes ?? ""),
    archived: asBool(Number(row.archived)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    overdue: isOverdue(dueDate, status)
  };
}

export function mapAudit(row: Record<string, unknown>): AuditRecord {
  let changedFields: string[] = [];
  try {
    const parsed = JSON.parse(String(row.changed_fields ?? "[]")) as unknown;
    if (Array.isArray(parsed)) changedFields = parsed.map(String);
  } catch {
    changedFields = [];
  }
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    action: String(row.action),
    entityType: String(row.entity_type),
    recordId: String(row.record_id),
    changedFields
  };
}
