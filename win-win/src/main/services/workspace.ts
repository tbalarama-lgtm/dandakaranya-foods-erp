import type Database from "better-sqlite3";
import { PAGE_SIZE } from "@shared/constants";
import { isIsoDate, isOverdue, localDateString } from "@shared/dates";
import type {
  ActivityItem,
  AssignmentStatus,
  ConsentStatus,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueStatusHistory,
  PagedResult,
  Person,
  TaskItem,
  TaskStatus,
  TeamAssignment,
  WardContact,
  WardOverview
} from "@shared/types";
import { AppError } from "../errors";
import { newId, nowIso } from "../db/ids";
import {
  mapAssignment,
  mapContact,
  mapIssue,
  mapIssueHistory,
  mapPerson,
  mapTask
} from "../db/mappers";
import { writeAudit } from "./audit";
import { resolveScope } from "./coverage";
import { getWard } from "./wards";

const ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: []
};

export interface PersonWrite {
  name: string;
  nameTe?: string;
  phone?: string;
  email?: string;
  consentStatus: ConsentStatus;
  consentDate?: string | null;
  consentSource?: string;
}

export interface ContactWrite {
  personId?: string;
  person?: PersonWrite;
  wardId: string;
  constituencyId: string;
  organization?: string;
  publicRole?: string;
  areaServed?: string;
  recordSource?: string;
  lastVerifiedAt?: string | null;
  coordinationNotes?: string;
}

export interface AssignmentWrite {
  personId: string;
  wardId: string;
  constituencyId: string;
  operationalRole: string;
  responsibilities?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: AssignmentStatus;
}

export interface IssueWrite {
  wardId: string;
  constituencyId: string;
  title: string;
  category: string;
  location?: string;
  description?: string;
  reportedAt: string;
  responsiblePersonId?: string | null;
  priority: IssuePriority;
  dueDate?: string | null;
  status?: IssueStatus;
  resolutionNotes?: string;
  complainantName?: string;
}

export interface TaskWrite {
  wardId: string;
  constituencyId: string;
  title: string;
  assignedPersonId?: string | null;
  relatedIssueId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  description?: string;
  completedAt?: string | null;
  completionNotes?: string;
  allowInactiveAssignee?: boolean;
}

function requireDate(value: string | null | undefined, label: string): string | null {
  if (value == null || value === "") return null;
  if (!isIsoDate(value)) throw new AppError("validation", `${label} must be a calendar date (YYYY-MM-DD).`);
  return value;
}

function assertConsent(input: PersonWrite): { phone: string; email: string } {
  if (input.consentStatus === "withdrawn" || input.consentStatus === "not_given") {
    return { phone: "", email: "" };
  }
  const phone = (input.phone ?? "").trim();
  const email = (input.email ?? "").trim();
  const privateDetails = Boolean(phone || email);
  if (privateDetails && input.consentStatus !== "given") {
    throw new AppError(
      "consent_required",
      "Recorded consent is required before storing a phone number or email address."
    );
  }
  if (input.consentStatus === "given") {
    if (!requireDate(input.consentDate ?? null, "Consent date")) {
      throw new AppError("validation", "Consent date is required when consent is given.");
    }
    if (!(input.consentSource ?? "").trim()) {
      throw new AppError("validation", "Consent source is required when consent is given.");
    }
  }
  return { phone, email };
}

export function assertWardInConstituency(db: Database.Database, wardId: string, constituencyId: string) {
  const constituency = db.prepare("SELECT id FROM assembly_constituencies WHERE id = ?").get(constituencyId);
  if (!constituency) throw new AppError("not_found", "Constituency not found.");
  const ward = getWard(db, wardId);
  const scope = resolveScope(db, constituencyId, ward.boundaryVersionId);
  if (!scope.ruralWards[wardId] && !scope.urbanWards[wardId]) {
    throw new AppError("isolation", "This ward is not in the selected constituency coverage.");
  }
  return ward;
}

