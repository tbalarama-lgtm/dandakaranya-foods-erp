import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { CONSENT_STATUSES, SCHEMA_VERSION } from "../src/shared/constants";
import { localDateString } from "../src/shared/dates";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { applyMigrations, MIGRATIONS } from "../src/main/db/schema";
import { resolveDataPaths } from "../src/main/db/paths";
import { nowIso } from "../src/main/db/ids";
import { createBackup, restoreBackup } from "../src/main/services/backup";
import { setCoverage } from "../src/main/services/coverage";
import {
  createBoundary,
  createConstituency,
  createGp,
  createMandal,
  createUlb,
  createVillage
} from "../src/main/services/geo";
import { dashboardAttention } from "../src/main/services/dashboard";
import { loadDemoData } from "../src/main/services/demo";
import { createWard, listWards } from "../src/main/services/wards";
import { listVoters } from "../src/main/services/voters";
import {
  archiveContact,
  archivePerson,
  createAssignment,
  createContact,
  createIssue,
  createPerson,
  createTask,
  listAssignments,
  listContacts,
  listIssues,
  listTasks,
  getIssue,
  updateAssignment,
  updateIssue,
  updatePerson,
  updateTask,
  wardOverview
} from "../src/main/services/workspace";
import { AppError } from "../src/main/errors";

function seed(db: ReturnType<typeof openMemory>) {
  const version = createBoundary(db, { name: "v1", effectiveFrom: "2026-01-01", status: "active" });
  const constituency = createConstituency(db, { name: "Seat A" });
  const other = createConstituency(db, { name: "Seat B" });
  const mandal = createMandal(db, { name: "Mandal One" });
  const gp = createGp(db, { mandalId: mandal.id, name: "GP East" });
  createVillage(db, { gramPanchayatId: gp.id, name: "Village A" });
  const ulb = createUlb(db, { bodyType: "municipality", name: "Town" });
  const rural = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Rural 1"
  });
  const rural2 = createWard(db, {
    classification: "rural",
    gramPanchayatId: gp.id,
    boundaryVersionId: version.id,
    wardNumber: "2",
    name: "Rural 2"
  });
  const urban = createWard(db, {
    classification: "urban",
    urbanLocalBodyId: ulb.id,
    boundaryVersionId: version.id,
    wardNumber: "1",
    name: "Urban 1"
  });
  setCoverage(db, {
    constituencyId: constituency.id,
    boundaryVersionId: version.id,
    unitType: "gram_panchayat",
    unitId: gp.id,
    coverageKind: "complete"
  });
  setCoverage(db, {
    constituencyId: other.id,
    boundaryVersionId: version.id,
    unitType: "urban_local_body",
    unitId: ulb.id,
    coverageKind: "complete"
  });
  return { version, constituency, other, gp, rural, rural2, urban };
}

