import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/shared/constants";
import { localDateString } from "../src/shared/dates";
import { DatabaseManager, openMemory } from "../src/main/db/connection";
import { resolveDataPaths } from "../src/main/db/paths";
import { AppError } from "../src/main/errors";
import { createBackup, restoreBackup } from "../src/main/services/backup";
import { stringifyCsv } from "../src/main/services/csv";
import {
  appointmentHistory,
  archiveOrganization,
  cancelOrgImport,
  clearOrgImportSessions,
  commitOrgImport,
  createAppointment,
  createOrganization,
  createPost,
  createUnit,
  createWing,
  exportOrgCsv,
  listAppointments,
  listCapacities,
  listOrganizations,
  listPosts,
  listUnits,
  mapOrgImport,
  openOrgImport,
  orgOverview,
  orgTemplateCsv,
  postCapacity,
  reportingTree,
  upcomingExpiry,
  updateAppointment,
  updatePost,
  updateUnit
} from "../src/main/services/org-posts";

const dirs: string[] = [];
afterEach(() => {
  clearOrgImportSessions();
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  return localDateString(dt);
}

describe("Organization posts", () => {
  it("records organization → unit → post → appointment without inventing sanctioned counts", () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "Civic Forum", sourceReference: "letter-1" });
    const wing = createWing(db, { organizationId: org.id, name: "Youth wing" });
    const parent = createUnit(db, {
      organizationId: org.id,
      name: "Assembly committee",
      unitKind: "committee",
      level: "assembly_constituency",
      wingId: wing.id,
      geo: [{ geoType: "assembly_constituency", geoId: "ac-1" }]
    });
    const child = createUnit(db, {
      organizationId: org.id,
      name: "Mandal unit",
      unitKind: "unit",
      level: "mandal",
      parentUnitId: parent.id,
      geo: [{ geoType: "mandal", geoId: "m-1" }]
    });
    const president = createPost(db, {
      organizationId: org.id,
      unitId: parent.id,
      title: "President",
      sourceReference: "org chart 2024"
    });
    const secretary = createPost(db, {
      organizationId: org.id,
      unitId: child.id,
      title: "Secretary",
      parentPostId: president.id,
      authorizedPositions: 1,
      verificationStatus: "verified",
      sourceReference: "org chart 2024"
    });
    const appt = createAppointment(db, {
      postId: secretary.id,
      officeHolderName: "Asha Rao",
      membershipReference: "member-77",
      appointmentReference: "order-9",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      consentSource: "signed form",
      verificationStatus: "verified"
    });
    expect(listUnits(db, { organizationId: org.id })).toHaveLength(2);
    expect(listPosts(db, { organizationId: org.id }).map((row) => row.title)).toEqual(["President", "Secretary"]);
    expect(reportingTree(db, org.id)[0]?.children[0]?.post.id).toBe(secretary.id);
    expect(appt.officeHolderName).toBe("Asha Rao");
    const personLinks = db.prepare("SELECT id FROM voter_entries WHERE 1=0").all();
    expect(personLinks).toEqual([]);
    const voterJoin = db
      .prepare(
        `SELECT v.id FROM voter_entries v JOIN persons p ON p.name = v.source_name WHERE p.id = ?`
      )
      .all(appt.personId);
    expect(voterJoin).toEqual([]);
    expect(postCapacity(db, secretary).occupancy).toBe("appointment_recorded");
    expect(postCapacity(db, president).occupancy).toBe("status_unknown");
  });

  it("rejects circular unit and reporting relationships", () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "Cycle Org" });
    const a = createUnit(db, { organizationId: org.id, name: "A", unitKind: "unit", level: "mandal" });
    const b = createUnit(db, {
      organizationId: org.id,
      name: "B",
      unitKind: "unit",
      level: "gram_panchayat",
      parentUnitId: a.id
    });
    expect(() =>
      updateUnit(db, {
        id: a.id,
        name: "A",
        unitKind: "unit",
        level: "mandal",
        parentUnitId: b.id
      })
    ).toThrow(/circular/);
    const p1 = createPost(db, { organizationId: org.id, unitId: a.id, title: "Lead" });
    const p2 = createPost(db, { organizationId: org.id, unitId: a.id, title: "Deputy", parentPostId: p1.id });
    expect(() =>
      updatePost(db, {
        id: p1.id,
        title: "Lead",
        unitId: a.id,
        parentPostId: p2.id
      })
    ).toThrow(/cycle/);
  });

  it("treats missing or unverified authorized counts as status unknown", () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "Vacancy Org" });
    const unit = createUnit(db, { organizationId: org.id, name: "GP unit", unitKind: "unit", level: "gram_panchayat" });
    const undocumented = createPost(db, { organizationId: org.id, unitId: unit.id, title: "Member" });
    expect(postCapacity(db, undocumented).occupancy).toBe("status_unknown");
    const unverifiedPost = createPost(db, {
      organizationId: org.id,
      unitId: unit.id,
      title: "Treasurer",
      authorizedPositions: 2,
      verificationStatus: "unverified"
    });
    expect(postCapacity(db, unverifiedPost).occupancy).toBe("status_unknown");
    const verified = createPost(db, {
      organizationId: org.id,
      unitId: unit.id,
      title: "Organizer",
      authorizedPositions: 2,
      verificationStatus: "verified"
    });
    expect(postCapacity(db, verified).occupancy).toBe("verified_vacancy");
    expect(postCapacity(db, verified).vacantPositions).toBe(2);
    createAppointment(db, {
      postId: verified.id,
      officeHolderName: "Unverified Holder",
      startDate: "2026-02-01",
      status: "active",
      verificationStatus: "unverified"
    });
    expect(postCapacity(db, verified).occupancy).toBe("status_unknown");
    createAppointment(db, {
      postId: verified.id,
      officeHolderName: "Verified Holder",
      startDate: "2026-03-01",
      endDate: "2026-04-01",
      status: "ended",
      verificationStatus: "verified"
    });
    expect(listCapacities(db, org.id).find((row) => row.postId === verified.id)?.occupancy).toBe("status_unknown");
  });

  it("preserves appointment history and overlapping covering records without merging", () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "History Org" });
    const unit = createUnit(db, { organizationId: org.id, name: "Ward unit", unitKind: "unit", level: "ward" });
    const post = createPost(db, {
      organizationId: org.id,
      unitId: unit.id,
      title: "Convener",
      authorizedPositions: 1,
      verificationStatus: "verified"
    });
    const first = createAppointment(db, {
      postId: post.id,
      officeHolderName: "First",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      status: "active",
      verificationStatus: "verified"
    });
    expect(() =>
      createAppointment(db, {
        postId: post.id,
        officeHolderName: "Second",
        startDate: "2026-05-01",
        endDate: "2026-12-31",
        status: "active"
      })
    ).toThrow(AppError);
    const second = createAppointment(db, {
      postId: post.id,
      officeHolderName: "Second",
      startDate: "2026-05-01",
      endDate: "2026-12-31",
      status: "active",
      allowOverlap: true
    });
    expect(listAppointments(db, { organizationId: org.id, coveringOnly: true })).toHaveLength(2);
    expect(first.id).not.toBe(second.id);
    updateAppointment(db, {
      id: first.id,
      startDate: first.startDate,
      endDate: "2026-04-30",
      status: "ended",
      verificationStatus: "verified"
    });
    const history = appointmentHistory(db, first.id);
    expect(history.some((row) => row.action === "create")).toBe(true);
    expect(history.some((row) => row.action === "update")).toBe(true);
    const ended = listAppointments(db, { organizationId: org.id, includeEnded: true });
    expect(ended.some((row) => row.status === "ended")).toBe(true);
  });

  it("filters upcoming tenure expiry in 30/60/90 day windows", () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "Tenure Org" });
    const unit = createUnit(db, { organizationId: org.id, name: "ULB unit", unitKind: "unit", level: "urban_local_body" });
    const post = createPost(db, { organizationId: org.id, unitId: unit.id, title: "Coordinator" });
    const today = localDateString();
    createAppointment(db, {
      postId: post.id,
      officeHolderName: "Soon",
      startDate: "2026-01-01",
      endDate: addDays(today, 10),
      status: "active"
    });
    createAppointment(db, {
      postId: post.id,
      officeHolderName: "Later",
      startDate: "2026-01-01",
      endDate: addDays(today, 45),
      status: "scheduled",
      allowOverlap: true
    });
    expect(upcomingExpiry(db, org.id, 30)).toHaveLength(1);
    expect(upcomingExpiry(db, org.id, 60)).toHaveLength(2);
    expect(upcomingExpiry(db, org.id, 90)).toHaveLength(2);
  });

  it("imports units, posts and appointments with mapping, duplicates and overlap confirmation", async () => {
    const db = openMemory();
    const org = createOrganization(db, { name: "Import Org" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-org-"));
    dirs.push(dir);
    const unitsFile = path.join(dir, "units.csv");
    fs.writeFileSync(
      unitsFile,
      stringifyCsv([
        ["name", "unit_kind", "level", "source_reference", "verification_status"],
        ["Imported committee", "committee", "mandal", "list-1", "verified"]
      ]),
      "utf8"
    );
    const unitSession = await openOrgImport(db, { organizationId: org.id, kind: "units", filePath: unitsFile });
    expect(unitSession.eligibleCount).toBe(1);
    const unitResult = commitOrgImport(db, { sessionId: unitSession.sessionId });
    expect(unitResult.imported).toBe(1);
    const unit = listUnits(db, { organizationId: org.id })[0]!;
    const postsFile = path.join(dir, "posts.csv");
    fs.writeFileSync(
      postsFile,
      stringifyCsv([
        ["unit_id", "title", "authorized_positions", "verification_status", "source_reference"],
        [unit.id, "Block secretary", "1", "verified", "list-1"],
        [unit.id, "Block secretary", "1", "verified", "list-1"]
      ]),
      "utf8"
    );
    const postSession = await openOrgImport(db, { organizationId: org.id, kind: "posts", filePath: postsFile });
    expect(postSession.duplicateCount).toBe(1);
    const remapped = mapOrgImport(db, { sessionId: postSession.sessionId, mapping: postSession.mapping });
    expect(remapped.preview[0]?.importable).toBe(true);
    const postResult = commitOrgImport(db, { sessionId: postSession.sessionId });
    expect(postResult.imported).toBe(1);
    expect(postResult.duplicates).toBe(1);
    const post = listPosts(db, { organizationId: org.id })[0]!;
    const apptFile = path.join(dir, "appointments.csv");
    fs.writeFileSync(
      apptFile,
      stringifyCsv([
        ["post_id", "office_holder_name", "start_date", "end_date", "status", "verification_status"],
        [post.id, "Holder One", "2026-01-01", "2026-12-31", "active", "verified"],
        [post.id, "Holder Two", "2026-06-01", "2026-12-31", "active", "verified"]
      ]),
      "utf8"
    );
    const apptSession = await openOrgImport(db, { organizationId: org.id, kind: "appointments", filePath: apptFile });
    expect(apptSession.overlapCount).toBe(1);
    expect(() => commitOrgImport(db, { sessionId: apptSession.sessionId })).toThrow(/overlap/i);
    const committed = commitOrgImport(db, { sessionId: apptSession.sessionId, confirmOverlaps: true });
    expect(committed.imported).toBe(2);
    const overview = orgOverview(db, org.id);
    expect(overview.currentOfficeHolders).toBe(2);
    const csv = exportOrgCsv(db, {
      organizationId: org.id,
      kind: "appointments",
      format: "csv",
      fields: ["office_holder_name", "status"]
    });
    expect(csv).toContain("Holder One");
    expect(csv).not.toContain("membership_reference");
    expect(orgTemplateCsv("units")).toContain("unit_kind");
    await expect(openOrgImport(db, { organizationId: org.id, kind: "units", filePath: unitsFile })).rejects.toThrow(
      /already committed/
    );
    cancelOrgImport("missing");
    archiveOrganization(db, org.id);
    expect(listOrganizations(db).some((row) => row.id === org.id)).toBe(false);
  });

  it("includes organization tables in backup and restore", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "winwin-org-bak-"));
    dirs.push(tmp);
    const paths = resolveDataPaths(tmp);
    const manager = new DatabaseManager(paths);
    const live = manager.open();
    const org = createOrganization(live, { name: "Backup Org" });
    const unit = createUnit(live, {
      organizationId: org.id,
      name: "Backup unit",
      unitKind: "unit",
      level: "assembly_constituency"
    });
    createPost(live, { organizationId: org.id, unitId: unit.id, title: "Backup post" });
    const dest = path.join(tmp, "org.winwinbak");
    await createBackup(manager, dest);
    live.prepare("DELETE FROM organization_posts").run();
    live.prepare("DELETE FROM organization_units").run();
    live.prepare("DELETE FROM organizations").run();
    await restoreBackup(manager, dest, { skipConfirm: true });
    const restored = manager.get().prepare("SELECT COUNT(*) AS c FROM organizations").get() as { c: number };
    expect(restored.c).toBe(1);
    expect(SCHEMA_VERSION).toBe(7);
    manager.close();
  });
});