function getPerson(db: Database.Database, id: string): Person {
  const row = db.prepare("SELECT * FROM persons WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Person not found.");
  return mapPerson(row);
}

export function createPerson(db: Database.Database, input: PersonWrite): Person {
  if (!input.name.trim()) throw new AppError("validation", "Name is required.");
  const details = assertConsent(input);
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO persons (id, name, name_te, phone, email, consent_status, consent_date, consent_source, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.nameTe ?? "",
    details.phone,
    details.email,
    input.consentStatus,
    requireDate(input.consentDate ?? null, "Consent date"),
    input.consentSource ?? "",
    ts,
    ts
  );
  writeAudit(db, {
    action: "create",
    entityType: "person",
    recordId: id,
    changedFields: ["name", "consentStatus"]
  });
  return getPerson(db, id);
}

export function updatePerson(db: Database.Database, input: PersonWrite & { id: string }): Person {
  getPerson(db, input.id);
  if (!input.name.trim()) throw new AppError("validation", "Name is required.");
  const details = assertConsent(input);
  db.prepare(
    `UPDATE persons SET name = ?, name_te = ?, phone = ?, email = ?, consent_status = ?, consent_date = ?, consent_source = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.name.trim(),
    input.nameTe ?? "",
    details.phone,
    details.email,
    input.consentStatus,
    requireDate(input.consentDate ?? null, "Consent date"),
    input.consentSource ?? "",
    nowIso(),
    input.id
  );
  writeAudit(db, {
    action: "update",
    entityType: "person",
    recordId: input.id,
    changedFields: ["name", "consentStatus"]
  });
  return getPerson(db, input.id);
}

export function archivePerson(db: Database.Database, id: string): void {
  getPerson(db, id);
  db.prepare("UPDATE persons SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  writeAudit(db, { action: "archive", entityType: "person", recordId: id, changedFields: ["archived"] });
}

export function listPersons(
  db: Database.Database,
  input?: { query?: string; includeArchived?: boolean }
): Person[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!input?.includeArchived) clauses.push("archived = 0");
  if (input?.query?.trim()) {
    clauses.push("(name LIKE ? OR name_te LIKE ?)");
    const q = `%${input.query.trim()}%`;
    params.push(q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (db.prepare(`SELECT * FROM persons ${where} ORDER BY name`).all(...params) as Record<string, unknown>[]).map(
    mapPerson
  );
}

function contactFromRow(db: Database.Database, row: Record<string, unknown>): WardContact {
  return mapContact(row, getPerson(db, String(row.person_id)));
}

export function listContacts(
  db: Database.Database,
  input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }
): PagedResult<WardContact> {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const clauses = ["c.ward_id = ?", "c.constituency_id = ?"];
  const params: unknown[] = [input.wardId, input.constituencyId];
  if (!input.includeArchived) clauses.push("c.archived = 0");
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    clauses.push(
      "(p.name LIKE ? OR p.name_te LIKE ? OR c.organization LIKE ? OR c.public_role LIKE ? OR c.area_served LIKE ?)"
    );
    params.push(q, q, q, q, q);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM ward_contact_links c JOIN persons p ON p.id = c.person_id ${where}`
      )
      .get(...params) as { n: number }
  ).n;
  const rows = db
    .prepare(
      `SELECT c.* FROM ward_contact_links c JOIN persons p ON p.id = c.person_id ${where}
       ORDER BY p.name LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  return { items: rows.map((row) => contactFromRow(db, row)), total, page, pageSize };
}

export function createContact(db: Database.Database, input: ContactWrite): WardContact {
  return db.transaction(() => {
    assertWardInConstituency(db, input.wardId, input.constituencyId);
    let personId = input.personId;
    if (!personId) {
      if (!input.person) throw new AppError("validation", "Select an existing person or enter a new identity.");
      personId = createPerson(db, input.person).id;
    } else {
      getPerson(db, personId);
      if (input.person) updatePerson(db, { ...input.person, id: personId });
    }
    const id = newId();
    const ts = nowIso();
    try {
      db.prepare(
        `INSERT INTO ward_contact_links (
          id, person_id, ward_id, constituency_id, organization, public_role, area_served,
          record_source, last_verified_at, coordination_notes, archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(
        id,
        personId,
        input.wardId,
        input.constituencyId,
        input.organization ?? "",
        input.publicRole ?? "",
        input.areaServed ?? "",
        input.recordSource ?? "",
        requireDate(input.lastVerifiedAt ?? null, "Last verified date"),
        input.coordinationNotes ?? "",
        ts,
        ts
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE")) {
        throw new AppError("duplicate_contact", "This person is already associated with this ward.");
      }
      throw error;
    }
    writeAudit(db, {
      action: "create",
      entityType: "ward_contact",
      recordId: id,
      changedFields: ["personId", "organization", "publicRole"]
    });
    const row = db.prepare("SELECT * FROM ward_contact_links WHERE id = ?").get(id) as Record<string, unknown>;
    return contactFromRow(db, row);
  })();
}