describe("Phase 2 ward workspace", () => {
  it("shares one person identity across wards without duplicating the person", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, {
      name: "Lakshmi",
      nameTe: "లక్ష్మి",
      consentStatus: "given",
      consentDate: "2026-01-02",
      consentSource: "in-person",
      phone: "9999999999"
    });
    createContact(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      organization: "GP office",
      publicRole: "Sarpanch"
    });
    createContact(db, {
      personId: person.id,
      wardId: geo.rural2.id,
      constituencyId: geo.constituency.id,
      organization: "School",
      publicRole: "HM"
    });
    const count = (db.prepare("SELECT COUNT(*) AS n FROM persons").get() as { n: number }).n;
    expect(count).toBe(1);
    expect(listContacts(db, { wardId: geo.rural.id, constituencyId: geo.constituency.id }).total).toBe(1);
    expect(listContacts(db, { wardId: geo.rural2.id, constituencyId: geo.constituency.id }).items[0]?.person.id).toBe(
      person.id
    );
  });

  it("isolates contacts, issues and tasks by constituency coverage", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, { name: "Ravi", consentStatus: "unknown" });
    expect(() =>
      createContact(db, {
        personId: person.id,
        wardId: geo.urban.id,
        constituencyId: geo.constituency.id,
        publicRole: "Councillor"
      })
    ).toThrow(/not in the selected constituency/);
    createContact(db, {
      personId: person.id,
      wardId: geo.urban.id,
      constituencyId: geo.other.id,
      publicRole: "Councillor"
    });
    expect(listContacts(db, { wardId: geo.urban.id, constituencyId: geo.other.id }).total).toBe(1);
    expect(() => listContacts(db, { wardId: geo.urban.id, constituencyId: geo.constituency.id })).toThrow(/not in the selected constituency/);
  });

  it("requires recorded consent before storing phone or email", () => {
    const db = openMemory();
    expect(CONSENT_STATUSES).toContain("given");
    expect(() =>
      createPerson(db, { name: "No Consent", consentStatus: "unknown", phone: "111" })
    ).toThrow(/consent/i);
    expect(() =>
      createPerson(db, { name: "Given but incomplete", consentStatus: "given", phone: "111" })
    ).toThrow(/Consent date/);
    const person = createPerson(db, { name: "Public only", consentStatus: "unknown" });
    expect(person.phone).toBe("");
    const updated = updatePerson(db, {
      id: person.id,
      name: "Public only",
      consentStatus: "withdrawn",
      phone: "should-clear",
      email: "x@y.z"
    });
    expect(updated.phone).toBe("");
    expect(updated.email).toBe("");
  });

  it("archives a ward association without deleting the person or other assignments", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, { name: "Team Lead", consentStatus: "unknown" });
    const contact = createContact(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      publicRole: "Volunteer"
    });
    const assignment = createAssignment(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "ward_coordinator",
      startDate: "2026-01-01"
    });
    archiveContact(db, contact.id, geo.constituency.id);
    expect(listContacts(db, { wardId: geo.rural.id, constituencyId: geo.constituency.id }).total).toBe(0);
    expect(listContacts(db, { wardId: geo.rural.id, constituencyId: geo.constituency.id, includeArchived: true }).total).toBe(1);
    updateAssignment(db, {
      id: assignment.id,
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "ward_coordinator",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      status: "inactive"
    });
    const history = listAssignments(db, { wardId: geo.rural.id, constituencyId: geo.constituency.id, includeInactive: true });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("inactive");
    expect(db.prepare("SELECT archived FROM persons WHERE id = ?").get(person.id)).toEqual({ archived: 0 });
    archivePerson(db, person.id);
    expect(() =>
      createAssignment(db, {
        personId: person.id,
        wardId: geo.rural2.id,
        constituencyId: geo.constituency.id,
        operationalRole: "field_volunteer"
      })
    ).toThrow(/Archived people/);
  });

  it("records issue status history and rejects illegal transitions", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, { name: "Follow up", consentStatus: "unknown" });
    createAssignment(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "issue_follow_up"
    });
    const issue = createIssue(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Pipe leak",
      category: "water",
      reportedAt: "2026-03-01",
      priority: "high",
      responsiblePersonId: person.id
    });
    expect(issue.referenceNumber).toMatch(/^ISS-\d{4}-\d{4}$/);
    const progressed = updateIssue(db, {
      id: issue.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Pipe leak",
      category: "water",
      reportedAt: "2026-03-01",
      priority: "high",
      status: "in_progress",
      responsiblePersonId: person.id
    });
    expect(progressed.status).toBe("in_progress");
    expect(() =>
      updateIssue(db, {
        id: issue.id,
        wardId: geo.rural.id,
        constituencyId: geo.constituency.id,
        title: "Pipe leak",
        category: "water",
        reportedAt: "2026-03-01",
        priority: "high",
        status: "resolved"
      })
    ).toThrow(/Resolution notes/);
    updateIssue(db, {
      id: issue.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Pipe leak",
      category: "water",
      reportedAt: "2026-03-01",
      priority: "high",
      status: "resolved",
      resolutionNotes: "Repaired"
    });
    updateIssue(db, {
      id: issue.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Pipe leak",
      category: "water",
      reportedAt: "2026-03-01",
      priority: "high",
      status: "closed",
      resolutionNotes: "Repaired"
    });
    expect(() =>
      updateIssue(db, {
        id: issue.id,
        wardId: geo.rural.id,
        constituencyId: geo.constituency.id,
        title: "Pipe leak",
        category: "water",
        reportedAt: "2026-03-01",
        priority: "high",
        status: "open",
        resolutionNotes: "Repaired"
      })
    ).toThrow(/Closed issues/);
    const detail = getIssue(db, issue.id, geo.constituency.id);
    expect(detail.history.map((h) => h.status)).toEqual(["open", "in_progress", "resolved", "closed"]);
  });

  it("validates task ward relationships and overdue using the local calendar date", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, { name: "Volunteer", consentStatus: "unknown" });
    createAssignment(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "field_volunteer"
    });
    const issue = createIssue(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Street light",
      category: "electricity",
      reportedAt: "2026-03-01",
      priority: "medium"
    });
    const otherIssue = createIssue(db, {
      wardId: geo.rural2.id,
      constituencyId: geo.constituency.id,
      title: "Other ward",
      category: "roads",
      reportedAt: "2026-03-01",
      priority: "low"
    });
    expect(() =>
      createTask(db, {
        wardId: geo.rural.id,
        constituencyId: geo.constituency.id,
        title: "Wrong issue",
        relatedIssueId: otherIssue.id
      })
    ).toThrow(/same ward/);
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return localDateString(d);
    })();
    const created = createTask(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Inspect pole",
      assignedPersonId: person.id,
      relatedIssueId: issue.id,
      dueDate: yesterday
    });
    expect(created.task.overdue).toBe(true);
    const completed = updateTask(db, {
      id: created.task.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Inspect pole",
      assignedPersonId: person.id,
      relatedIssueId: issue.id,
      dueDate: yesterday,
      status: "done",
      completionNotes: "Fixed"
    });
    expect(completed.task.status).toBe("done");
    expect(completed.task.overdue).toBe(false);
    expect(completed.task.completedAt).toBe(localDateString());
    const overview = wardOverview(db, { wardId: geo.rural.id, constituencyId: geo.constituency.id });
    expect(overview.openTasks).toBe(0);
    expect(overview.unresolvedIssues).toBe(1);
  });

  it("warns when assigning a task to an inactive team member", () => {
    const db = openMemory();
    const geo = seed(db);
    const person = createPerson(db, { name: "Past volunteer", consentStatus: "unknown" });
    const assignment = createAssignment(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "field_volunteer",
      startDate: "2026-01-01"
    });
    updateAssignment(db, {
      id: assignment.id,
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "field_volunteer",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      status: "inactive"
    });
    expect(() =>
      createTask(db, {
        wardId: geo.rural.id,
        constituencyId: geo.constituency.id,
        title: "Old assignee",
        assignedPersonId: person.id
      })
    ).toThrow(/inactive/);
    const allowed = createTask(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Old assignee",
      assignedPersonId: person.id,
      allowInactiveAssignee: true
    });
    expect(allowed.warning).toMatch(/inactive/i);
  });
});

describe("Phase 2 migration, persistence and backup", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("migrates legacy ward_contacts into person links without resetting data", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    const v1 = MIGRATIONS.find((m) => m.version === 1);
    const v2 = MIGRATIONS.find((m) => m.version === 2);
    if (!v1 || !v2) throw new Error("missing migrations");
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    db.exec(v1.sql);
    db.exec(v2.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?), (2, ?)").run(nowIso(), nowIso());
    const ts = nowIso();
    db.prepare(
      `INSERT INTO boundary_versions (id, name, effective_from, notes, status, created_at) VALUES ('b1','v','2026-01-01','','active',?)`
    ).run(ts);
    db.prepare(
      `INSERT INTO assembly_constituencies (id, name, name_te, notes, archived, is_demo, created_at, updated_at)
       VALUES ('c1','Seat','','',0,0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO mandals (id, name, name_te, notes, archived, is_demo, created_at, updated_at)
       VALUES ('m1','M','','',0,0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO gram_panchayats (id, mandal_id, name, name_te, notes, archived, is_demo, created_at, updated_at)
       VALUES ('g1','m1','GP','','',0,0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO wards (
        id, classification, gram_panchayat_id, urban_local_body_id, boundary_version_id, ward_number, name, name_te,
        record_source, notes, archived, is_demo, created_at, updated_at
      ) VALUES ('w1','rural','g1',NULL,'b1','1','Ward','','','',0,0,?,?)`
    ).run(ts, ts);
    db.prepare(
      `INSERT INTO ward_contacts (
        id, ward_id, constituency_id, name, name_te, organization, public_role, area_served, phone, email,
        consent_status, consent_date, consent_source, record_source, last_verified_at, coordination_notes, archived, created_at, updated_at
      ) VALUES ('k1','w1','c1','Legacy Person','','Org','Role','Area','555','a@b.c','given','2026-01-01','paper','staff',NULL,'',0,?,?)`
    ).run(ts, ts);
    applyMigrations(db);
    const version = (db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v;
    expect(version).toBe(SCHEMA_VERSION);
    const person = db.prepare("SELECT name, phone FROM persons").get() as { name: string; phone: string };
    expect(person.name).toBe("Legacy Person");
    expect(person.phone).toBe("555");
    const link = db.prepare("SELECT person_id, organization FROM ward_contact_links WHERE id = 'k1'").get() as {
      person_id: string;
      organization: string;
    };
    expect(link.organization).toBe("Org");
    expect(link.person_id).toBeTruthy();
    const geoStillThere = db.prepare("SELECT name FROM wards WHERE id = 'w1'").get() as { name: string };
    expect(geoStillThere.name).toBe("Ward");
  });

  it("persists workspace records after reopen and round-trips them in backup/restore", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-p2-"));
    dirs.push(dir);
    const manager = new DatabaseManager(resolveDataPaths(dir));
    const db = manager.open();
    const geo = seed(db);
    const person = createPerson(db, {
      name: "Backup Person",
      consentStatus: "given",
      consentDate: "2026-01-01",
      consentSource: "form",
      phone: "123"
    });
    createContact(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      organization: "Clinic"
    });
    createAssignment(db, {
      personId: person.id,
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      operationalRole: "data_volunteer"
    });
    createIssue(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Drain",
      category: "sanitation",
      reportedAt: "2026-04-01",
      priority: "urgent"
    });
    createTask(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Site visit",
      assignedPersonId: person.id,
      dueDate: "2026-04-02"
    });
    manager.close();
    const reopened = manager.open();
    expect(listContacts(reopened, { wardId: geo.rural.id, constituencyId: geo.constituency.id }).total).toBe(1);
    expect(listIssues(reopened, { wardId: geo.rural.id, constituencyId: geo.constituency.id }).items[0]?.title).toBe("Drain");
    const dest = path.join(dir, "ws.winwinbak");
    const backup = await createBackup(manager, dest);
    createPerson(manager.get(), { name: "After backup", consentStatus: "unknown" });
    await restoreBackup(manager, backup.path, { skipConfirm: true });
    const names = manager
      .get()
      .prepare("SELECT name FROM persons ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(names.map((n) => n.name)).toEqual(["Backup Person"]);
    expect(listTasks(manager.get(), { wardId: geo.rural.id, constituencyId: geo.constituency.id }).total).toBe(1);
    const audit = manager.get().prepare("SELECT changed_fields FROM audit_log WHERE entity_type = 'person'").all() as Array<{
      changed_fields: string;
    }>;
    expect(audit.some((row) => row.changed_fields.includes("phone"))).toBe(false);
    manager.close();
  });
});