export function updateContact(db: Database.Database, input: ContactWrite & { id: string }): WardContact {
  return db.transaction(() => {
    const current = db.prepare("SELECT * FROM ward_contact_links WHERE id = ?").get(input.id) as
      | Record<string, unknown>
      | undefined;
    if (!current) throw new AppError("not_found", "Contact association not found.");
    assertWardInConstituency(db, String(current.ward_id), input.constituencyId);
    if (String(current.constituency_id) !== input.constituencyId || String(current.ward_id) !== input.wardId) {
      throw new AppError("isolation", "Contact does not belong to this ward and constituency.");
    }
    if (input.person) updatePerson(db, { ...input.person, id: String(current.person_id) });
    db.prepare(
      `UPDATE ward_contact_links SET organization = ?, public_role = ?, area_served = ?, record_source = ?,
        last_verified_at = ?, coordination_notes = ?, updated_at = ? WHERE id = ?`
    ).run(
      input.organization ?? "",
      input.publicRole ?? "",
      input.areaServed ?? "",
      input.recordSource ?? "",
      requireDate(input.lastVerifiedAt ?? null, "Last verified date"),
      input.coordinationNotes ?? "",
      nowIso(),
      input.id
    );
    writeAudit(db, {
      action: "update",
      entityType: "ward_contact",
      recordId: input.id,
      changedFields: ["organization", "publicRole", "areaServed", "recordSource"]
    });
    const row = db.prepare("SELECT * FROM ward_contact_links WHERE id = ?").get(input.id) as Record<string, unknown>;
    return contactFromRow(db, row);
  })();
}

export function archiveContact(db: Database.Database, id: string, constituencyId: string): void {
  const current = db.prepare("SELECT * FROM ward_contact_links WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Contact association not found.");
  assertWardInConstituency(db, String(current.ward_id), constituencyId);
  db.prepare("UPDATE ward_contact_links SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
  writeAudit(db, { action: "archive", entityType: "ward_contact", recordId: id, changedFields: ["archived"] });
}

function assignmentFromRow(db: Database.Database, row: Record<string, unknown>): TeamAssignment {
  return mapAssignment(row, getPerson(db, String(row.person_id)));
}

export function listAssignments(
  db: Database.Database,
  input: { wardId: string; constituencyId: string; includeInactive?: boolean }
): TeamAssignment[] {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const clauses = ["ward_id = ?", "constituency_id = ?"];
  const params: unknown[] = [input.wardId, input.constituencyId];
  if (!input.includeInactive) clauses.push("status = 'active'");
  return (
    db
      .prepare(`SELECT * FROM team_assignments WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`)
      .all(...params) as Record<string, unknown>[]
  ).map((row) => assignmentFromRow(db, row));
}

export function createAssignment(db: Database.Database, input: AssignmentWrite): TeamAssignment {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const person = getPerson(db, input.personId);
  if (person.archived) throw new AppError("validation", "Archived people cannot receive new ward assignments.");
  if (!input.operationalRole.trim()) throw new AppError("validation", "Operational role is required.");
  const start = requireDate(input.startDate ?? null, "Start date");
  const end = requireDate(input.endDate ?? null, "End date");
  if (start && end && end < start) throw new AppError("validation", "Assignment end date cannot be before the start date.");
  const status = input.status ?? (end && end < localDateString() ? "inactive" : "active");
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO team_assignments (
      id, person_id, ward_id, constituency_id, operational_role, responsibilities, start_date, end_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.personId,
    input.wardId,
    input.constituencyId,
    input.operationalRole.trim(),
    input.responsibilities ?? "",
    start,
    end,
    status,
    ts,
    ts
  );
  writeAudit(db, {
    action: "create",
    entityType: "team_assignment",
    recordId: id,
    changedFields: ["personId", "operationalRole", "status"]
  });
  return assignmentFromRow(db, db.prepare("SELECT * FROM team_assignments WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateAssignment(db: Database.Database, input: AssignmentWrite & { id: string }): TeamAssignment {
  const current = db.prepare("SELECT * FROM team_assignments WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!current) throw new AppError("not_found", "Assignment not found.");
  assertWardInConstituency(db, String(current.ward_id), input.constituencyId);
  if (String(current.ward_id) !== input.wardId || String(current.constituency_id) !== input.constituencyId) {
    throw new AppError("isolation", "Assignment does not belong to this ward and constituency.");
  }
  getPerson(db, input.personId);
  const start = requireDate(input.startDate ?? null, "Start date");
  const end = requireDate(input.endDate ?? null, "End date");
  if (start && end && end < start) throw new AppError("validation", "Assignment end date cannot be before the start date.");
  const status = input.status ?? String(current.status);
  db.prepare(
    `UPDATE team_assignments SET operational_role = ?, responsibilities = ?, start_date = ?, end_date = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.operationalRole.trim(),
    input.responsibilities ?? "",
    start,
    end,
    status,
    nowIso(),
    input.id
  );
  writeAudit(db, {
    action: "update",
    entityType: "team_assignment",
    recordId: input.id,
    changedFields: ["operationalRole", "status", "endDate"]
  });
  return assignmentFromRow(db, db.prepare("SELECT * FROM team_assignments WHERE id = ?").get(input.id) as Record<string, unknown>);
}

function nextIssueReference(db: Database.Database): string {
  const year = new Date().getFullYear();
  const prefix = `ISS-${year}-`;
  const row = db
    .prepare("SELECT reference_number AS n FROM issues WHERE reference_number LIKE ? ORDER BY reference_number DESC LIMIT 1")
    .get(`${prefix}%`) as { n: string } | undefined;
  const last = row?.n ? Number(row.n.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

function assertPersonOnWardTeam(db: Database.Database, personId: string, wardId: string, requireActive: boolean): TeamAssignment[] {
  const rows = db
    .prepare("SELECT * FROM team_assignments WHERE person_id = ? AND ward_id = ?")
    .all(personId, wardId) as Record<string, unknown>[];
  if (rows.length === 0) {
    throw new AppError("invalid_parent", "The selected person does not have a team assignment on this ward.");
  }
  if (requireActive && !rows.some((row) => String(row.status) === "active")) {
    throw new AppError("inactive_assignee", "This team member is inactive on this ward.");
  }
  return rows.map((row) => assignmentFromRow(db, row));
}

export function listIssues(
  db: Database.Database,
  input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    category?: string;
    status?: IssueStatus | "";
    priority?: IssuePriority | "";
    responsiblePersonId?: string | "";
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }
): PagedResult<Issue> {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const clauses = ["ward_id = ?", "constituency_id = ?"];
  const params: unknown[] = [input.wardId, input.constituencyId];
  if (!input.includeArchived) clauses.push("archived = 0");
  if (input.category) {
    clauses.push("category = ?");
    params.push(input.category);
  }
  if (input.status) {
    clauses.push("status = ?");
    params.push(input.status);
  }
  if (input.priority) {
    clauses.push("priority = ?");
    params.push(input.priority);
  }
  if (input.responsiblePersonId) {
    clauses.push("responsible_person_id = ?");
    params.push(input.responsiblePersonId);
  }
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    clauses.push("(title LIKE ? OR reference_number LIKE ? OR location LIKE ? OR description LIKE ?)");
    params.push(q, q, q, q);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM issues ${where}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT * FROM issues ${where} ORDER BY reported_at DESC, created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  return { items: rows.map(mapIssue), total, page, pageSize };
}

export function getIssue(
  db: Database.Database,
  id: string,
  constituencyId: string
): { issue: Issue; history: IssueStatusHistory[] } {
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) throw new AppError("not_found", "Issue not found.");
  assertWardInConstituency(db, String(row.ward_id), constituencyId);
  if (String(row.constituency_id) !== constituencyId) {
    throw new AppError("isolation", "Issue does not belong to this constituency.");
  }
  const history = (
    db.prepare("SELECT * FROM issue_status_history WHERE issue_id = ? ORDER BY changed_at").all(id) as Record<
      string,
      unknown
    >[]
  ).map(mapIssueHistory);
  return { issue: mapIssue(row), history };
}

function insertIssueHistory(db: Database.Database, issueId: string, status: IssueStatus, note: string): void {
  db.prepare(
    "INSERT INTO issue_status_history (id, issue_id, status, note, changed_at) VALUES (?, ?, ?, ?, ?)"
  ).run(newId(), issueId, status, note, nowIso());
}

export function createIssue(db: Database.Database, input: IssueWrite): Issue {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  if (!input.title.trim()) throw new AppError("validation", "Issue title is required.");
  const reportedAt = requireDate(input.reportedAt, "Reported date");
  if (!reportedAt) throw new AppError("validation", "Reported date is required.");
  const dueDate = requireDate(input.dueDate ?? null, "Due date");
  if (dueDate && dueDate < reportedAt) throw new AppError("validation", "Due date cannot be before the reported date.");
  const status = input.status ?? "open";
  if ((status === "resolved" || status === "closed") && !(input.resolutionNotes ?? "").trim()) {
    throw new AppError("validation", "Resolution notes are required to resolve or close an issue.");
  }
  if (input.responsiblePersonId) {
    assertPersonOnWardTeam(db, input.responsiblePersonId, input.wardId, false);
  }
  const id = newId();
  const ts = nowIso();
  const reference = nextIssueReference(db);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO issues (
        id, ward_id, constituency_id, reference_number, title, category, location, description, reported_at,
        responsible_person_id, priority, due_date, status, resolution_notes, complainant_name, archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id,
      input.wardId,
      input.constituencyId,
      reference,
      input.title.trim(),
      input.category,
      input.location ?? "",
      input.description ?? "",
      reportedAt,
      input.responsiblePersonId ?? null,
      input.priority,
      dueDate,
      status,
      input.resolutionNotes ?? "",
      input.complainantName ?? "",
      ts,
      ts
    );
    insertIssueHistory(db, id, status, "Created");
    writeAudit(db, {
      action: "create",
      entityType: "issue",
      recordId: id,
      changedFields: ["title", "category", "status", "priority"]
    });
  })();
  return mapIssue(db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateIssue(db: Database.Database, input: IssueWrite & { id: string }): Issue {
  const currentRow = db.prepare("SELECT * FROM issues WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!currentRow) throw new AppError("not_found", "Issue not found.");
  const current = mapIssue(currentRow);
  assertWardInConstituency(db, current.wardId, input.constituencyId);
  if (current.constituencyId !== input.constituencyId || current.wardId !== input.wardId) {
    throw new AppError("isolation", "Issue does not belong to this ward and constituency.");
  }
  const nextStatus = input.status ?? current.status;
  if (nextStatus !== current.status) {
    if (current.status === "closed") throw new AppError("invalid_status", "Closed issues cannot change status.");
    if (!ISSUE_TRANSITIONS[current.status].includes(nextStatus)) {
      throw new AppError("invalid_status", `Cannot change issue status from ${current.status} to ${nextStatus}.`);
    }
  }
  if ((nextStatus === "resolved" || nextStatus === "closed") && !(input.resolutionNotes ?? current.resolutionNotes).trim()) {
    throw new AppError("validation", "Resolution notes are required to resolve or close an issue.");
  }
  const reportedAt = requireDate(input.reportedAt, "Reported date") ?? current.reportedAt;
  const dueDate = requireDate(input.dueDate ?? null, "Due date");
  if (dueDate && dueDate < reportedAt) throw new AppError("validation", "Due date cannot be before the reported date.");
  if (input.responsiblePersonId) {
    assertPersonOnWardTeam(db, input.responsiblePersonId, current.wardId, false);
  }
  db.transaction(() => {
    db.prepare(
      `UPDATE issues SET title = ?, category = ?, location = ?, description = ?, reported_at = ?, responsible_person_id = ?,
        priority = ?, due_date = ?, status = ?, resolution_notes = ?, complainant_name = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.title.trim(),
      input.category,
      input.location ?? "",
      input.description ?? "",
      reportedAt,
      input.responsiblePersonId ?? null,
      input.priority,
      dueDate,
      nextStatus,
      input.resolutionNotes ?? "",
      input.complainantName ?? "",
      nowIso(),
      input.id
    );
    if (nextStatus !== current.status) {
      insertIssueHistory(db, input.id, nextStatus, input.resolutionNotes ?? "");
    }
    writeAudit(db, {
      action: "update",
      entityType: "issue",
      recordId: input.id,
      changedFields: ["title", "status", "priority", "category"]
    });
  })();
  return mapIssue(db.prepare("SELECT * FROM issues WHERE id = ?").get(input.id) as Record<string, unknown>);
}

export function listTasks(
  db: Database.Database,
  input: {
    wardId: string;
    constituencyId: string;
    query?: string;
    status?: TaskStatus | "";
    assignedPersonId?: string | "";
    filter?: "overdue" | "upcoming" | "completed" | "open" | "";
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
  }
): PagedResult<TaskItem> {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? PAGE_SIZE;
  const clauses = ["ward_id = ?", "constituency_id = ?"];
  const params: unknown[] = [input.wardId, input.constituencyId];
  if (!input.includeArchived) clauses.push("archived = 0");
  if (input.status) {
    clauses.push("status = ?");
    params.push(input.status);
  }
  if (input.assignedPersonId) {
    clauses.push("assigned_person_id = ?");
    params.push(input.assignedPersonId);
  }
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    clauses.push("(title LIKE ? OR description LIKE ?)");
    params.push(q, q);
  }
  const today = localDateString();
  const week = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDateString(d);
  })();
  if (input.filter === "completed") clauses.push("status = 'done'");
  if (input.filter === "open") clauses.push("status IN ('open','in_progress')");
  if (input.filter === "overdue") {
    clauses.push("status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date < ?");
    params.push(today);
  }
  if (input.filter === "upcoming") {
    clauses.push("status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?");
    params.push(today, week);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM tasks ${where}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY due_date IS NULL, due_date, created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  return { items: rows.map(mapTask), total, page, pageSize };
}