describe("Demonstration seed", () => {
  it("loads labelled workspace, voters and does not store phone numbers", () => {
    const db = openMemory();
    loadDemoData(db);
    const constituency = db.prepare("SELECT id FROM assembly_constituencies LIMIT 1").get() as { id: string };
    const boundary = db.prepare("SELECT id FROM boundary_versions LIMIT 1").get() as { id: string };
    const rural = listWards(db, {
      constituencyId: constituency.id,
      boundaryVersionId: boundary.id,
      classification: "rural",
      pageSize: 10
    }).items.find((item) => item.wardNumber === "1")!;
    const contacts = listContacts(db, { wardId: rural.id, constituencyId: constituency.id, pageSize: 10 });
    expect(contacts.total).toBeGreaterThanOrEqual(2);
    expect(contacts.items.every((item) => item.person.phone === "")).toBe(true);
    expect(contacts.items.every((item) => item.organization.includes("[DEMO]"))).toBe(true);
    const team = listAssignments(db, { wardId: rural.id, constituencyId: constituency.id, includeInactive: true });
    expect(team.some((row) => row.status === "active")).toBe(true);
    expect(team.some((row) => row.status === "inactive")).toBe(true);
    const issues = listIssues(db, { wardId: rural.id, constituencyId: constituency.id, pageSize: 10 });
    expect(issues.items.some((row) => row.status === "open")).toBe(true);
    expect(issues.items.some((row) => row.status === "resolved")).toBe(true);
    const tasks = listTasks(db, { wardId: rural.id, constituencyId: constituency.id, includeArchived: true, pageSize: 10 });
    expect(tasks.items.some((row) => row.status === "open" && row.overdue)).toBe(true);
    expect(tasks.items.some((row) => row.status === "done")).toBe(true);
    expect(tasks.items.some((row) => row.status === "open" && !row.overdue)).toBe(true);
    const voters = listVoters(db, { constituencyId: constituency.id, pageSize: 10 });
    expect(voters.items.some((row) => row.sourceName.includes("రాము") && row.assignedWardId)).toBe(true);
    expect(voters.items.some((row) => row.sourceName.includes("సీత") && !row.assignedWardId)).toBe(true);
  });

  it("scopes dashboard attention to the selected constituency", () => {
    const db = openMemory();
    const geo = seed(db);
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return localDateString(d);
    })();
    createIssue(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Drain overflow",
      category: "sanitation",
      reportedAt: "2026-03-01",
      priority: "high"
    });
    createTask(db, {
      wardId: geo.rural.id,
      constituencyId: geo.constituency.id,
      title: "Inspect drain",
      dueDate: yesterday
    });
    const attention = dashboardAttention(db, geo.constituency.id);
    expect(attention.overdueTasks).toHaveLength(1);
    expect(attention.overdueTasks[0]?.href).toBe(`/wards/${geo.rural.id}/tasks`);
    expect(attention.overdueTasks[0]?.status).toBe("open");
    expect(attention.unresolvedIssues).toHaveLength(1);
    expect(attention.unresolvedIssues[0]?.href).toBe(`/wards/${geo.rural.id}/issues`);
    expect(attention.recentActivity.some((item) => item.action && item.record && item.href)).toBe(true);
    const other = dashboardAttention(db, geo.other.id);
    expect(other.overdueTasks).toHaveLength(0);
    expect(other.unresolvedIssues).toHaveLength(0);
    expect(other.recentActivity).toHaveLength(0);
  });
});