export function createTask(db: Database.Database, input: TaskWrite): { task: TaskItem; warning: string | null } {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  if (!input.title.trim()) throw new AppError("validation", "Task title is required.");
  const dueDate = requireDate(input.dueDate ?? null, "Due date");
  const status = input.status ?? "open";
  let warning: string | null = null;
  if (input.assignedPersonId) {
    const assignments = assertPersonOnWardTeam(db, input.assignedPersonId, input.wardId, false);
    const active = assignments.some((item) => item.status === "active");
    if (!active) {
      if (!input.allowInactiveAssignee) {
        throw new AppError(
          "inactive_assignee",
          "This team member is inactive on this ward. Confirm if you still want to assign the task."
        );
      }
      warning = "Assigned to an inactive team member.";
    }
  }
  if (input.relatedIssueId) {
    const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(input.relatedIssueId) as Record<string, unknown> | undefined;
    if (!issue) throw new AppError("not_found", "Related issue not found.");
    if (String(issue.ward_id) !== input.wardId || String(issue.constituency_id) !== input.constituencyId) {
      throw new AppError("isolation", "A task can only link to an issue in the same ward.");
    }
  }
  if (status === "done" && !requireDate(input.completedAt ?? localDateString(), "Completion date")) {
    throw new AppError("validation", "Completion date is required when a task is completed.");
  }
  const id = newId();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO tasks (
      id, ward_id, constituency_id, title, assigned_person_id, related_issue_id, due_date, status, description,
      completed_at, completion_notes, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    input.wardId,
    input.constituencyId,
    input.title.trim(),
    input.assignedPersonId ?? null,
    input.relatedIssueId ?? null,
    dueDate,
    status,
    input.description ?? "",
    status === "done" ? requireDate(input.completedAt ?? localDateString(), "Completion date") : null,
    input.completionNotes ?? "",
    ts,
    ts
  );
  writeAudit(db, {
    action: "create",
    entityType: "task",
    recordId: id,
    changedFields: ["title", "status", "assignedPersonId"]
  });
  const task = mapTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown>);
  return { task, warning };
}

export function updateTask(
  db: Database.Database,
  input: TaskWrite & { id: string }
): { task: TaskItem; warning: string | null } {
  const currentRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(input.id) as Record<string, unknown> | undefined;
  if (!currentRow) throw new AppError("not_found", "Task not found.");
  const current = mapTask(currentRow);
  assertWardInConstituency(db, current.wardId, input.constituencyId);
  if (current.wardId !== input.wardId || current.constituencyId !== input.constituencyId) {
    throw new AppError("isolation", "Task does not belong to this ward and constituency.");
  }
  const status = input.status ?? current.status;
  let warning: string | null = null;
  if (input.assignedPersonId) {
    const assignments = assertPersonOnWardTeam(db, input.assignedPersonId, current.wardId, false);
    const active = assignments.some((item) => item.status === "active");
    if (!active) {
      if (!input.allowInactiveAssignee) {
        throw new AppError(
          "inactive_assignee",
          "This team member is inactive on this ward. Confirm if you still want to assign the task."
        );
      }
      warning = "Assigned to an inactive team member.";
    }
  }
  if (input.relatedIssueId) {
    const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(input.relatedIssueId) as Record<string, unknown> | undefined;
    if (!issue) throw new AppError("not_found", "Related issue not found.");
    if (String(issue.ward_id) !== current.wardId) {
      throw new AppError("isolation", "A task can only link to an issue in the same ward.");
    }
  }
  const dueDate = requireDate(input.dueDate ?? null, "Due date");
  const completedAt =
    status === "done" ? requireDate(input.completedAt ?? localDateString(), "Completion date") : status === "cancelled" ? current.completedAt : null;
  db.prepare(
    `UPDATE tasks SET title = ?, assigned_person_id = ?, related_issue_id = ?, due_date = ?, status = ?, description = ?,
      completed_at = ?, completion_notes = ?, updated_at = ? WHERE id = ?`
  ).run(
    input.title.trim(),
    input.assignedPersonId ?? null,
    input.relatedIssueId ?? null,
    dueDate,
    status,
    input.description ?? "",
    completedAt,
    input.completionNotes ?? "",
    nowIso(),
    input.id
  );
  writeAudit(db, {
    action: "update",
    entityType: "task",
    recordId: input.id,
    changedFields: ["title", "status", "assignedPersonId"]
  });
  return {
    task: mapTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(input.id) as Record<string, unknown>),
    warning
  };
}

export function wardOverview(
  db: Database.Database,
  input: { wardId: string; constituencyId: string }
): WardOverview {
  assertWardInConstituency(db, input.wardId, input.constituencyId);
  const { wardId, constituencyId } = input;
  const activeContacts = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM ward_contact_links WHERE ward_id = ? AND constituency_id = ? AND archived = 0"
      )
      .get(wardId, constituencyId) as { n: number }
  ).n;
  const activeTeamAssignments = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM team_assignments WHERE ward_id = ? AND constituency_id = ? AND status = 'active'"
      )
      .get(wardId, constituencyId) as { n: number }
  ).n;
  const unresolvedIssues = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM issues WHERE ward_id = ? AND constituency_id = ? AND archived = 0 AND status IN ('open','in_progress')"
      )
      .get(wardId, constituencyId) as { n: number }
  ).n;
  const openTasks = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM tasks WHERE ward_id = ? AND constituency_id = ? AND archived = 0 AND status IN ('open','in_progress')"
      )
      .get(wardId, constituencyId) as { n: number }
  ).n;
  const today = localDateString();
  const overdueTasks = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tasks
         WHERE ward_id = ? AND constituency_id = ? AND archived = 0 AND status IN ('open','in_progress')
           AND due_date IS NOT NULL AND due_date < ?`
      )
      .get(wardId, constituencyId, today) as { n: number }
  ).n;

  const recent: ActivityItem[] = [];
  const contacts = db
    .prepare(
      `SELECT c.id, c.updated_at, p.name FROM ward_contact_links c JOIN persons p ON p.id = c.person_id
       WHERE c.ward_id = ? AND c.constituency_id = ? ORDER BY c.updated_at DESC LIMIT 5`
    )
    .all(wardId, constituencyId) as Array<{ id: string; updated_at: string; name: string }>;
  for (const row of contacts) {
    recent.push({ at: row.updated_at, kind: "contact", summary: `Contact ${row.name}`, recordId: row.id });
  }
  const team = db
    .prepare(
      `SELECT a.id, a.updated_at, p.name FROM team_assignments a JOIN persons p ON p.id = a.person_id
       WHERE a.ward_id = ? AND a.constituency_id = ? ORDER BY a.updated_at DESC LIMIT 5`
    )
    .all(wardId, constituencyId) as Array<{ id: string; updated_at: string; name: string }>;
  for (const row of team) {
    recent.push({ at: row.updated_at, kind: "team", summary: `Team ${row.name}`, recordId: row.id });
  }
  const issues = db
    .prepare(
      "SELECT id, updated_at, title, reference_number FROM issues WHERE ward_id = ? AND constituency_id = ? ORDER BY updated_at DESC LIMIT 5"
    )
    .all(wardId, constituencyId) as Array<{ id: string; updated_at: string; title: string; reference_number: string }>;
  for (const row of issues) {
    recent.push({
      at: row.updated_at,
      kind: "issue",
      summary: `${row.reference_number} ${row.title}`,
      recordId: row.id
    });
  }
  const tasks = db
    .prepare("SELECT id, updated_at, title, status, due_date FROM tasks WHERE ward_id = ? AND constituency_id = ? ORDER BY updated_at DESC LIMIT 5")
    .all(wardId, constituencyId) as Array<{ id: string; updated_at: string; title: string; status: string; due_date: string | null }>;
  for (const row of tasks) {
    const overdueMark = isOverdue(row.due_date, row.status) ? " (overdue)" : "";
    recent.push({ at: row.updated_at, kind: "task", summary: `${row.title}${overdueMark}`, recordId: row.id });
  }
  recent.sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    activeContacts,
    activeTeamAssignments,
    unresolvedIssues,
    openTasks,
    overdueTasks,
    recentActivity: recent.slice(0, 8)
  };
}
